import React, { useState } from 'react';
import { COLORS, BUTTON_STYLES, INPUT_STYLES } from '../profile-component/constants';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export default function ManageMembersModal({ isOpen, onClose, members, onAddMember, onRemoveMember, forumId, forumName }) {
  const [newMember, setNewMember] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const auth = getAuth();
  const currentUser = auth.currentUser;

  const handleAddMember = () => {
    if (newMember.trim() && !members.includes(newMember.trim())) {
      onAddMember(newMember.trim());
      setNewMember('');
    }
  };

  const handleSendInvitation = async () => {
    if (!inviteEmail.trim() || !currentUser || !forumId || !forumName) {
      setInviteError('Please enter a valid email and ensure forum details are available.');
      return;
    }

    setInviteLoading(true);
    setInviteError(null);

    try {
      // 1. Find recipient user by email
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', inviteEmail));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setInviteError('No user found with that email address.');
        setInviteLoading(false);
        return;
      }

      const recipientUser = querySnapshot.docs[0].data();
      const recipientId = querySnapshot.docs[0].id;

      if (members.includes(recipientUser.name || recipientUser.email)) {
        setInviteError('This user is already a member of this forum.');
        setInviteLoading(false);
        return;
      }

      // 2. Create invitation document
      await addDoc(collection(db, 'invitations'), {
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        recipientId: recipientId,
        recipientEmail: inviteEmail,
        type: 'forum',
        targetId: forumId,
        targetName: forumName,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      alert('Invitation sent successfully!');
      setInviteEmail('');
    } catch (err) {
      console.error('Error sending invitation:', err);
      setInviteError('Failed to send invitation: ' + err.message);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleClose = () => {
    setNewMember('');
    setInviteEmail('');
    setInviteError(null);
    onClose();
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
          margin: '0 0 24px 0', 
          color: COLORS.dark,
          fontSize: '24px',
          fontWeight: '700',
          textAlign: 'center'
        }}>
          Manage Forum Members
        </h2>

        {/* Add New Member */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            color: COLORS.dark,
            fontSize: '16px',
            fontWeight: '600'
          }}>
            Add New Member
          </label>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={newMember}
              onChange={(e) => setNewMember(e.target.value)}
              placeholder="Enter member name"
              style={{
                ...INPUT_STYLES.base,
                flex: 1,
                fontSize: '16px',
                padding: '12px'
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddMember();
                }
              }}
            />
            <button
              onClick={handleAddMember}
              style={{
                ...BUTTON_STYLES.primary,
                padding: '12px 20px',
                fontSize: '16px'
              }}
            >
              Add
            </button>
          </div>
        </div>

        {/* Invite Member */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            color: COLORS.dark,
            fontSize: '16px',
            fontWeight: '600'
          }}>
            Invite New Member
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Enter member email to invite"
              style={{
                ...INPUT_STYLES.base,
                flex: 1,
                fontSize: '16px',
                padding: '12px'
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSendInvitation();
                }
              }}
            />
            <button
              onClick={handleSendInvitation}
              style={{
                ...BUTTON_STYLES.primary,
                backgroundColor: COLORS.secondary, // A different color for invite button
                padding: '12px 20px',
                fontSize: '16px'
              }}
              disabled={inviteLoading}
            >
              {inviteLoading ? 'Sending...' : 'Invite'}
            </button>
          </div>
          {inviteError && <p style={{ color: COLORS.danger, fontSize: '14px', marginTop: '8px' }}>{inviteError}</p>}
        </div>

        {/* Current Members List */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '12px', 
            color: COLORS.dark,
            fontSize: '16px',
            fontWeight: '600'
          }}>
            Current Members ({members.length})
          </label>

          {members.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '24px',
              color: COLORS.lightText,
              fontSize: '16px',
              fontStyle: 'italic'
            }}>
              No members in this forum yet
            </div>
          ) : (
            <div style={{
              maxHeight: '300px',
              overflowY: 'auto',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '8px',
              padding: '12px'
            }}>
              {members.map((member, index) => (
                <div key={index} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  marginBottom: '8px',
                  backgroundColor: COLORS.light,
                  borderRadius: '6px',
                  fontSize: '15px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    {/* Avatar */}
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: COLORS.primary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      color: COLORS.white
                    }}>
                      {member.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </div>
                    <span style={{ 
                      color: COLORS.dark, 
                      fontWeight: '500' 
                    }}>
                      {member}
                    </span>
                  </div>
                  <button
                    onClick={() => onRemoveMember(member)}
                    style={{
                      background: 'none',
                      border: `1px solid ${COLORS.danger}`,
                      color: COLORS.danger,
                      padding: '4px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '500',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = COLORS.danger;
                      e.target.style.color = COLORS.white;
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'transparent';
                      e.target.style.color = COLORS.danger;
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Close Button */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center',
          marginTop: '30px'
        }}>
          <button
            onClick={handleClose}
            style={{
              ...BUTTON_STYLES.secondary,
              padding: '12px 32px',
              fontSize: '16px'
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
