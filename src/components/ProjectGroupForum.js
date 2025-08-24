import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "./profile-component/Card";
import { COLORS, LAYOUT, BUTTON_STYLES } from "./profile-component/constants";
import AddGroupForumModal from "./project-component/AddGroupForumModal";

import { db } from "../firebase";
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";

export default function ProjectGroupForum({ projectId, forums }) {

  const [showAddForumModal, setShowAddForumModal] = useState(false);
  const [projects, setProjects] = useState([]); // State for projects (for the modal dropdown)
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  useEffect(() => {
    // Fetch all projects for the dropdown (this part remains, as projects are not passed as prop)
    const projectsCollectionRef = collection(db, "projects");
    const unsubscribeProjects = onSnapshot(projectsCollectionRef, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
      }));
      setProjects(projectsData);
    });

    return () => {
      unsubscribeProjects();
    };
  }, []);

  const getActivityDate = (forum) => {
    const postCount = forum.posts || 0;
    
    if (postCount > 0) {
      // Show last activity if there are posts
      if (forum.lastActivity && typeof forum.lastActivity.toDate === 'function') {
        return forum.lastActivity.toDate().toLocaleString();
      }
    }
    
    // Show creation date if no posts or no lastActivity
    if (forum.createdAt && typeof forum.createdAt.toDate === 'function') {
      return forum.createdAt.toDate().toLocaleString();
    } else if (forum.timestamp && typeof forum.timestamp.toDate === 'function') {
      return forum.timestamp.toDate().toLocaleString();
    }
    
    return 'N/A';
  };

  const sortForums = () => {
    if (!Array.isArray(forums)) return [];
    let sorted = [...forums];
    // Sort by recent activity by default
    sorted.sort((a, b) => {
      const dateA = a.lastActivity && typeof a.lastActivity.toDate === 'function' ? a.lastActivity.toDate() : new Date(0);
      const dateB = b.lastActivity && typeof b.lastActivity.toDate === 'function' ? b.lastActivity.toDate() : new Date(0);
      return dateB - dateA;
    });
    return sorted;
  };

  const handleCreateNewForum = async (forumData) => {
    if (!projectId || !currentUser) return; // Only allow creating forum if projectId and currentUser present
    try {
      // Include current user in forum members automatically
      const forumMembers = forumData.members || [];
      if (!forumMembers.includes(currentUser.uid)) {
        forumMembers.push(currentUser.uid);
      }
      
      const newForum = {
        name: typeof forumData === 'string' ? forumData : forumData.name,
        description: forumData.description || '',
        members: forumMembers,
        memberCount: forumMembers.length,
        notifications: 0,
        posts: 0,
        lastActivity: serverTimestamp(),
        projectId: projectId,
        userId: currentUser.uid, // Add creator
      };
      const docRef = await addDoc(collection(db, "forums"), newForum);
      console.log("New project-specific forum added with ID: ", docRef.id);
      setShowAddForumModal(false);
    } catch (error) {
      console.error("Error creating new forum: ", error);
      alert("Failed to create forum. Please try again.");
    }
  };

  return (
    <Card style={{
      height: "100%",
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
    }}>
      {/* Header with Add button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: LAYOUT.smallGap }}>
        <h3 style={{ margin: 0, color: COLORS.dark, fontSize: "18px", fontWeight: "700", whiteSpace: "nowrap" }}>Project Forum</h3>
        <div style={{ display: "flex", gap: LAYOUT.smallGap, alignItems: "center" }}>
          {projectId && (
            <button
              onClick={() => setShowAddForumModal(true)}
              style={{
                ...BUTTON_STYLES.success,
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: "600",
                borderRadius: "20px",
                background: `linear-gradient(135deg, ${COLORS.success} 0%, #229954 100%)`,
                boxShadow: "0 2px 8px rgba(39, 174, 96, 0.3)",
                transition: "all 0.3s ease",
                border: "none",
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = "translateY(-1px)";
                e.target.style.boxShadow = "0 4px 12px rgba(39, 174, 96, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 2px 8px rgba(39, 174, 96, 0.3)";
              }}
            >
              Add
            </button>
          )}
        </div>
      </div>

      {/* Forum List */}
      <ul style={{ listStyle: 'none', padding: 0, maxHeight: "250px", overflowY: "auto", flexGrow: 1 }} className="thin-scrollbar">
        {sortForums().map((forum) => (
          <li key={forum.id} style={{
            position: "relative",
            background: COLORS.cardBackground,
            margin: LAYOUT.smallGap + " 0",
            padding: `${LAYOUT.gap} 15px`,
            borderRadius: LAYOUT.borderRadius,
            borderLeft: `4px solid ${COLORS.primary}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
            transition: "all 0.2s ease",
            cursor: "pointer"
          }}
          onClick={() => navigate(`/forum/${forum.id}`)}
          onMouseEnter={(e) => {
            e.target.style.transform = "translateY(-1px)";
            e.target.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.1)";
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = "translateY(0)";
            e.target.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.05)";
          }}>
            <div>
              <strong style={{ color: COLORS.dark, fontSize: "14px", fontWeight: "600" }}>{forum.name}</strong>
              <br />
              <small style={{ color: COLORS.lightText, fontSize: "12px" }}>
                {(forum.posts || 0)} posts
                <br />
                {(forum.posts || 0) > 0 ? 'Last activity: ' : 'Created: '}{getActivityDate(forum)}
              </small>
            </div>
            {forum.notifications > 0 && (
              <div style={{
                position: "absolute",
                top: "8px",
                right: "8px",
                background: COLORS.danger,
                color: "white",
                borderRadius: "50%",
                width: "20px",
                height: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: "bold",
                zIndex: 1
              }}>
                {forum.notifications}
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* Add Forum Modal */}
      {projectId && (
        <AddGroupForumModal
          isOpen={showAddForumModal}
          onClose={() => setShowAddForumModal(false)}
          onCreateNewForum={handleCreateNewForum}
          projects={projects}
          defaultProjectId={projectId}
        />
      )}
    </Card>
  );
}
