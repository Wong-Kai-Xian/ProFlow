import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

import { db } from '../firebase';
import TopBar from '../components/TopBar'; // Import TopBar
import { DESIGN_SYSTEM, getPageContainerStyle, getCardStyle, getContentContainerStyle, getButtonStyle } from '../styles/designSystem'; // Import design system
import UserAvatar from '../components/shared/UserAvatar';

const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
};

const modalContentStyle = {
  backgroundColor: DESIGN_SYSTEM.colors.background.primary,
  padding: DESIGN_SYSTEM.spacing.xl,
  borderRadius: DESIGN_SYSTEM.borderRadius.lg,
  width: '800px',
  maxWidth: '95%',
  maxHeight: '95vh',
  boxShadow: DESIGN_SYSTEM.shadows.lg,
  textAlign: 'center',
};

export default function UserProfile() {
  const { userId } = useParams();
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [projectId, setProjectId] = useState('');
  const [forumId, setForumId] = useState('');
  const [invitations, setInvitations] = useState([]);
  const [sharedProjects, setSharedProjects] = useState([]);
  const [sharedForums, setSharedForums] = useState([]);
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    jobTitle: '',
    company: '',
    bio: '',
    linkedin: '',
    twitter: '',
    website: ''
  });


  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const docRef = doc(db, 'users', userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const userData = docSnap.data();
          setUserProfile(userData);
          setEditingProfile({
            name: userData.name || '',
            email: userData.email || '',
            phone: userData.phone || '',
            address: userData.address || '',
            jobTitle: userData.jobTitle || '',
            company: userData.company || '',
            bio: userData.bio || '',
            linkedin: userData.linkedin || '',
            twitter: userData.twitter || '',
            website: userData.website || ''
          });
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

  // Compute shared projects and forums with the current user when viewing someone else's profile
  useEffect(() => {
    const run = async () => {
      try {
        if (!currentUser || !userId || (currentUser.uid === userId)) { setSharedProjects([]); setSharedForums([]); return; }
        // Ensure we have the viewed user's email for project matching
        const targetEmail = (userProfile && (userProfile.email || '')) || '';
        // Shared Projects (projects.team contains emails)
        try {
          const projSnap = await getDocs(query(collection(db, 'projects'), where('team', 'array-contains', currentUser.email || '')));
          const commons = [];
          projSnap.forEach(p => {
            const d = p.data();
            const teamArr = Array.isArray(d.team) ? d.team : [];
            if (targetEmail && teamArr.includes(targetEmail)) {
              commons.push({ id: p.id, name: d.name || 'Project' });
            }
          });
          setSharedProjects(commons);
        } catch {
          setSharedProjects([]);
        }
        // Shared Forums (forums.members contains UIDs)
        try {
          const forumSnap = await getDocs(query(collection(db, 'forums'), where('members', 'array-contains', currentUser.uid)));
          const commonsF = [];
          forumSnap.forEach(f => {
            const d = f.data();
            const membersArr = Array.isArray(d.members) ? d.members : [];
            if (membersArr.includes(userId)) {
              commonsF.push({ id: f.id, name: d.name || 'Forum' });
            }
          });
          setSharedForums(commonsF);
        } catch {
          setSharedForums([]);
        }
      } catch {
        setSharedProjects([]); setSharedForums([]);
      }
    };
    run();
  }, [currentUser, userId, userProfile]);

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
    if (!currentUser || currentUser.uid !== userId || !editingProfile.name.trim()) return;
    try {
      setLoading(true);

      const updatedProfile = {
        ...editingProfile,
        name: editingProfile.name.trim()
      };

      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, updatedProfile);

      setUserProfile(prev => ({ ...prev, ...updatedProfile }));
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
    <div style={getPageContainerStyle()}>
      <TopBar />

      <div style={{
        ...getContentContainerStyle(),
        paddingTop: DESIGN_SYSTEM.spacing['2xl']
      }}>
        {/* Professional Header */}
        <div style={{
          background: DESIGN_SYSTEM.pageThemes.profile.gradient,
          color: DESIGN_SYSTEM.colors.text.inverse,
          padding: `${DESIGN_SYSTEM.spacing['2xl']} 0`,
          textAlign: 'center',
          marginBottom: DESIGN_SYSTEM.spacing.xl,
          boxShadow: DESIGN_SYSTEM.shadows.lg
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: `0 ${DESIGN_SYSTEM.spacing.xl}` }}>
            <h1 style={{
              margin: `0 0 ${DESIGN_SYSTEM.spacing.sm} 0`,
              fontSize: DESIGN_SYSTEM.typography.fontSize['3xl'],
              fontWeight: DESIGN_SYSTEM.typography.fontWeight.bold,
              textShadow: DESIGN_SYSTEM.shadows.sm
            }}>
              User Profile Management
            </h1>
            <p style={{
              margin: 0,
              fontSize: DESIGN_SYSTEM.typography.fontSize.base,
              opacity: 0.9
            }}>
              Complete user profile and account management
            </p>
          </div>
        </div>

        <div style={{
          maxWidth: '1200px',
          margin: `0 auto`,
          padding: `0 ${DESIGN_SYSTEM.spacing.xl}`,
          display: 'grid',
          gridTemplateColumns: '400px 1fr',
          gap: DESIGN_SYSTEM.spacing.xl
        }}>

          {/* Left Column - Profile Card */}
          <div style={{
            ...getCardStyle('profile'),
            padding: DESIGN_SYSTEM.spacing['2xl'],
            textAlign: 'center',
            height: 'fit-content',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: DESIGN_SYSTEM.spacing.lg
            }}>
              <UserAvatar
                user={userProfile}
                size={120}
                showBorder={true}
                borderColor={DESIGN_SYSTEM.colors.primary[500]}
              />
            </div>

            <h1 style={{
              margin: `${DESIGN_SYSTEM.spacing.lg} 0 ${DESIGN_SYSTEM.spacing.sm} 0`,
              color: DESIGN_SYSTEM.colors.text.primary,
              fontSize: DESIGN_SYSTEM.typography.fontSize['2xl'],
              fontWeight: DESIGN_SYSTEM.typography.fontWeight.bold
            }}>
              {userProfile.name || 'User'}
            </h1>

            <p style={{
              margin: `0 0 ${DESIGN_SYSTEM.spacing.xs} 0`,
              color: DESIGN_SYSTEM.colors.primary[500],
              fontSize: DESIGN_SYSTEM.typography.fontSize.base,
              fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium
            }}>
              {userProfile.jobTitle || userProfile.role || 'Team Member'}
            </p>

            <p style={{
              margin: `0 0 ${DESIGN_SYSTEM.spacing.lg} 0`,
              color: DESIGN_SYSTEM.colors.text.secondary,
              fontSize: DESIGN_SYSTEM.typography.fontSize.sm
            }}>
              {userProfile.company || 'Company not specified'}
            </p>

            {userProfile.bio && (
              <div style={{
                background: DESIGN_SYSTEM.colors.background.secondary,
                borderRadius: DESIGN_SYSTEM.borderRadius.base,
                padding: DESIGN_SYSTEM.spacing.base,
                margin: `${DESIGN_SYSTEM.spacing.lg} 0`,
                textAlign: 'left'
              }}>
                <h4 style={{ margin: `0 0 ${DESIGN_SYSTEM.spacing.xs} 0`, color: DESIGN_SYSTEM.colors.text.primary }}>About</h4>
                <p style={{ margin: 0, color: DESIGN_SYSTEM.colors.text.primary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, lineHeight: DESIGN_SYSTEM.typography.lineHeight.loose }}>
                  {userProfile.bio}
                </p>
              </div>
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: DESIGN_SYSTEM.spacing.base,
              margin: `${DESIGN_SYSTEM.spacing.xl} 0`,
              textAlign: 'left'
            }}>
              <div>
                <strong style={{ color: DESIGN_SYSTEM.colors.text.primary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>Email:</strong>
                <p style={{ margin: `${DESIGN_SYSTEM.spacing.xs} 0 0 0`, color: DESIGN_SYSTEM.colors.text.primary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, wordBreak: 'break-word' }}>{userProfile.email}</p>
              </div>
              {userProfile.phone && (
                <div>
                  <strong style={{ color: DESIGN_SYSTEM.colors.text.primary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>Phone:</strong>
                  <p style={{ margin: `${DESIGN_SYSTEM.spacing.xs} 0 0 0`, color: DESIGN_SYSTEM.colors.text.primary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>{userProfile.phone}</p>
                </div>
              )}
              {userProfile.address && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <strong style={{ color: DESIGN_SYSTEM.colors.text.primary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>Address:</strong>
                  <p style={{ margin: `${DESIGN_SYSTEM.spacing.xs} 0 0 0`, color: DESIGN_SYSTEM.colors.text.primary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>{userProfile.address}</p>
                </div>
              )}
            </div>

            {/* Social Links */}
            {(userProfile.linkedin || userProfile.twitter || userProfile.website) && (
              <div style={{
                borderTop: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`,
                paddingTop: DESIGN_SYSTEM.spacing.lg,
                margin: `${DESIGN_SYSTEM.spacing.lg} 0 0 0`
              }}>
                <h4 style={{ margin: `0 0 ${DESIGN_SYSTEM.spacing.sm} 0`, color: DESIGN_SYSTEM.colors.text.primary }}>Connect</h4>
                <div style={{ display: 'flex', justifyContent: 'center', gap: DESIGN_SYSTEM.spacing.base }}>
                  {userProfile.linkedin && (
                    <a href={userProfile.linkedin} target="_blank" rel="noopener noreferrer" style={{
                      padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.sm}`,
                      background: DESIGN_SYSTEM.colors.accent.linkedin,
                      color: DESIGN_SYSTEM.colors.text.inverse,
                      borderRadius: DESIGN_SYSTEM.borderRadius.sm,
                      textDecoration: 'none',
                      fontSize: DESIGN_SYSTEM.typography.fontSize.xs
                    }}>
                      LinkedIn
                    </a>
                  )}
                  {userProfile.twitter && (
                    <a href={userProfile.twitter} target="_blank" rel="noopener noreferrer" style={{
                      padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.sm}`,
                      background: DESIGN_SYSTEM.colors.accent.twitter,
                      color: DESIGN_SYSTEM.colors.text.inverse,
                      borderRadius: DESIGN_SYSTEM.borderRadius.sm,
                      textDecoration: 'none',
                      fontSize: DESIGN_SYSTEM.typography.fontSize.xs
                    }}>
                      Twitter
                    </a>
                  )}
                  {userProfile.website && (
                    <a href={userProfile.website} target="_blank" rel="noopener noreferrer" style={{
                      padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.sm}`,
                      background: DESIGN_SYSTEM.colors.primary[500],
                      color: DESIGN_SYSTEM.colors.text.inverse,
                      borderRadius: DESIGN_SYSTEM.borderRadius.sm,
                      textDecoration: 'none',
                      fontSize: DESIGN_SYSTEM.typography.fontSize.xs
                    }}>
                      Website
                    </a>
                  )}
                </div>
              </div>
            )}

          {currentUser && currentUser.uid === userId && (
            <button 
              onClick={() => setShowEditProfileModal(true)}
              style={{
                  ...getButtonStyle('primary', 'profile'),
                  padding: `${DESIGN_SYSTEM.spacing.lg} ${DESIGN_SYSTEM.spacing['2xl']}`,
                  fontSize: DESIGN_SYSTEM.typography.fontSize.base,
                  fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold,
                  borderRadius: DESIGN_SYSTEM.borderRadius.lg,
                  marginTop: DESIGN_SYSTEM.spacing.xl,
                  width: '100%',
                  boxShadow: DESIGN_SYSTEM.shadows.md
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = DESIGN_SYSTEM.shadows.lg;
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = DESIGN_SYSTEM.shadows.md;
              }}
            >
              Edit Profile
            </button>
          )}
        </div>

          {/* Right Column - Functions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: DESIGN_SYSTEM.spacing.xl }}>

      {/* Shared context with current user when viewing others */}
      {currentUser && currentUser.uid !== userId && (
        <div style={{
          ...getCardStyle('profile'),
          padding: DESIGN_SYSTEM.spacing.xl
        }}>
          <h2 style={{
            color: DESIGN_SYSTEM.colors.text.primary,
            fontSize: DESIGN_SYSTEM.typography.fontSize.xl,
            fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold,
            marginBottom: DESIGN_SYSTEM.spacing.lg,
            textAlign: 'center'
          }}>
            Shared Workspaces
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: DESIGN_SYSTEM.spacing.base }}>
            <div>
              <div style={{ fontWeight: 700, color: DESIGN_SYSTEM.colors.text.primary, marginBottom: 6 }}>Projects</div>
              {sharedProjects.length === 0 ? (
                <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>No shared projects</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {sharedProjects.map(p => (
                    <Link key={p.id} to={`/project/${p.id}`} style={{ textDecoration: 'none' }}>
                      <span style={{ display: 'inline-block', padding: '6px 10px', borderRadius: 999, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#111827', fontSize: 12 }}>{p.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div style={{ fontWeight: 700, color: DESIGN_SYSTEM.colors.text.primary, marginBottom: 6 }}>Forums</div>
              {sharedForums.length === 0 ? (
                <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>No shared forums</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {sharedForums.map(f => (
                    <Link key={f.id} to={`/forum/${f.id}`} style={{ textDecoration: 'none' }}>
                      <span style={{ display: 'inline-block', padding: '6px 10px', borderRadius: 999, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#111827', fontSize: 12 }}>{f.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {currentUser && currentUser.uid === userId && (
              <>
                {/* Join Projects/Forums Section */}
                <div style={{
                  ...getCardStyle('profile'),
                  padding: DESIGN_SYSTEM.spacing.xl
                }}>
                  <h2 style={{
                    color: DESIGN_SYSTEM.colors.text.primary,
                    fontSize: DESIGN_SYSTEM.typography.fontSize.xl,
                    fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold,
                    marginBottom: DESIGN_SYSTEM.spacing.lg,
                    textAlign: 'center'
                  }}>
                    Join Project or Forum
                  </h2>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: DESIGN_SYSTEM.spacing.base }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: DESIGN_SYSTEM.spacing.sm }}>
            <input
              type="text"
                        placeholder="Enter Project ID"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
                        style={{
                          fontFamily: DESIGN_SYSTEM.typography.fontFamily.primary,
                          backgroundColor: DESIGN_SYSTEM.colors.background.primary,
                          border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                          borderRadius: DESIGN_SYSTEM.borderRadius.base,
                          padding: DESIGN_SYSTEM.spacing.base,
                          flex: 1,
                          padding: `${DESIGN_SYSTEM.spacing.base} ${DESIGN_SYSTEM.spacing.sm}`,
                          borderRadius: DESIGN_SYSTEM.borderRadius.base,
                          border: `2px solid ${DESIGN_SYSTEM.colors.secondary[200]}`,
                          fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                          color: DESIGN_SYSTEM.colors.text.primary
                        }}
                      />
                      <button
                        onClick={handleJoinProject}
                        disabled={loading}
                        style={{
                          ...getButtonStyle('primary', 'profile'),
                          padding: `${DESIGN_SYSTEM.spacing.sm} ${DESIGN_SYSTEM.spacing.base}`,
                          borderRadius: DESIGN_SYSTEM.borderRadius.base,
                          fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold,
                          fontSize: DESIGN_SYSTEM.typography.fontSize.sm
                        }}
                      >
                        Join Project
                      </button>
          </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: DESIGN_SYSTEM.spacing.sm }}>
            <input
              type="text"
                        placeholder="Enter Forum ID"
              value={forumId}
              onChange={(e) => setForumId(e.target.value)}
                        style={{
                          fontFamily: DESIGN_SYSTEM.typography.fontFamily.primary,
                          backgroundColor: DESIGN_SYSTEM.colors.background.primary,
                          border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                          borderRadius: DESIGN_SYSTEM.borderRadius.base,
                          padding: DESIGN_SYSTEM.spacing.base,
                          flex: 1,
                          padding: `${DESIGN_SYSTEM.spacing.base} ${DESIGN_SYSTEM.spacing.sm}`,
                          borderRadius: DESIGN_SYSTEM.borderRadius.base,
                          border: `2px solid ${DESIGN_SYSTEM.colors.secondary[200]}`,
                          fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                          color: DESIGN_SYSTEM.colors.text.primary
                        }}
                      />
                      <button
                        onClick={handleJoinForum}
                        disabled={loading}
                        style={{
                          ...getButtonStyle('primary', 'profile'),
                          padding: `${DESIGN_SYSTEM.spacing.sm} ${DESIGN_SYSTEM.spacing.base}`,
                          borderRadius: DESIGN_SYSTEM.borderRadius.base,
                          fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold,
                          fontSize: DESIGN_SYSTEM.typography.fontSize.sm
                        }}
                      >
                        Join Forum
                      </button>
                    </div>
                  </div>
          </div>

                {/* Invitations Section */}
                <div style={{
                  ...getCardStyle('profile'),
                  padding: DESIGN_SYSTEM.spacing.xl
                }}>
                  <h2 style={{
                    color: DESIGN_SYSTEM.colors.text.primary,
                    fontSize: DESIGN_SYSTEM.typography.fontSize.xl,
                    fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold,
                    marginBottom: DESIGN_SYSTEM.spacing.lg,
                    textAlign: 'center'
                  }}>
                    Pending Invitations
                  </h2>

          {invitations.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: DESIGN_SYSTEM.spacing.base }}>
              {invitations.map(inv => (
                        <div key={inv.id} style={{
                          background: DESIGN_SYSTEM.pageThemes.profile.cardGradient,
                          borderRadius: DESIGN_SYSTEM.borderRadius.lg,
                          padding: DESIGN_SYSTEM.spacing.base,
                          border: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`
                        }}>
                          <p style={{
                            margin: `0 0 ${DESIGN_SYSTEM.spacing.sm} 0`,
                            color: DESIGN_SYSTEM.colors.text.primary,
                            fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                            lineHeight: DESIGN_SYSTEM.typography.lineHeight.loose
                          }}>
                            <strong style={{ color: DESIGN_SYSTEM.colors.text.primary }}>{inv.senderName}</strong> invited you to join <strong style={{ color: DESIGN_SYSTEM.colors.primary[500] }}>{inv.type} "{inv.targetName}"</strong>
                          </p>
                          <div style={{ display: 'flex', gap: DESIGN_SYSTEM.spacing.sm }}>
                            <button
                              onClick={() => handleInvitationResponse(inv.id, true)}
                              disabled={loading}
                              style={{
                                ...getButtonStyle('primary', 'profile'),
                                flex: 1,
                                padding: `${DESIGN_SYSTEM.spacing.sm} ${DESIGN_SYSTEM.spacing.base}`,
                                borderRadius: DESIGN_SYSTEM.borderRadius.base,
                                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold,
                                fontSize: DESIGN_SYSTEM.typography.fontSize.sm
                              }}
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleInvitationResponse(inv.id, false)}
                              disabled={loading}
                              style={{
                                ...getButtonStyle('primary', 'profile'),
                                background: DESIGN_SYSTEM.colors.error, // Use error color for reject
                                flex: 1,
                                padding: `${DESIGN_SYSTEM.spacing.sm} ${DESIGN_SYSTEM.spacing.base}`,
                                borderRadius: DESIGN_SYSTEM.borderRadius.base,
                                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold,
                                fontSize: DESIGN_SYSTEM.typography.fontSize.sm
                              }}
                            >
                              Reject
                            </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
                    <p style={{
                      color: DESIGN_SYSTEM.colors.text.secondary,
                      fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                      textAlign: 'center',
                      padding: `${DESIGN_SYSTEM.spacing.lg} ${DESIGN_SYSTEM.spacing.base}`,
                      background: DESIGN_SYSTEM.colors.background.secondary,
                      borderRadius: DESIGN_SYSTEM.borderRadius.lg,
                      margin: 0
                    }}>
                      No pending invitations
                    </p>
          )}
        </div>
              </>
      )}
          </div>
        </div>
      </div>
      {showEditProfileModal && (
        <ComprehensiveEditProfileModal
          isOpen={showEditProfileModal}
          onClose={() => setShowEditProfileModal(false)}
          editingProfile={editingProfile}
          setEditingProfile={setEditingProfile}
          onSave={handleUpdateProfile}
          loading={loading}
        />
      )}
    </div>
  );
}

function ComprehensiveEditProfileModal({
  isOpen,
  onClose,
  editingProfile,
  setEditingProfile,
  onSave,
  loading
}) {
  if (!isOpen) return null;

  const handleInputChange = (field, value) => {
    setEditingProfile(prev => ({ ...prev, [field]: value }));
  };



  return (
    <div style={modalOverlayStyle}>
      <div style={{
        ...modalContentStyle,
        width: '800px',
        maxWidth: '95vw',
        maxHeight: '95vh',
        overflowY: 'auto',
        padding: DESIGN_SYSTEM.spacing['2xl']
      }}>
        <h2 style={{
          color: DESIGN_SYSTEM.colors.text.primary,
          marginBottom: DESIGN_SYSTEM.spacing.lg,
          textAlign: 'center',
          fontSize: DESIGN_SYSTEM.typography.fontSize['2xl'],
          fontWeight: DESIGN_SYSTEM.typography.fontWeight.bold
        }}>
          Edit Profile
        </h2>

        {/* Profile Avatar Display - No Upload */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: DESIGN_SYSTEM.spacing['2xl'],
          padding: DESIGN_SYSTEM.spacing.xl,
          background: DESIGN_SYSTEM.colors.background.secondary,
          borderRadius: DESIGN_SYSTEM.borderRadius.xl,
          border: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: DESIGN_SYSTEM.spacing.base
          }}>
            <UserAvatar
              user={editingProfile}
              size={120}
              showBorder={true}
              borderColor={DESIGN_SYSTEM.colors.primary[500]}
            />
          </div>
          <h3 style={{
            margin: `${DESIGN_SYSTEM.spacing.base} 0 ${DESIGN_SYSTEM.spacing.xs} 0`,
            color: DESIGN_SYSTEM.colors.text.primary,
            fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
            fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold,
            textAlign: 'center'
          }}>
            Profile Avatar
          </h3>
          <p style={{
            margin: 0,
            color: DESIGN_SYSTEM.colors.text.secondary,
            fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
            textAlign: 'center'
          }}>
            Your avatar is automatically generated from your name initials
          </p>
        </div>

        {/* Form Fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: DESIGN_SYSTEM.colors.text.primary, fontWeight: '500' }}>
              Full Name *
            </label>
            <input
              type="text"
              value={editingProfile.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              style={{ fontFamily: DESIGN_SYSTEM.typography.fontFamily.primary,
              backgroundColor: DESIGN_SYSTEM.colors.background.primary,
              border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
              borderRadius: DESIGN_SYSTEM.borderRadius.base,
              padding: DESIGN_SYSTEM.spacing.base, width: '100%' }}
              placeholder="Your full name"
              disabled={loading}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: DESIGN_SYSTEM.colors.text.primary, fontWeight: '500' }}>
              Job Title
            </label>
            <input
              type="text"
              value={editingProfile.jobTitle}
              onChange={(e) => handleInputChange('jobTitle', e.target.value)}
              style={{ fontFamily: DESIGN_SYSTEM.typography.fontFamily.primary,
              backgroundColor: DESIGN_SYSTEM.colors.background.primary,
              border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
              borderRadius: DESIGN_SYSTEM.borderRadius.base,
              padding: DESIGN_SYSTEM.spacing.base, width: '100%' }}
              placeholder="Software Engineer, Manager, etc."
              disabled={loading}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: DESIGN_SYSTEM.colors.text.primary, fontWeight: '500' }}>
              Phone Number
            </label>
            <input
              type="tel"
              value={editingProfile.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              style={{ fontFamily: DESIGN_SYSTEM.typography.fontFamily.primary,
              backgroundColor: DESIGN_SYSTEM.colors.background.primary,
              border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
              borderRadius: DESIGN_SYSTEM.borderRadius.base,
              padding: DESIGN_SYSTEM.spacing.base, width: '100%' }}
              placeholder="+1 (555) 123-4567"
              disabled={loading}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: DESIGN_SYSTEM.colors.text.primary, fontWeight: '500' }}>
              Company
            </label>
            <input
              type="text"
              value={editingProfile.company}
              onChange={(e) => handleInputChange('company', e.target.value)}
              style={{ fontFamily: DESIGN_SYSTEM.typography.fontFamily.primary,
              backgroundColor: DESIGN_SYSTEM.colors.background.primary,
              border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
              borderRadius: DESIGN_SYSTEM.borderRadius.base,
              padding: DESIGN_SYSTEM.spacing.base, width: '100%' }}
              placeholder="Your company name"
              disabled={loading}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: DESIGN_SYSTEM.colors.text.primary, fontWeight: '500' }}>
              Email
            </label>
            <input
              type="email"
              value={editingProfile.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              style={{ fontFamily: DESIGN_SYSTEM.typography.fontFamily.primary,
              backgroundColor: DESIGN_SYSTEM.colors.background.primary,
              border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
              borderRadius: DESIGN_SYSTEM.borderRadius.base,
              padding: DESIGN_SYSTEM.spacing.base, width: '100%' }}
              placeholder="your.email@example.com"
              disabled={loading}
            />
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: DESIGN_SYSTEM.colors.text.primary, fontWeight: '500' }}>
            Address
          </label>
        <input
          type="text"
            value={editingProfile.address}
            onChange={(e) => handleInputChange('address', e.target.value)}
            style={{ fontFamily: DESIGN_SYSTEM.typography.fontFamily.primary,
              backgroundColor: DESIGN_SYSTEM.colors.background.primary,
              border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
              borderRadius: DESIGN_SYSTEM.borderRadius.base,
              padding: DESIGN_SYSTEM.spacing.base, width: '100%' }}
            placeholder="Your full address"
            disabled={loading}
          />
        </div>

        <div style={{ marginTop: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: DESIGN_SYSTEM.colors.text.primary, fontWeight: '500' }}>
            Bio
          </label>
          <textarea
            value={editingProfile.bio}
            onChange={(e) => handleInputChange('bio', e.target.value)}
            style={{
              fontFamily: DESIGN_SYSTEM.typography.fontFamily.primary,
              backgroundColor: DESIGN_SYSTEM.colors.background.primary,
              border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
              borderRadius: DESIGN_SYSTEM.borderRadius.base,
              padding: DESIGN_SYSTEM.spacing.base,
              resize: 'vertical',
              width: '100%',
              minHeight: '100px',
              resize: 'vertical'
            }}
            placeholder="Tell us about yourself..."
            disabled={loading}
          />
        </div>

        {/* Social Links */}
        <div style={{
          marginTop: DESIGN_SYSTEM.spacing.xl,
          padding: DESIGN_SYSTEM.spacing.xl,
          background: DESIGN_SYSTEM.pageThemes.profile.cardGradient,
          borderRadius: DESIGN_SYSTEM.borderRadius.xl,
          border: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`
        }}>
          <h3 style={{ margin: `0 0 ${DESIGN_SYSTEM.spacing.lg} 0`, color: DESIGN_SYSTEM.colors.text.primary, fontSize: DESIGN_SYSTEM.typography.fontSize.lg }}>Social Links & Online Presence</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: DESIGN_SYSTEM.spacing.base }}>
            <div>
              <label style={{ display: 'block', marginBottom: DESIGN_SYSTEM.spacing.xs, color: DESIGN_SYSTEM.colors.text.primary, fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium }}>
                LinkedIn URL
              </label>
              <input
                type="url"
                value={editingProfile.linkedin}
                onChange={(e) => handleInputChange('linkedin', e.target.value)}
                style={{ fontFamily: DESIGN_SYSTEM.typography.fontFamily.primary,
              backgroundColor: DESIGN_SYSTEM.colors.background.primary,
              border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
              borderRadius: DESIGN_SYSTEM.borderRadius.base,
              padding: DESIGN_SYSTEM.spacing.base, width: '100%' }}
                placeholder="https://linkedin.com/in/username"
                disabled={loading}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: DESIGN_SYSTEM.spacing.xs, color: DESIGN_SYSTEM.colors.text.primary, fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium }}>
                Twitter URL
              </label>
              <input
                type="url"
                value={editingProfile.twitter}
                onChange={(e) => handleInputChange('twitter', e.target.value)}
                style={{ fontFamily: DESIGN_SYSTEM.typography.fontFamily.primary,
              backgroundColor: DESIGN_SYSTEM.colors.background.primary,
              border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
              borderRadius: DESIGN_SYSTEM.borderRadius.base,
              padding: DESIGN_SYSTEM.spacing.base, width: '100%' }}
                placeholder="https://twitter.com/username"
                disabled={loading}
              />
            </div>
          </div>

          <div style={{ marginTop: DESIGN_SYSTEM.spacing.base }}>
            <label style={{ display: 'block', marginBottom: DESIGN_SYSTEM.spacing.xs, color: DESIGN_SYSTEM.colors.text.primary, fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium }}>
              Website URL
            </label>
            <input
              type="url"
              value={editingProfile.website}
              onChange={(e) => handleInputChange('website', e.target.value)}
              style={{ fontFamily: DESIGN_SYSTEM.typography.fontFamily.primary,
              backgroundColor: DESIGN_SYSTEM.colors.background.primary,
              border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
              borderRadius: DESIGN_SYSTEM.borderRadius.base,
              padding: DESIGN_SYSTEM.spacing.base, width: '100%' }}
              placeholder="https://yourwebsite.com"
          disabled={loading}
        />
          </div>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: DESIGN_SYSTEM.spacing.base,
          marginTop: DESIGN_SYSTEM.spacing.xl,
          paddingTop: DESIGN_SYSTEM.spacing.lg,
          borderTop: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`
        }}>
          <button
            onClick={onClose}
            style={{
              ...getButtonStyle('secondary', 'profile'),
              padding: `${DESIGN_SYSTEM.spacing.base} ${DESIGN_SYSTEM.spacing.lg}`,
              fontSize: DESIGN_SYSTEM.typography.fontSize.base
            }}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            style={{
              ...getButtonStyle('primary', 'profile'),
              padding: `${DESIGN_SYSTEM.spacing.base} ${DESIGN_SYSTEM.spacing.lg}`,
              fontSize: DESIGN_SYSTEM.typography.fontSize.base
            }}
            disabled={!editingProfile.name.trim() || loading}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
