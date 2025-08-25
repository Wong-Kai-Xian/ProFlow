import React, { useState, useEffect } from 'react';
import { COLORS, BUTTON_STYLES, INPUT_STYLES } from '../profile-component/constants';
import { FaCopy } from 'react-icons/fa';
import { Link } from 'react-router-dom'; // Import Link
import { getAcceptedTeamMembers } from '../../services/teamService';
import { db } from '../../firebase';
import { doc, updateDoc, arrayUnion, collection, query, where, getDocs } from 'firebase/firestore';

export default function InviteMemberModal({ isOpen, onClose, forumId, forumName, members, onAddMember, currentUser }) {
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState('');
  const [activeTab, setActiveTab] = useState('shareId'); // 'shareId' or 'addExisting'
  const [acceptedMembers, setAcceptedMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selectedMember, setSelectedMember] = useState('');

  const handleCopy = () => {
    navigator.clipboard.writeText(forumId)
      .then(() => {
        setCopySuccess('Copied!');
        setTimeout(() => setCopySuccess(''), 2000);
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
        setCopySuccess('Failed to copy.');
      });
  };

  // Fetch accepted members when modal opens
  useEffect(() => {
    const fetchAcceptedMembers = async () => {
      if (!isOpen || !currentUser) return;
      
      setLoadingMembers(true);
      try {
        const teamMembers = await getAcceptedTeamMembers(currentUser);
        // Filter out members who are already in the forum
        const currentMemberIds = members.map(m => m.id || m.uid);
        const availableMembers = teamMembers.filter(member => !currentMemberIds.includes(member.id));
        setAcceptedMembers(availableMembers);
      } catch (error) {
        console.error("Error fetching accepted team members:", error);
        setAcceptedMembers([]);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchAcceptedMembers();
  }, [isOpen, currentUser, members]);

  const handleAddExistingMember = async () => {
    if (!selectedMember || !forumId) return;
    
    try {
      const member = acceptedMembers.find(m => m.id === selectedMember);
      if (member) {
        // Add member to forum directly
        const forumRef = doc(db, "forums", forumId);
        await updateDoc(forumRef, {
          members: arrayUnion(member.id)
        });
        
        setSelectedMember('');
        onClose();
      }
    } catch (error) {
      console.error("Error adding member to forum:", error);
      alert("Failed to add member. Please try again.");
    }
  };

  const handleInvite = async () => {
    setError('');
    const email = newMemberEmail.trim();
    if (!email) return;
    try {
      setLoading(true);
      // Lookup user by email
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const snap = await getDocs(q);
      if (snap.empty) {
        setError('No user found with this email.');
        setLoading(false);
        return;
      }
      const userDoc = snap.docs[0];
      const uid = userDoc.data().uid || userDoc.id;
      // Prevent duplicate
      const alreadyMember = (members || []).some(m => (m.id || m.uid) === uid);
      if (alreadyMember) {
        setError('This user is already a member of this forum.');
        setLoading(false);
        return;
      }
      // Add to forum members array
      const forumRef = doc(db, 'forums', forumId);
      await updateDoc(forumRef, { members: arrayUnion(uid) });
      setNewMemberEmail('');
      onClose();
      // Optional: toast
      const popup = document.createElement('div');
      popup.textContent = 'Member added to forum';
      Object.assign(popup.style, { position: 'fixed', bottom: '20px', right: '20px', background: '#111827', color: '#fff', padding: '10px 12px', borderRadius: '8px', zIndex: 4000 });
      document.body.appendChild(popup); setTimeout(() => document.body.removeChild(popup), 1200);
    } catch (e) {
      console.error('Invite by email failed', e);
      setError('Failed to add member. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '30px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)'
      }}>
        <h2 style={{
          margin: '0 0 20px 0',
          color: COLORS.dark,
          fontSize: '24px',
          fontWeight: '700',
          textAlign: 'center'
        }}>
          Manage Forum Members
        </h2>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0', marginBottom: '20px' }}>
          <button
            onClick={() => setActiveTab('shareId')}
            style={{
              ...BUTTON_STYLES.secondary,
              borderRadius: '0',
              border: 'none',
              borderBottom: activeTab === 'shareId' ? '2px solid ' + COLORS.primary : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'shareId' ? COLORS.primary : COLORS.lightText,
              padding: '10px 20px',
              fontWeight: activeTab === 'shareId' ? '600' : '400'
            }}
          >
            Share Forum ID
          </button>
          <button
            onClick={() => setActiveTab('addExisting')}
            style={{
              ...BUTTON_STYLES.secondary,
              borderRadius: '0',
              border: 'none',
              borderBottom: activeTab === 'addExisting' ? '2px solid ' + COLORS.primary : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'addExisting' ? COLORS.primary : COLORS.lightText,
              padding: '10px 20px',
              fontWeight: activeTab === 'addExisting' ? '600' : '400'
            }}
          >
            Add Team Member
          </button>
        </div>

        {/* Share Forum ID Tab */}
        {activeTab === 'shareId' && (
          <div>
            <p style={{ color: COLORS.lightText, marginBottom: '15px', fontSize: '14px' }}>
              Share this Forum ID with others so they can join the forum.
            </p>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: COLORS.dark,
                fontSize: '16px',
                fontWeight: '600'
              }}>
                Forum ID
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="text"
                  value={forumId}
                  readOnly
                  style={{
                    ...INPUT_STYLES.base,
                    flex: 1,
                    fontSize: '16px',
                    padding: '12px',
                    backgroundColor: COLORS.light,
                    cursor: 'text'
                  }}
                />
                <button
                  onClick={handleCopy}
                  style={{
                    ...BUTTON_STYLES.secondary,
                    padding: '12px 16px',
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <FaCopy /> {copySuccess || 'Copy'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Team Member Tab */}
        {activeTab === 'addExisting' && (
          <div>
            <p style={{ color: COLORS.lightText, marginBottom: '15px', fontSize: '14px' }}>
              Add someone from your accepted team members to this forum.
            </p>
            {loadingMembers ? (
              <p style={{ color: COLORS.lightText, fontSize: '14px' }}>Loading team members...</p>
            ) : (
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  color: COLORS.dark,
                  fontSize: '16px',
                  fontWeight: '600'
                }}>
                  Select Team Member
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={selectedMember}
                    onChange={(e) => setSelectedMember(e.target.value)}
                    style={{
                      ...INPUT_STYLES.base,
                      flex: 1,
                      fontSize: '16px',
                      padding: '12px'
                    }}
                  >
                    <option value="">-- Select from accepted team --</option>
                    {acceptedMembers.map(member => (
                      <option key={member.id} value={member.id}>
                        {member.name} ({member.email})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddExistingMember}
                    disabled={!selectedMember}
                    style={{
                      ...BUTTON_STYLES.primary,
                      padding: '12px 24px',
                      fontSize: '16px',
                      opacity: !selectedMember ? 0.6 : 1,
                      cursor: !selectedMember ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Add
                  </button>
                </div>
                {acceptedMembers.length === 0 && !loadingMembers && (
                  <p style={{ color: COLORS.lightText, fontSize: '12px', marginTop: '8px' }}>
                    No accepted team members available. Send invitations from the Team page first.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Invite by Email */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            color: COLORS.dark,
            fontSize: '16px',
            fontWeight: '600'
          }}>
            Add by Email
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="email"
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              placeholder="user@example.com"
              style={{
                ...INPUT_STYLES.base,
                flex: 1,
                fontSize: '16px',
                padding: '12px'
              }}
              disabled={loading}
            />
            <button
              onClick={handleInvite}
              style={{
                ...BUTTON_STYLES.primary,
                padding: '12px 24px',
                fontSize: '16px'
              }}
              disabled={loading || !newMemberEmail.trim()}
            >
              {loading ? 'Adding...' : 'Add'}
            </button>
          </div>
          {error && <div style={{ color: COLORS.danger, marginTop: '8px', fontSize: '14px' }}>{error}</div>}
        </div>

        {/* Current Members List (optional, showing for context) */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            color: COLORS.dark,
            fontSize: '16px',
            fontWeight: '600'
          }}>
            Current Members ({members.length})
          </label>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            maxHeight: '150px',
            overflowY: 'auto',
            border: `1px solid ${COLORS.border}`,
            borderRadius: '8px',
            padding: '10px'
          }}>
            {members.length > 0 ? (
              members.map((member, index) => (
                <Link to={`/profile/${member.id}`} key={index} style={{ textDecoration: 'none' }}>
                  <span style={{
                    backgroundColor: COLORS.light,
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '14px',
                    color: COLORS.dark,
                    cursor: 'pointer'
                  }}>{member.name || member.email}</span>
                </Link>
              ))
            ) : (
              <span style={{ color: COLORS.lightText, fontStyle: 'italic' }}>No members yet.</span>
            )}
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
          marginTop: '30px'
        }}>
          <button
            onClick={onClose}
            style={{
              ...BUTTON_STYLES.secondary,
              padding: '12px 24px',
              fontSize: '16px'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
