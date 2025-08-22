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

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const docRef = doc(db, 'users', userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserProfile(docSnap.data());
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
    </div>
  );
}
