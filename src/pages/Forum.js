import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import TopBar from "../components/TopBar";
import ForumTabs from "../components/ForumTabs";
import ProjectDetails from "../components/project-component/ProjectDetails";
import ForumReminders from "../components/forum-tabs/ForumReminders";
import StarredPosts from "../components/forum-tabs/StarredPosts"; // Updated import
import ActiveUsers from "../components/forum-tabs/ActiveUsers";
import FloatingCreateButton from "../components/forum-tabs/FloatingCreateButton";
import CreatePostModal from "../components/forum-tabs/CreatePostModal";
import InviteMemberModal from "../components/forum-component/InviteMemberModal"; // Import the new InviteMemberModal
import { COLORS, BUTTON_STYLES } from "../components/profile-component/constants";
import { db } from "../firebase";
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, getDocs, getDoc } from "firebase/firestore"; // Import collection, getDocs, getDoc
import { useAuth } from "../contexts/AuthContext"; // Import useAuth

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
    return <div style={{ textAlign: "center", padding: "50px", color: COLORS.lightText }}>Loading forum details...</div>;
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif' }}>
      <TopBar />
      <div style={{
        display: "grid",
        gridTemplateColumns: "280px 1fr 280px",
        gridTemplateRows: "auto 1fr",
        gap: "20px",
        padding: "10px",
        minHeight: "90vh"
      }}>
        {/* Left column: Project Details + Reminders */}
        <div style={{ gridColumn: 1, gridRow: "1 / span 2", display: "flex", flexDirection: "column", gap: "8px", overflowY: "auto" }}>
          {/* Render ProjectDetails with linkedProjectData and no onSave/allProjectNames */}
          {linkedProjectData ? (
            <ProjectDetails 
              project={linkedProjectData} 
              readOnly={true} // Ensure ProjectDetails is read-only in the forum context
            />
          ) : (
            <div style={{
              backgroundColor: COLORS.white,
              borderRadius: '10px',
              padding: '15px',
              marginBottom: '15px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              border: '1px solid #ECF0F1'
            }}>
              <h3 style={{ margin: 0, color: COLORS.dark, fontSize: "16px", fontWeight: "700" }}>Project Details</h3>
              <p style={{ color: COLORS.lightText, fontSize: "14px" }}>No project linked.</p>
            </div>
          )}
          <ForumReminders forumId={forumId} /> {/* Moved ForumReminders here */}
        </div>

        {/* Middle Column - Tabbed Content (Posts Focus) */}
        <div style={{ gridColumn: 2, gridRow: "1 / span 2" }}>
          {/* Forum Header with Manage Members Button */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
            padding: "16px 20px",
            backgroundColor: COLORS.white,
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)"
          }}>
            <div>
              <h2 style={{ 
                margin: "0 0 4px 0", 
                color: COLORS.dark, 
                fontSize: "20px", 
                fontWeight: "700" 
              }}>
                {forumData?.name}
              </h2>
              <p style={{ 
                margin: 0, 
                color: COLORS.lightText, 
                fontSize: "14px" 
              }}>
                {forumData?.members?.length || 0} members
              </p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)} // Open the new InviteMemberModal
              style={{
                ...BUTTON_STYLES.primary,
                padding: "10px 16px",
                fontSize: "14px",
                fontWeight: "600"
              }}
            >
              Invite Members
            </button>
          </div>
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
        <div style={{ gridColumn: 3, gridRow: "1 / span 2", display: "flex", flexDirection: "column", gap: "8px", overflowY: "auto" }}>
          <ActiveUsers members={enrichedForumMembersDetails} />
          <StarredPosts onPostClick={handleTrendingPostClick} forumId={forumId} currentUser={currentUser} />
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
      />
    </div>
  );
}
