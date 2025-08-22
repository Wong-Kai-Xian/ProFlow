import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import ForumList from "../components/ForumList";
import CreateForumModal from "../components/forum-component/CreateForumModal";
import { COLORS, BUTTON_STYLES, INPUT_STYLES } from "../components/profile-component/constants";
import { db } from "../firebase"; // Import db
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, query, serverTimestamp, where, getDoc } from "firebase/firestore"; // Import Firestore functions and query
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

export default function ForumListPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingForum, setEditingForum] = useState(null);
  const [forums, setForums] = useState([]); // Will be populated from Firebase
  const [projects, setProjects] = useState([]); // New state for projects
  const [joinForumId, setJoinForumId] = useState(''); // New state for join forum ID
  const [joinForumError, setJoinForumError] = useState(null); // New state for join forum error
  const navigate = useNavigate();
  const { currentUser } = useAuth(); // Get currentUser from AuthContext

  // Fetch forums from Firestore in real-time
  useEffect(() => {
    if (!currentUser) {
      setForums([]);
      setProjects([]);
      return;
    }

    const forumsCollectionRef = collection(db, "forums");
    const userForumsQuery = query(forumsCollectionRef, where("members", "array-contains", currentUser.uid)); // Filter by members array
    const unsubscribeForums = onSnapshot(userForumsQuery, (snapshot) => {
      const forumsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setForums(forumsData);
    });

    // Fetch projects for the dropdown (only projects associated with the current user)
    const projectsCollectionRef = collection(db, "projects");
    const userProjectsQuery = query(projectsCollectionRef, where("userId", "==", currentUser.uid));
    const unsubscribeProjects = onSnapshot(userProjectsQuery, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name, // Assuming projects have a 'name' field
      }));
      setProjects(projectsData);
    });

    // Cleanup subscriptions on unmount
    return () => {
      unsubscribeForums();
      unsubscribeProjects();
    };
  }, [currentUser]); // Add currentUser to dependency array

  const handleForumSelect = (forum) => {
    console.log("Selected forum:", forum);
    navigate(`/forum/${forum.id}`);
  };

  const handleCreateForum = async (newForumData) => {
    console.log("handleCreateForum called with data:", newForumData);
    if (!currentUser) {
      console.error("Cannot create forum: currentUser is null.");
      return; // Ensure user is logged in to create forums
    }
    try {
      await addDoc(collection(db, "forums"), {
        name: newForumData.name,
        description: newForumData.description || "",
        memberCount: newForumData.memberCount || 0, // Initialize memberCount
        notifications: newForumData.notifications || 0, // Initialize notifications
        lastActivity: serverTimestamp(), // Use serverTimestamp() for consistency
        members: newForumData.members || [], // Initialize members as array
        projectId: newForumData.projectId || null, // Store selected project ID, or null if 'Unknown'
        userId: currentUser.uid, // Associate forum with the current user
      });
      console.log("Forum successfully added to Firestore!");
      setShowCreateModal(false);
    } catch (error) {
      console.error("Error creating forum in handleCreateForum: ", error);
    }
  };

  const handleEditForum = (forum) => {
    setEditingForum(forum);
    setShowCreateModal(true);
  };

  const handleUpdateForum = async (updatedForumData) => {
    if (!currentUser || !editingForum) return; // Ensure user is logged in and editingForum exists
    try {
      if (editingForum && editingForum.id) {
        const forumRef = doc(db, "forums", editingForum.id);
        await updateDoc(forumRef, updatedForumData);
        setEditingForum(null);
        setShowCreateModal(false);
      }
    } catch (error) {
      console.error("Error updating forum: ", error);
    }
  };

  const handleDeleteForum = async (forumId) => {
    if (!currentUser) return; // Ensure user is logged in to delete forums
    try {
      await deleteDoc(doc(db, "forums", forumId));
    } catch (error) {
      console.error("Error deleting forum: ", error);
    }
  };

  const handleJoinForum = async () => {
    if (!joinForumId.trim() || !currentUser) {
      setJoinForumError('Please enter a valid Forum ID and ensure you are logged in.');
      return;
    }

    setJoinForumError(null);
    try {
      const forumRef = doc(db, 'forums', joinForumId);
      const forumSnap = await getDoc(forumRef);

      if (forumSnap.exists()) {
        const forumData = forumSnap.data();
        const currentMembers = forumData.members || [];

        if (currentMembers.includes(currentUser.uid)) {
          setJoinForumError('You are already a member of this forum.');
          return;
        }

        await updateDoc(forumRef, {
          members: [...currentMembers, currentUser.uid]
        });
        alert('Successfully joined forum!');
        setJoinForumId('');
        navigate(`/forum/${joinForumId}`); // Navigate to the joined forum
      } else {
        setJoinForumError('Forum not found.');
      }
    } catch (err) {
      console.error("Error joining forum:", err);
      setJoinForumError('Failed to join forum: ' + err.message);
    }
  };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", minHeight: "100vh", backgroundColor: COLORS.background }}>
      <TopBar />
      
      <div style={{ padding: "30px" }}>
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          marginBottom: "30px" 
        }}>
          <h1 style={{ 
            margin: 0, 
            color: COLORS.dark, 
            fontSize: "28px", 
            fontWeight: "700" 
          }}>
            Community
          </h1>
          {currentUser && (
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                ...BUTTON_STYLES.primary,
                padding: "12px 24px",
                fontSize: "16px",
                fontWeight: "600",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(52, 152, 219, 0.3)",
                transition: "all 0.3s ease"
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 6px 16px rgba(52, 152, 219, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 4px 12px rgba(52, 152, 219, 0.3)";
              }}
            >
              Create Forum
            </button>
          )}
        </div>

        {/* Join Forum Section */}
        {currentUser && (
          <div style={{ marginBottom: "30px", display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Enter Forum ID to join"
              value={joinForumId}
              onChange={(e) => setJoinForumId(e.target.value)}
              style={{
                ...INPUT_STYLES.base,
                flex: 1,
                maxWidth: "300px",
                padding: "12px 16px",
                fontSize: "16px",
                borderRadius: "8px",
                border: `2px solid ${COLORS.border}`,
              }}
            />
            <button 
              onClick={handleJoinForum}
              style={{
                ...BUTTON_STYLES.secondary,
                padding: "12px 24px",
                fontSize: "16px",
                fontWeight: "600",
                borderRadius: "8px",
              }}
            >
              Join Forum
            </button>
            {joinForumError && <p style={{ color: COLORS.danger, marginLeft: "10px" }}>{joinForumError}</p>}
          </div>
        )}
        
        {/* Full-width Forum List */}
        {forums.length === 0 && currentUser ? (
          <div style={{
            textAlign: "center",
            padding: "60px 20px",
            color: COLORS.lightText,
            fontSize: "18px"
          }}>
            No forums yet. Create your first forum or join one!
          </div>
        ) : forums.length === 0 && !currentUser ? (
          <div style={{
            textAlign: "center",
            padding: "60px 20px",
            color: COLORS.danger,
            fontSize: "18px"
          }}>
            Please log in to view and manage forums.
          </div>
        ) : (
          <ForumList 
            onForumSelect={handleForumSelect} 
            onEditForum={handleEditForum}
            onDeleteForum={handleDeleteForum} // Pass delete handler
            forums={forums} // Pass forums from Firebase
            projects={projects} // Pass projects to ForumList
          />
        )}
      </div>

      {/* Create/Edit Forum Modal */}
      <CreateForumModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingForum(null);
        }}
        onConfirm={editingForum ? handleUpdateForum : handleCreateForum}
        editingForum={editingForum}
        projects={projects} // Pass projects to the modal
      />
    </div>
  );
}
