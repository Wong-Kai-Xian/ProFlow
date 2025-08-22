import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase';
import './UserProfile.css'; // We'll create this file for styling

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
    <div className="user-profile-container">
      <h1>{userProfile.name}'s Profile</h1>
      <p>Email: {userProfile.email}</p>
      <p>Role: {userProfile.role}</p>

      {currentUser && currentUser.uid === userId && (
        <div className="user-actions">
          <h2>Join Project or Forum</h2>
          <div className="join-section">
            <input
              type="text"
              placeholder="Project ID"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            />
            <button onClick={handleJoinProject} disabled={loading}>Join Project</button>
          </div>
          <div className="join-section">
            <input
              type="text"
              placeholder="Forum ID"
              value={forumId}
              onChange={(e) => setForumId(e.target.value)}
            />
            <button onClick={handleJoinForum} disabled={loading}>Join Forum</button>
          </div>

          <h2>Pending Invitations</h2>
          {invitations.length > 0 ? (
            <div className="invitations-list">
              {invitations.map(inv => (
                <div key={inv.id} className="invitation-item">
                  <p>You're invited to {inv.type} "{inv.targetName}" by {inv.senderName}.</p>
                  <button onClick={() => handleInvitationResponse(inv.id, true)} disabled={loading}>Accept</button>
                  <button onClick={() => handleInvitationResponse(inv.id, false)} disabled={loading}>Reject</button>
                </div>
              ))}
            </div>
          ) : (
            <p>No pending invitations.</p>
          )}
        </div>
      )}
    </div>
  );
}
