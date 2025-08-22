import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase';
import TopBar from '../components/TopBar'; // Import TopBar
import { COLORS, BUTTON_STYLES, INPUT_STYLES, LAYOUT, CARD_STYLES } from '../components/profile-component/constants'; // Import constants

export default function UserProfile() {
  const { userId } = useParams();
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [projectId, setProjectId] = useState('');
  const [forumId, setForumId] = useState('');
  const [invitations, setInvitations] = useState([]);
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const docRef = doc(db, 'users', userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserProfile(docSnap.data());
          setEditingName(docSnap.data().name || ''); // Initialize editingName
        } else {
          setError('User not found.');
        }
      } catch (err) {
        setError('Failed to load user profile: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    const fetchInvitations = async () => {
      if (!currentUser) return;
      try {
        const q = query(collection(db, 'invitations'), where('recipientId', '==', currentUser.uid), where('status', '==', 'pending'));
        const querySnapshot = await getDocs(q);
        const fetchedInvitations = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setInvitations(fetchedInvitations);
      } catch (err) {
        console.error('Error fetching invitations:', err);
        setError('Failed to load invitations: ' + err.message);
      }
    };

    fetchUserProfile();
    fetchInvitations();
  }, [userId, currentUser]);

  const handleJoinProject = async () => {
    if (!projectId || !currentUser) return;
    try {
      setLoading(true);
      const projectRef = doc(db, 'projects', projectId);
      const projectSnap = await getDoc(projectRef);

      if (projectSnap.exists()) {
        await updateDoc(projectRef, {
          members: arrayUnion(currentUser.uid)
        });
        alert('Joined project successfully!');
        setProjectId('');
      } else {
        alert('Project not found!');
      }
    } catch (err) {
      setError('Failed to join project: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinForum = async () => {
    if (!forumId || !currentUser) return;
    try {
      setLoading(true);
      const forumRef = doc(db, 'forums', forumId);
      const forumSnap = await getDoc(forumRef);

      if (forumSnap.exists()) {
        await updateDoc(forumRef, {
          members: arrayUnion(currentUser.uid)
        });
        alert('Joined forum successfully!');
        setForumId('');
      } else {
        alert('Forum not found!');
      }
    } catch (err) {
      setError('Failed to join forum: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInvitationResponse = async (invitationId, accept) => {
    try {
      setLoading(true);
      const invitationRef = doc(db, 'invitations', invitationId);
      await updateDoc(invitationRef, {
        status: accept ? 'accepted' : 'rejected',
        respondedAt: new Date()
      });

      if (accept) {
        const invitationSnap = await getDoc(invitationRef);
        const invitationData = invitationSnap.data();
        if (invitationData.type === 'forum' && invitationData.targetId) {
          const forumRef = doc(db, 'forums', invitationData.targetId);
          await updateDoc(forumRef, {
            members: arrayUnion(currentUser.uid)
          });
          alert('Invitation accepted and joined forum!');
        }
      }
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
    } catch (err) {
      setError('Failed to respond to invitation: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!currentUser || currentUser.uid !== userId || !editingName.trim()) return;
    try {
      setLoading(true);
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        name: editingName.trim(),
      });
      setUserProfile(prev => ({ ...prev, name: editingName.trim() }));
      setShowEditProfileModal(false);
      alert('Profile updated successfully!');
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Failed to update profile: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading profile...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (!userProfile) {
    return <div className="error">User profile not found.</div>;
  }

  return (
    <div style={{ backgroundColor: COLORS.background, minHeight: '100vh', fontFamily: "Arial, sans-serif" }}>
      <TopBar />
      <div style={{ maxWidth: '900px', margin: '30px auto', padding: '0 20px' }}>
        {/* User Profile Info Card */}
        <div style={{ ...CARD_STYLES.base, marginBottom: LAYOUT.gap, padding: '30px' }}>
          <h1 style={{ margin: '0 0 15px 0', color: COLORS.dark, fontSize: '28px', fontWeight: '700' }}>{userProfile.name}'s Profile</h1>
          <p style={{ margin: '0 0 8px 0', color: COLORS.text, fontSize: '16px' }}><strong style={{ color: COLORS.dark }}>Email:</strong> {userProfile.email}</p>
          <p style={{ margin: 0, color: COLORS.text, fontSize: '16px' }}><strong style={{ color: COLORS.dark }}>Role:</strong> {userProfile.role}</p>
          {currentUser && currentUser.uid === userId && (
            <button 
              onClick={() => setShowEditProfileModal(true)}
              style={{
                ...BUTTON_STYLES.primary,
                marginTop: '20px',
                padding: '8px 16px',
                fontSize: '14px',
              }}
            >
              Edit Profile
            </button>
          )}
        </div>

      {currentUser && currentUser.uid === userId && (
        <div style={{ marginBottom: LAYOUT.gap }}>
          <h2 style={{ color: COLORS.dark, fontSize: '22px', fontWeight: '600', marginBottom: LAYOUT.gap }}>Join Project or Forum</h2>
          <div style={{ ...CARD_STYLES.base, padding: '20px', marginBottom: LAYOUT.smallGap, display: 'flex', alignItems: 'center', gap: LAYOUT.smallGap }}>
            <input
              type="text"
              placeholder="Project ID"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              style={{ ...INPUT_STYLES.base, flex: 1, padding: '10px' }}
            />
            <button onClick={handleJoinProject} disabled={loading} style={BUTTON_STYLES.primary}>Join Project</button>
          </div>
          <div style={{ ...CARD_STYLES.base, padding: '20px', display: 'flex', alignItems: 'center', gap: LAYOUT.smallGap }}>
            <input
              type="text"
              placeholder="Forum ID"
              value={forumId}
              onChange={(e) => setForumId(e.target.value)}
              style={{ ...INPUT_STYLES.base, flex: 1, padding: '10px' }}
            />
            <button onClick={handleJoinForum} disabled={loading} style={BUTTON_STYLES.primary}>Join Forum</button>
          </div>

          <h2 style={{ color: COLORS.dark, fontSize: '22px', fontWeight: '600', margin: `${LAYOUT.gap} 0 ${LAYOUT.smallGap} 0` }}>Pending Invitations</h2>
          {invitations.length > 0 ? (
            <div style={{ display: 'grid', gap: LAYOUT.smallGap }}>
              {invitations.map(inv => (
                <div key={inv.id} style={{ ...CARD_STYLES.base, padding: '15px', display: 'flex', flexDirection: 'column', gap: LAYOUT.smallGap }}>
                  <p style={{ margin: 0, color: COLORS.text, fontSize: '15px' }}>You're invited to <strong style={{ color: COLORS.primary }}>{inv.type} "{inv.targetName}"</strong> by <strong style={{ color: COLORS.dark }}>{inv.senderName}</strong>.</p>
                  <div style={{ display: 'flex', gap: LAYOUT.smallGap, marginTop: LAYOUT.smallGap }}>
                    <button onClick={() => handleInvitationResponse(inv.id, true)} disabled={loading} style={BUTTON_STYLES.success}>Accept</button>
                    <button onClick={() => handleInvitationResponse(inv.id, false)} disabled={loading} style={{ ...BUTTON_STYLES.secondary, background: COLORS.danger, color: COLORS.white }}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: COLORS.lightText, fontSize: '15px', textAlign: 'center', padding: '20px', ...CARD_STYLES.base }}>No pending invitations.</p>
          )}
        </div>
      )}
      </div>
      {showEditProfileModal && (
        <EditProfileModal
          isOpen={showEditProfileModal}
          onClose={() => setShowEditProfileModal(false)}
          currentName={editingName}
          onSave={handleUpdateProfile}
          onNameChange={setEditingName}
          loading={loading}
        />
      )}
    </div>
  );
}

function EditProfileModal({ isOpen, onClose, currentName, onSave, onNameChange, loading }) {
  if (!isOpen) return null;

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <h2 style={{ color: COLORS.dark, marginBottom: '20px' }}>Edit Profile</h2>
        <input
          type="text"
          value={currentName}
          onChange={(e) => onNameChange(e.target.value)}
          style={{ ...INPUT_STYLES.base, width: '100%', marginBottom: '20px' }}
          placeholder="Your Name"
          disabled={loading}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onClose} style={BUTTON_STYLES.secondary} disabled={loading}>
            Cancel
          </button>
          <button onClick={onSave} style={BUTTON_STYLES.primary} disabled={!currentName.trim() || loading}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
};

const modalContentStyle = {
  backgroundColor: COLORS.white,
  padding: '30px',
  borderRadius: '8px',
  width: '400px',
  maxWidth: '90%',
  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
  textAlign: 'center',
};
