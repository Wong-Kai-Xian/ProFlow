import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

import { db, storage } from '../firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import TopBar from '../components/TopBar'; // Import TopBar
import { DESIGN_SYSTEM, getPageContainerStyle, getCardStyle, getContentContainerStyle, getButtonStyle } from '../styles/designSystem'; // Import design system
import { FaLinkedin, FaTwitter, FaGlobe, FaFolderOpen, FaComments } from 'react-icons/fa';
import ConfirmationModal from '../components/common/ConfirmationModal';
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
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [projectId, setProjectId] = useState('');
  const [forumId, setForumId] = useState('');
  const [invitations, setInvitations] = useState([]);
  const [sharedProjects, setSharedProjects] = useState([]);
  const [sharedForums, setSharedForums] = useState([]);
  const [myProjects, setMyProjects] = useState([]);
  const [myForums, setMyForums] = useState([]);
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState({
    title: '',
    message: '',
    confirmText: 'OK',
    confirmButtonType: 'primary',
    onConfirm: () => setShowConfirmModal(false)
  });
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
    website: '',
    photoURL: ''
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
            website: userData.website || '',
            photoURL: userData.photoURL || ''
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
        const resultsMap = new Map();
        const push = (snap) => {
          snap.forEach(p => { const d = p.data(); resultsMap.set(p.id, { id: p.id, data: d }); });
        };
        try { push(await getDocs(query(collection(db, 'projects'), where('team', 'array-contains', currentUser.uid)))); } catch {}
        try { push(await getDocs(query(collection(db, 'projects'), where('createdBy', '==', currentUser.uid)))); } catch {}
        try { push(await getDocs(query(collection(db, 'projects'), where('userId', '==', currentUser.uid)))); } catch {}
        try { push(await getDocs(query(collection(db, 'projects'), where('ownerId', '==', currentUser.uid)))); } catch {}

        const shared = [];
        resultsMap.forEach((val, id) => {
          const d = val.data || {};
          const teamArr = Array.isArray(d.team) ? d.team : [];
          const ownedByViewed = (d.createdBy === userId) || (d.userId === userId) || (d.ownerId === userId);
          if (teamArr.includes(userId) || ownedByViewed) {
            shared.push({ id, name: d.name || 'Project' });
          }
        });
        setSharedProjects(shared);

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

  // Load own projects/forums when viewing own profile
  useEffect(() => {
    const run = async () => {
      try {
        if (!currentUser || currentUser.uid !== userId) { setMyProjects([]); setMyForums([]); return; }
        const myEmail = (userProfile && (userProfile.email || '')) || currentUser.email || '';
        const resultsMap = new Map();
        const push = (snap) => {
          snap.forEach(p => { const d = p.data(); resultsMap.set(p.id, { id: p.id, name: d.name || 'Project' }); });
        };
        try { push(await getDocs(query(collection(db, 'projects'), where('team', 'array-contains', currentUser.uid)))); } catch {}
        if (myEmail) { try { push(await getDocs(query(collection(db, 'projects'), where('team', 'array-contains', myEmail)))); } catch {} }
        try { push(await getDocs(query(collection(db, 'projects'), where('createdBy', '==', currentUser.uid)))); } catch {}
        try { push(await getDocs(query(collection(db, 'projects'), where('userId', '==', currentUser.uid)))); } catch {}
        setMyProjects(Array.from(resultsMap.values()));
        try {
          const forumSnap = await getDocs(query(collection(db, 'forums'), where('members', 'array-contains', userId)));
          const mineF = [];
          forumSnap.forEach(f => { const d = f.data(); mineF.push({ id: f.id, name: d.name || 'Forum' }); });
          setMyForums(mineF);
        } catch { setMyForums([]); }
      } catch { setMyProjects([]); setMyForums([]); }
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

  const handleUpdateProfile = async (overrides = {}) => {
    if (!currentUser || currentUser.uid !== userId || !editingProfile.name.trim()) return;
    try {
      setLoading(true);

      const updatedProfile = (() => {
        const { email, ...rest } = editingProfile; // prevent email edits
        const { email: overrideEmail, ...restOverrides } = overrides || {};
        return {
          ...rest,
          ...restOverrides,
          name: editingProfile.name.trim()
        };
      })();

      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, updatedProfile);

      setUserProfile(prev => ({ ...prev, ...updatedProfile }));
      setShowEditProfileModal(false);
      setConfirmModalConfig({
        title: 'Profile Updated',
        message: 'Your profile changes have been saved successfully.',
        confirmText: 'OK',
        confirmButtonType: 'primary',
        onConfirm: () => setShowConfirmModal(false)
      });
      setShowConfirmModal(true);
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
          gridTemplateColumns: '1fr 1fr',
          alignItems: 'start',
          gap: DESIGN_SYSTEM.spacing.xl
        }}>

          {/* Left Column - Profile Card */}
          <div style={{
            ...getCardStyle('profile'),
            padding: DESIGN_SYSTEM.spacing.xl,
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
              {userProfile.photoURL ? (
                <img
                  src={userProfile.photoURL}
                  alt="Profile"
                  style={{ width: 220, height: 220, objectFit: 'cover', borderRadius: DESIGN_SYSTEM.borderRadius.lg, border: `2px solid ${DESIGN_SYSTEM.colors.secondary[200]}` }}
                />
              ) : (
                <UserAvatar user={userProfile} size={220} showBorder={true} borderColor={DESIGN_SYSTEM.colors.primary[500]} shape="square" />
              )}
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
              color: DESIGN_SYSTEM.colors.text.secondary,
              fontSize: DESIGN_SYSTEM.typography.fontSize.sm
            }}>
              {userProfile.company || 'Company not specified'}
            </p>

            {(userProfile.jobTitle || userProfile.phone) && (
              <div style={{ marginBottom: DESIGN_SYSTEM.spacing.lg }}>
                {userProfile.jobTitle && (
                  <div style={{ color: DESIGN_SYSTEM.colors.text.primary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>
                    {userProfile.jobTitle}
                  </div>
                )}
                {userProfile.phone && (
                  <div style={{ color: DESIGN_SYSTEM.colors.text.primary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>
                    {userProfile.phone}
                  </div>
                )}
              </div>
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: DESIGN_SYSTEM.spacing.base,
              margin: `${DESIGN_SYSTEM.spacing.xl} 0`,
              textAlign: 'left'
            }}>
              <div>
                <strong style={{ color: DESIGN_SYSTEM.colors.text.primary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>Email:</strong>
                <p style={{ margin: `${DESIGN_SYSTEM.spacing.xs} 0 0 0`, color: DESIGN_SYSTEM.colors.text.primary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, wordBreak: 'break-word' }}>{userProfile.email}</p>
              </div>
              {userProfile.address && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <strong style={{ color: DESIGN_SYSTEM.colors.text.primary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>Address:</strong>
                  <p style={{ margin: `${DESIGN_SYSTEM.spacing.xs} 0 0 0`, color: DESIGN_SYSTEM.colors.text.primary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>{userProfile.address}</p>
                </div>
              )}
            </div>

            {/* Social Links as icons */}
            {(userProfile.linkedin || userProfile.twitter || userProfile.website) && (
              <div style={{ borderTop: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`, paddingTop: DESIGN_SYSTEM.spacing.lg, margin: `${DESIGN_SYSTEM.spacing.lg} 0 0 0` }}>
                <h4 style={{ margin: `0 0 ${DESIGN_SYSTEM.spacing.sm} 0`, color: DESIGN_SYSTEM.colors.text.primary }}>Connect</h4>
                <div style={{ display: 'flex', justifyContent: 'center', gap: DESIGN_SYSTEM.spacing.lg }}>
                  {userProfile.linkedin && (
                    <a href={userProfile.linkedin} title="LinkedIn" target="_blank" rel="noopener noreferrer" style={{ color: DESIGN_SYSTEM.colors.accent.linkedin, fontSize: 24 }}>
                      <FaLinkedin />
                    </a>
                  )}
                  {userProfile.twitter && (
                    <a href={userProfile.twitter} title="Twitter" target="_blank" rel="noopener noreferrer" style={{ color: DESIGN_SYSTEM.colors.accent.twitter, fontSize: 24 }}>
                      <FaTwitter />
                    </a>
                  )}
                  {userProfile.website && (
                    <a href={userProfile.website} title="Website" target="_blank" rel="noopener noreferrer" style={{ color: DESIGN_SYSTEM.colors.primary[500], fontSize: 24 }}>
                      <FaGlobe />
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

          {/* Right Column - Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: DESIGN_SYSTEM.spacing.xl }}>
            <div style={{ ...getCardStyle('profile'), padding: DESIGN_SYSTEM.spacing.xl }}>
              <h2 style={{ color: DESIGN_SYSTEM.colors.text.primary, fontSize: DESIGN_SYSTEM.typography.fontSize.xl, fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold, marginBottom: DESIGN_SYSTEM.spacing.lg }}>Bio</h2>
              {userProfile.bio ? (
                <p style={{ margin: 0, color: DESIGN_SYSTEM.colors.text.primary, lineHeight: 1.7 }}>{userProfile.bio}</p>
              ) : (
                <p style={{ margin: 0, color: DESIGN_SYSTEM.colors.text.secondary }}>No bio provided.</p>
              )}
            </div>

            <div style={{ ...getCardStyle('profile'), padding: DESIGN_SYSTEM.spacing.xl }}>
              {currentUser && currentUser.uid === userId ? (
                <h2 style={{ color: DESIGN_SYSTEM.colors.text.primary, fontSize: DESIGN_SYSTEM.typography.fontSize.xl, fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold, marginBottom: DESIGN_SYSTEM.spacing.lg }}>My Projects & Forums</h2>
              ) : (
                <h2 style={{ color: DESIGN_SYSTEM.colors.text.primary, fontSize: DESIGN_SYSTEM.typography.fontSize.xl, fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold, marginBottom: DESIGN_SYSTEM.spacing.lg }}>Shared Workspaces</h2>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: DESIGN_SYSTEM.spacing.base }}>
                <div>
                  <div style={{ fontWeight: 700, color: DESIGN_SYSTEM.colors.text.primary, marginBottom: 6 }}>Projects</div>
                  {(currentUser && currentUser.uid === userId ? myProjects : sharedProjects).length === 0 ? (
                    <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>None</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {(currentUser && currentUser.uid === userId ? myProjects : sharedProjects).map(p => (
                        <Link key={p.id} to={`/project/${p.id}`} style={{ textDecoration: 'none' }}>
                          <span style={{ display: 'inline-block', padding: '6px 10px', borderRadius: 999, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#111827', fontSize: 12 }}>{p.name}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: DESIGN_SYSTEM.colors.text.primary, marginBottom: 6 }}>Forums</div>
                  {(currentUser && currentUser.uid === userId ? myForums : sharedForums).length === 0 ? (
                    <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>None</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {(currentUser && currentUser.uid === userId ? myForums : sharedForums).map(f => (
                        <Link key={f.id} to={`/forum/${f.id}`} style={{ textDecoration: 'none' }}>
                          <span style={{ display: 'inline-block', padding: '6px 10px', borderRadius: 999, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#111827', fontSize: 12 }}>{f.name}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
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

      {/* Confirmation Modal for success/info messages */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={confirmModalConfig.onConfirm}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        confirmText={confirmModalConfig.confirmText}
        confirmButtonType={confirmModalConfig.confirmButtonType}
      />
    </div>
  );
}

function ComprehensiveEditProfileModal({
  isOpen,
  onClose,
  editingProfile,
  setEditingProfile,
  onSave,
  loading,
  userId
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

        {/* Profile Avatar Display + Upload */}
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
            {editingProfile.photoURL ? (
              <img src={editingProfile.photoURL} alt="Profile" style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: DESIGN_SYSTEM.borderRadius.lg, border: `2px solid ${DESIGN_SYSTEM.colors.secondary[200]}` }} />
            ) : (
              <UserAvatar user={editingProfile} size={140} showBorder={true} borderColor={DESIGN_SYSTEM.colors.primary[500]} shape="square" />
            )}
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
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={async (e) => {
              const file = e.target.files && e.target.files[0];
              if (!file) return;
              if (!file.type.startsWith('image/')) return;
              try {
                const path = `user_avatars/${userId}/${Date.now()}_${file.name}`;
                const refObj = storageRef(storage, path);
                await uploadBytes(refObj, file);
                const url = await getDownloadURL(refObj);
                setEditingProfile(prev => ({ ...prev, photoURL: url }));
              } catch (err) {
                console.error('Avatar upload failed', err);
              }
            }}
            style={{ marginTop: DESIGN_SYSTEM.spacing.base }}
            disabled={loading}
          />
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
              inputMode="numeric"
              pattern="[0-9]*"
              value={editingProfile.phone}
              onChange={(e) => {
                const digitsOnly = (e.target.value || '').replace(/[^0-9]/g, '');
                handleInputChange('phone', digitsOnly);
              }}
              style={{ fontFamily: DESIGN_SYSTEM.typography.fontFamily.primary,
              backgroundColor: DESIGN_SYSTEM.colors.background.primary,
              border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
              borderRadius: DESIGN_SYSTEM.borderRadius.base,
              padding: DESIGN_SYSTEM.spacing.base, width: '100%' }}
              placeholder="60123456789"
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
              onChange={() => { /* email edits disabled */ }}
              style={{ fontFamily: DESIGN_SYSTEM.typography.fontFamily.primary,
              backgroundColor: DESIGN_SYSTEM.colors.background.primary,
              border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
              borderRadius: DESIGN_SYSTEM.borderRadius.base,
              padding: DESIGN_SYSTEM.spacing.base, width: '100%' }}
              placeholder="your.email@example.com"
              disabled
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
            onClick={() => onSave()}
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
