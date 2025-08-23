import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import TopBar from "../components/TopBar";
import ForumTabs from "../components/ForumTabs";
import ProjectDetails from "../components/project-component/ProjectDetails";
import ForumReminders from "../components/forum-tabs/ForumReminders";
import StarredPosts from "../components/forum-tabs/StarredPosts";
import ActiveUsers from "../components/forum-tabs/ActiveUsers";
import FloatingCreateButton from "../components/forum-tabs/FloatingCreateButton";
import CreatePostModal from "../components/forum-tabs/CreatePostModal";
import InviteMemberModal from "../components/forum-component/InviteMemberModal";
import { db } from "../firebase";
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, getDocs, getDoc } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { DESIGN_SYSTEM, getPageContainerStyle, getCardStyle, getContentContainerStyle, getButtonStyle } from '../styles/designSystem';

export default function Forum() {
  const { id: forumId } = useParams(); // Rename `id` to `forumId` for clarity
  const { currentUser } = useAuth(); // Get currentUser from AuthContext
  console.log("Forum.js: forumId from useParams:", forumId);
  const [forumData, setForumData] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [posts, setPosts] = useState([]); // This will eventually come from Discussion tab's Firestore logic
  const [linkedProjectData, setLinkedProjectData] = useState(null); // State for actual project data
  const [showInviteModal, setShowInviteModal] = useState(false); // State for the new Invite Member modal
  const [forumMembers, setForumMembers] = useState([]); // Will be populated from forumData (UIDs)
  const [enrichedForumMembersDetails, setEnrichedForumMembersDetails] = useState([]); // Enriched member data

  useEffect(() => {
    if (!forumId) return; // Exit if no forumId

    const forumRef = doc(db, "forums", forumId);
    const unsubscribeForum = onSnapshot(forumRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setForumData(data);
        setForumMembers(data.members || []); // Update forumMembers with UIDs
      } else {
        console.log("No such forum document!");
        setForumData(null);
        setForumMembers([]);
      }
    });

    return () => unsubscribeForum();
  }, [forumId]);

  // Effect to fetch linked project data in real-time
  useEffect(() => {
    if (!forumData?.projectId) {
      setLinkedProjectData(null);
      return;
    }

    const projectRef = doc(db, "projects", forumData.projectId);
    const unsubscribeProject = onSnapshot(projectRef, (projectSnap) => {
      if (projectSnap.exists()) {
        setLinkedProjectData({ id: projectSnap.id, ...projectSnap.data() });
      } else {
        setLinkedProjectData(null);
        console.warn("Linked project not found.", forumData.projectId);
      }
    });

    return () => unsubscribeProject();
  }, [forumData?.projectId]);

  // Effect to fetch details for forum members
  useEffect(() => {
    if (!forumMembers || forumMembers.length === 0) {
      setEnrichedForumMembersDetails([]);
      return;
    }

    const fetchMemberDetails = async () => {
      const fetchedDetails = await Promise.all(
        forumMembers.map(async (memberUid) => {
          const userRef = doc(db, "users", memberUid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            return { 
              id: memberUid, 
              name: userData.name || userData.email || 'Forum Member', 
              email: userData.email || 'No email provided', 
              status: 'online', 
              role: 'Member', 
              joinDate: 'Recently joined'
            };
          } else {
            console.warn(`User document not found for member ID: ${memberUid}`);
            return { 
              id: memberUid, 
              name: 'Forum Member', 
              email: 'User not found', 
              status: 'offline', 
              role: 'Member', 
              joinDate: 'Recently joined'
            };
          }
        })
      );
      setEnrichedForumMembersDetails(fetchedDetails);
    };

    fetchMemberDetails();
  }, [forumMembers]);

  // Function to update lastActivity in Firestore whenever there's relevant activity
  const updateForumLastActivity = async () => {
    if (forumId) {
      const forumRef = doc(db, "forums", forumId);
      try {
        await updateDoc(forumRef, { lastActivity: serverTimestamp() });
      } catch (error) {
        console.error("Error updating forum last activity: ", error);
      }
    }
  };

  // Function to update post count in the main forum document
  const updateForumPostCount = async (incrementBy) => {
    if (forumId) {
      const forumRef = doc(db, "forums", forumId);
      try {
        // Use FieldValue.increment if you have it imported, otherwise fetch, update, and set
        // For simplicity and to avoid importing FieldValue, we'll do a read-modify-write
        const docSnap = await getDoc(forumRef);
        if (docSnap.exists()) {
          const currentPosts = docSnap.data().posts || 0;
          await updateDoc(forumRef, { posts: currentPosts + incrementBy });
        }
      } catch (error) {
        console.error("Error updating forum post count: ", error);
      }
    }
  };

  // Mock data functions (handlePostSubmit, handleAddMember, handleRemoveMember) will be modified later
  // to interact with Firebase based on individual tab/modal integrations.
  const handleTrendingPostClick = (post) => {
    // This remains mostly UI related, but ensure it points to correct post IDs
    const postElement = document.getElementById(`post-${post.id}`);
    if (postElement) {
      postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      postElement.style.backgroundColor = '#E8F4FD';
      setTimeout(() => {
        postElement.style.backgroundColor = 'transparent'; // Revert to transparent or original background
      }, 2000);
    }
  };

  const handleAddMember = async (newMember) => {
    if (newMember.trim() && forumData && !forumData.members?.includes(newMember.trim())) {
      const updatedMembers = [...(forumData.members || []), newMember.trim()];
      try {
        const forumRef = doc(db, "forums", forumId);
        await updateDoc(forumRef, { members: updatedMembers });
        // setForumMembers is updated by onSnapshot listener, so no need to call it here
        updateForumLastActivity(); // Update last activity on member change
      } catch (error) {
        console.error("Error adding member: ", error);
      }
    }
  };

  const handleRemoveMember = async (memberToRemove) => {
    if (forumData) {
      const updatedMembers = forumData.members.filter(member => member !== memberToRemove);
      try {
        const forumRef = doc(db, "forums", forumId);
        await updateDoc(forumRef, { members: updatedMembers });
        // setForumMembers is updated by onSnapshot listener
        updateForumLastActivity(); // Update last activity on member change
      } catch (error) {
        console.error("Error removing member: ", error);
      }
    }
  };

  if (!forumData) {
    return (
      <div style={getPageContainerStyle()}>
        <TopBar />
        <div style={{ textAlign: "center", padding: "50px", color: DESIGN_SYSTEM.colors.text.secondary }}>
          Loading forum details...
        </div>
      </div>
    );
  }

  return (
    <div style={getPageContainerStyle()}>
      <TopBar />
      <div style={{
        ...getContentContainerStyle(),
        paddingTop: DESIGN_SYSTEM.spacing['2xl']
      }}>
        {/* Enhanced Forum Header */}
        <div style={{
          background: DESIGN_SYSTEM.pageThemes.forums.gradient,
          borderRadius: DESIGN_SYSTEM.borderRadius.xl,
          padding: DESIGN_SYSTEM.spacing.xl,
          marginBottom: DESIGN_SYSTEM.spacing.lg,
          boxShadow: DESIGN_SYSTEM.shadows.lg,
          color: DESIGN_SYSTEM.colors.text.inverse
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div>
              <h1 style={{
                margin: `0 0 ${DESIGN_SYSTEM.spacing.xs} 0`,
                fontSize: DESIGN_SYSTEM.typography.fontSize['3xl'],
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.bold
              }}>
                {forumData?.name}
              </h1>
              <p style={{
                margin: 0,
                fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
                opacity: 0.9
              }}>
                {forumData?.description || 'Team collaboration space'} • {forumData?.members?.length || 0} members
              </p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              style={{
                ...getButtonStyle('primary', 'forums'),
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                padding: `${DESIGN_SYSTEM.spacing.base} ${DESIGN_SYSTEM.spacing.lg}`,
                fontSize: DESIGN_SYSTEM.typography.fontSize.base,
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold,
                borderRadius: DESIGN_SYSTEM.borderRadius.lg,
                color: DESIGN_SYSTEM.colors.text.inverse,
                boxShadow: "0 4px 15px rgba(255, 255, 255, 0.2)"
              }}
            >
              Invite Members
            </button>
          </div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr 300px",
          gridTemplateRows: "1fr",
          gap: DESIGN_SYSTEM.spacing.xl,
          minHeight: "calc(100vh - 300px)"
        }}>
        {/* Left column: Project Details + Reminders */}
        <div style={{ 
          position: "sticky",
          top: DESIGN_SYSTEM.spacing.xl,
          display: "flex", 
          flexDirection: "column", 
          gap: DESIGN_SYSTEM.spacing.base,
          height: "calc(150vh - 320px)", // 50% longer
          overflowY: "hidden"
        }}>
          {/* Project Details Section - 50% height */}
          <div style={{
            ...getCardStyle('forums'),
            height: "calc(50% - 8px)", // 50% minus half the gap
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{
              background: DESIGN_SYSTEM.pageThemes.forums.accent,
              color: DESIGN_SYSTEM.colors.text.inverse,
              padding: DESIGN_SYSTEM.spacing.base,
              borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`,
              flexShrink: 0
            }}>
              <h3 style={{
                margin: 0,
                fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold
              }}>
                Project Details
              </h3>
            </div>
            <div style={{ 
              flex: 1,
              overflow: "auto",
              padding: 0
            }}>
              {linkedProjectData ? (
                <div style={{ padding: '16px', height: '100%' }}>
                  <ProjectDetails 
                    project={linkedProjectData} 
                    readOnly={true}
                    noCard={true}
                  />
                </div>
              ) : (
                <div style={{
                  padding: DESIGN_SYSTEM.spacing.base,
                  textAlign: "center",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <p style={{ 
                    color: DESIGN_SYSTEM.colors.text.secondary, 
                    fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                    margin: 0
                  }}>
                    No project linked to this forum.
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Reminders Section - 50% height */}
          <div style={{
            ...getCardStyle('forums'),
            height: "calc(50% - 8px)", // 50% minus half the gap
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{
              background: DESIGN_SYSTEM.pageThemes.forums.accent,
              color: DESIGN_SYSTEM.colors.text.inverse,
              padding: DESIGN_SYSTEM.spacing.base,
              borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`,
              flexShrink: 0
            }}>
              <h3 style={{
                margin: 0,
                fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold
              }}>
                Reminders
              </h3>
            </div>
            <div style={{ 
              flex: 1,
              overflow: "auto",
              padding: 0
            }}>
              <ForumReminders forumId={forumId} />
            </div>
          </div>
        </div>

        {/* Middle Column - Main Forum Content */}
        <div style={{ 
          display: "flex", 
          flexDirection: "column",
          minHeight: "calc(100vh - 320px)"
        }}>
          <ForumTabs 
            forumData={forumData} 
            posts={posts} 
            setPosts={setPosts} 
            forumId={forumId} // Pass forumId to ForumTabs
            updateForumLastActivity={updateForumLastActivity} // Pass function to update last activity
            updateForumPostCount={updateForumPostCount} // Pass the new function
            currentUser={currentUser} // Pass currentUser from useAuth to ForumTabs
            enrichedForumMembersDetails={enrichedForumMembersDetails} // Pass enriched member details to ForumTabs
          />
        </div>

        {/* Right column: Online Members + Trending Posts */}
        <div style={{ 
          position: "sticky",
          top: DESIGN_SYSTEM.spacing.xl,
          display: "flex", 
          flexDirection: "column", 
          gap: DESIGN_SYSTEM.spacing.base,
          height: "calc(150vh - 320px)", // 50% longer
          overflowY: "hidden"
        }}>
          {/* Active Users Section - 50% height */}
          <div style={{
            ...getCardStyle('forums'),
            height: "calc(50% - 8px)", // 50% minus half the gap
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{
              background: DESIGN_SYSTEM.pageThemes.forums.accent,
              color: DESIGN_SYSTEM.colors.text.inverse,
              padding: DESIGN_SYSTEM.spacing.base,
              borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`,
              flexShrink: 0
            }}>
              <h3 style={{
                margin: 0,
                fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold
              }}>
                Active Members
              </h3>
            </div>
            <div style={{ 
              flex: 1,
              overflow: "auto",
              padding: 0
            }}>
              <ActiveUsers members={enrichedForumMembersDetails} />
            </div>
          </div>
          
          {/* Starred Posts Section - 50% height */}
          <div style={{
            ...getCardStyle('forums'),
            height: "calc(50% - 8px)", // 50% minus half the gap
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{
              background: DESIGN_SYSTEM.pageThemes.forums.accent,
              color: DESIGN_SYSTEM.colors.text.inverse,
              padding: DESIGN_SYSTEM.spacing.base,
              borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`,
              flexShrink: 0
            }}>
              <h3 style={{
                margin: 0,
                fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold
              }}>
                Starred Posts
              </h3>
            </div>
            <div style={{ 
              flex: 1,
              overflow: "auto",
              padding: 0
            }}>
              <StarredPosts onPostClick={handleTrendingPostClick} forumId={forumId} currentUser={currentUser} />
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Floating Create Button */}
      <FloatingCreateButton onClick={() => setShowCreateModal(true)} />

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        forumId={forumId}
        updateForumLastActivity={updateForumLastActivity}
        updateForumPostCount={updateForumPostCount}
        currentUser={currentUser}
      />

      {/* Invite Member Modal */}
      <InviteMemberModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        members={enrichedForumMembersDetails} // Pass enriched member details to InviteMemberModal
        onAddMember={handleAddMember}
        onRemoveMember={handleRemoveMember} // This will be ignored by InviteMemberModal, but kept for consistency if needed later
        forumId={forumId}
        forumName={forumData?.name}
        currentUser={currentUser}
      />
    </div>
  );
}
