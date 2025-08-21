import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "./profile-component/Card"; // Corrected import path
import { COLORS, LAYOUT, BUTTON_STYLES } from "./profile-component/constants"; // Import constants
import AddGroupForumModal from "./project-component/AddGroupForumModal";

const SCROLLBAR_STYLES = `
  /* Styles for scrollbar in Webkit browsers (Chrome, Safari, Edge, Opera) */
  .thin-scrollbar::-webkit-scrollbar {
    width: 5px; /* width of the scrollbar */
  }

  .thin-scrollbar::-webkit-scrollbar-track {
    background: #f1f1f1; /* Light grey track */
    border-radius: 10px;
  }

  .thin-scrollbar::-webkit-scrollbar-thumb {
    background: #888; /* Darker grey thumb */
    border-radius: 10px;
  }

  /* Handle on hover */
  .thin-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #555; /* Even darker grey on hover */
  }

  /* Firefox scrollbar styles */
  .thin-scrollbar {
    scrollbar-width: thin; /* "auto" or "thin" */
    scrollbar-color: #888 #f1f1f1; /* thumb and track color */
  }
`;

export default function GroupForum({ forumsData, projectName, onForumsUpdate }) {
  const [forums, setForums] = useState([]);
  const [sortBy, setSortBy] = useState("recent"); // recent or notifications
  const [showAddForumModal, setShowAddForumModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const defaultForums = [
      { title: "General Discussion", posts: 120, lastActivity: "1 hour ago", notifications: 10 },
      { title: "Announcements", posts: 50, lastActivity: "3 hours ago", notifications: 5 },
      { title: "Feature Requests", posts: 80, lastActivity: "1 day ago", notifications: 3 },
      { title: "Bug Reports", posts: 30, lastActivity: "2 days ago", notifications: 1 },
    ];
    setForums(forumsData && forumsData.length > 0 ? forumsData : defaultForums);
  }, [forumsData]);

  const sortForums = () => {
    let sorted = [...forums];
    if (sortBy === "recent") {
      // Here we just keep the mock order; in real, sort by date
      sorted.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
    } else if (sortBy === "notifications") {
      sorted.sort((a, b) => b.notifications - a.notifications);
    }
    return sorted;
  };

  const handleCreateNewForum = (forumData) => {
    const newForum = {
      id: Date.now(),
      title: typeof forumData === 'string' ? forumData : forumData.name,
      description: forumData.description || '',
      members: forumData.members || [],
      posts: 0,
      lastActivity: "Just now",
      notifications: 0
    };
    const updatedForums = [newForum, ...forums];
    setForums(updatedForums);
    // Notify parent component if callback provided
    if (onForumsUpdate) {
      onForumsUpdate(updatedForums);
    }
  };

  const handleAddExistingForum = (forumId) => {
    // In a real app, this would fetch the forum data from backend
    const mockExistingForums = [
      { id: 'forum1', name: 'General Discussion' },
      { id: 'forum2', name: 'Technical Support' },
      { id: 'forum3', name: 'Feature Requests' },
    ];
    
    const existingForum = mockExistingForums.find(forum => forum.id === forumId);
    if (existingForum) {
      const newForum = {
        id: forumId,
        title: existingForum.name,
        posts: 25,
        lastActivity: "2 hours ago",
        notifications: 2
      };
      const updatedForums = [newForum, ...forums];
      setForums(updatedForums);
      // Notify parent component if callback provided
      if (onForumsUpdate) {
        onForumsUpdate(updatedForums);
      }
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
      {/* Header with top-right button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: LAYOUT.smallGap }}>
        <h3 style={{ margin: 0, color: COLORS.dark, fontSize: "16px", fontWeight: "700" }}>Group Forum</h3>
        <div style={{ display: "flex", gap: LAYOUT.smallGap, alignItems: "center" }}>
          <button 
            onClick={() => setSortBy(sortBy === "recent" ? "notifications" : "recent")} 
            style={{
              ...BUTTON_STYLES.tertiary,
              padding: "4px 8px",
              fontSize: "11px",
              minWidth: "auto"
            }}
            title={`Currently sorting by: ${sortBy === "recent" ? "Recent" : "Notifications"}`}
          >
            🔄
          </button>
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
            Add Forum
          </button>
        </div>
      </div>

      {/* Forum List */}
      <ul style={{ listStyle: 'none', padding: 0, maxHeight: "250px", overflowY: "auto", flexGrow: 1 }} className="thin-scrollbar"> {/* Applied thin-scrollbar class */}
        {sortForums().map((forum, index) => (
          <li key={index} style={{ 
            position: "relative",
            background: COLORS.cardBackground, 
            margin: LAYOUT.smallGap + " 0", 
            padding: `${LAYOUT.gap} 15px`, // Adjusted horizontal padding
            borderRadius: LAYOUT.borderRadius,
            borderLeft: `4px solid ${COLORS.primary}`,
            display: 'flex',
            flexDirection: 'column', // Change to column to stack elements
            alignItems: 'flex-start', // Align items to the start
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
            transition: "all 0.2s ease",
            cursor: "pointer"
          }}
          onClick={() => navigate('/forum/1')}
          onMouseEnter={(e) => {
            e.target.style.transform = "translateY(-1px)";
            e.target.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.1)";
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = "translateY(0)";
            e.target.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.05)";
          }}>
            <div>
              <strong style={{ color: COLORS.dark, fontSize: "14px", fontWeight: "600" }}>{forum.title}</strong>
              <br />
              <small style={{ color: COLORS.lightText, fontSize: "12px" }}>
                {forum.posts} posts
                <br /> {/* New line for last activity */}
                Last activity: {forum.lastActivity}
              </small>
            </div>
            {forum.notifications > 0 && (
              <div style={{
                position: "absolute",
                top: "8px", // Adjusted position
                right: "8px", // Adjusted position
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
                zIndex: 1 /* Ensure it's above other content */
              }}>
                {forum.notifications}
              </div>
            )}
          </li>
        ))}
      </ul>
      {projectName && (
        <div style={{ marginTop: LAYOUT.smallGap, textAlign: "center", color: COLORS.lightText, fontSize: "12px" }}>
          Forum for: <strong>{projectName}</strong>
        </div>
      )}

      {/* Embed the scrollbar styles */}
      <style>{SCROLLBAR_STYLES}</style>

      {/* Add Forum Modal */}
      <AddGroupForumModal
        isOpen={showAddForumModal}
        onClose={() => setShowAddForumModal(false)}
        onCreateNewForum={handleCreateNewForum}
        onAddExistingForum={handleAddExistingForum}
      />
    </Card>
  );
}
