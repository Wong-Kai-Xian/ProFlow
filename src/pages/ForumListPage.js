import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import ForumList from "../components/ForumList";
import CreateForumModal from "../components/forum-component/CreateForumModal";
import JoinForumModal from "../components/forum-component/JoinForumModal";
import { db } from "../firebase";
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, query, serverTimestamp, where, getDoc } from "firebase/firestore";
import { useAuth } from '../contexts/AuthContext';
import { DESIGN_SYSTEM, getPageContainerStyle, getCardStyle, getContentContainerStyle, getButtonStyle } from '../styles/designSystem';

export default function ForumListPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [editingForum, setEditingForum] = useState(null);
  const [forums, setForums] = useState([]); // Will be populated from Firebase
  const [projects, setProjects] = useState([]); // New state for projects
  const [joinForumError, setJoinForumError] = useState(null); // New state for join forum error
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [forumToDelete, setForumToDelete] = useState(null);
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
        createdAt: serverTimestamp(),
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

  const handleDeleteForum = (forumId) => {
    const forumToDelete = forums.find(f => f.id === forumId);
    setForumToDelete(forumToDelete);
    setShowDeleteConfirmation(true);
  };

  const confirmDeleteForum = async () => {
    if (!currentUser || !forumToDelete) return;
    try {
      await deleteDoc(doc(db, "forums", forumToDelete.id));
      setShowDeleteConfirmation(false);
      setForumToDelete(null);
    } catch (error) {
      console.error("Error deleting forum: ", error);
    }
  };

  const handleJoinForum = async (forumId) => {
    if (!forumId || !currentUser) {
      setJoinForumError('Please enter a valid Forum ID and ensure you are logged in.');
      return;
    }

    setJoinForumError(null);
    try {
      const forumRef = doc(db, 'forums', forumId);
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
        setShowJoinModal(false);
        navigate(`/forum/${forumId}`); // Navigate to the joined forum
      } else {
        setJoinForumError('Forum not found.');
      }
    } catch (err) {
      console.error("Error joining forum:", err);
      setJoinForumError('Failed to join forum: ' + err.message);
    }
  };

  return (
    <div style={getPageContainerStyle()}>
      <TopBar />
      
      <div style={{
        ...getContentContainerStyle(),
        paddingTop: DESIGN_SYSTEM.spacing['2xl'] // Reverted padding to original value
      }}>
        {/* Enhanced Header Section */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          marginBottom: DESIGN_SYSTEM.spacing.xl,
          background: DESIGN_SYSTEM.pageThemes.forums.gradient,
          padding: DESIGN_SYSTEM.spacing.xl,
          borderRadius: DESIGN_SYSTEM.borderRadius.xl,
          boxShadow: DESIGN_SYSTEM.shadows.lg
        }}>
          <div>
            <h1 style={{ 
              margin: `0 0 ${DESIGN_SYSTEM.spacing.xs} 0`, 
              color: DESIGN_SYSTEM.colors.text.inverse, 
              fontSize: DESIGN_SYSTEM.typography.fontSize['3xl'], 
              fontWeight: DESIGN_SYSTEM.typography.fontWeight.bold
            }}>
              Discussion Forums
            </h1>
            <p style={{
              margin: 0,
              color: "rgba(255,255,255,0.9)",
              fontSize: "16px"
            }}>
              Connect and collaborate with your team • {forums.length} forums available
            </p>
          </div>
          {currentUser && (
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => setShowJoinModal(true)}
                style={{
                  ...getButtonStyle('secondary', 'forums'),
                  background: "rgba(255,255,255,0.15)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255,255,255,0.3)",
                  padding: "12px 20px",
                  fontSize: "16px",
                  fontWeight: "600",
                  borderRadius: "12px",
                  color: "white",
                  transition: "all 0.3s ease"
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "rgba(255,255,255,0.25)";
                  e.target.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "rgba(255,255,255,0.15)";
                  e.target.style.transform = "translateY(0)";
                }}
              >
                Join Forum
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  ...getButtonStyle('primary', 'forums'),
                  background: "rgba(255,255,255,0.2)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255,255,255,0.3)",
                  padding: "12px 24px",
                  fontSize: "16px",
                  fontWeight: "600",
                  borderRadius: "12px",
                  color: "white",
                  transition: "all 0.3s ease"
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "rgba(255,255,255,0.3)";
                  e.target.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "rgba(255,255,255,0.2)";
                  e.target.style.transform = "translateY(0)";
                }}
              >
                Create Forum
              </button>
            </div>
          )}
        </div>

        
        
        {/* Full-width Forum List */}
        {forums.length === 0 && currentUser ? (
          <div style={{
            textAlign: "center",
            padding: "60px 20px",
            color: DESIGN_SYSTEM.colors.text.secondary,
            fontSize: "18px"
          }}>
            No forums yet. Create your first forum or join one!
          </div>
        ) : forums.length === 0 && !currentUser ? (
          <div style={{
            textAlign: "center",
            padding: "60px 20px",
            color: DESIGN_SYSTEM.colors.error,
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

      {/* Join Forum Modal */}
      <JoinForumModal
        isOpen={showJoinModal}
        onClose={() => {
          setShowJoinModal(false);
          setJoinForumError(null);
        }}
        onJoin={handleJoinForum}
        joinForumError={joinForumError}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && (
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
            padding: '32px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)'
          }}>
            <h3 style={{
              margin: '0 0 16px 0',
              color: DESIGN_SYSTEM.colors.error,
              fontSize: '20px',
              fontWeight: '700',
              textAlign: 'center'
            }}>
              Delete Forum
            </h3>
            <p style={{
              margin: '0 0 24px 0',
              color: DESIGN_SYSTEM.colors.text.primary,
              fontSize: '16px',
              lineHeight: '1.5',
              textAlign: 'center'
            }}>
              Are you sure you want to delete the forum "{forumToDelete?.name}"? This action cannot be undone and all posts and data will be permanently lost.
            </p>
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center'
            }}>
              <button
                onClick={() => {
                  setShowDeleteConfirmation(false);
                  setForumToDelete(null);
                }}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: `2px solid ${DESIGN_SYSTEM.colors.text.secondary}`,
                  backgroundColor: 'transparent',
                  color: DESIGN_SYSTEM.colors.text.secondary,
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = DESIGN_SYSTEM.colors.text.secondary;
                  e.target.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.color = DESIGN_SYSTEM.colors.text.secondary;
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteForum}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: DESIGN_SYSTEM.colors.error,
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#c0392b';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = DESIGN_SYSTEM.colors.error;
                }}
              >
                Delete Forum
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
