import React, { useEffect, useState } from "react";
import Card from "./profile-component/Card"; // Corrected import path
import { COLORS, LAYOUT, BUTTON_STYLES } from "./profile-component/constants"; // Import constants
import AddGroupForumModal from "./project-component/AddGroupForumModal";

export default function GroupForum({ forumsData, projectName, onForumsUpdate }) {
  const [forums, setForums] = useState([]);
  const [sortBy, setSortBy] = useState("recent"); // recent or notifications
  const [showAddForumModal, setShowAddForumModal] = useState(false);

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

  const handleCreateNewForum = (forumName) => {
    const newForum = {
      id: Date.now(),
      title: forumName,
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
        <h3 style={{ margin: 0, color: COLORS.text }}>Group Forum</h3>
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
      <ul style={{ listStyle: 'none', padding: 0, maxHeight: "250px", overflowY: "auto", flexGrow: 1 }}>
        {sortForums().map((forum, index) => (
          <li key={index} style={{ 
            position: "relative",
            background: COLORS.cardBackground, 
            margin: LAYOUT.smallGap + " 0", 
            padding: `${LAYOUT.gap} ${LAYOUT.smallGap}`, 
            borderRadius: LAYOUT.borderRadius,
            borderLeft: `4px solid ${COLORS.primary}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
            transition: "all 0.2s ease",
            cursor: "pointer"
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = "translateY(-1px)";
            e.target.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.1)";
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = "translateY(0)";
            e.target.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.05)";
          }}>
            <div>
              <strong style={{ color: COLORS.text }}>{forum.title}</strong>
              <br />
              <small style={{ color: COLORS.lightText }}>
                {forum.posts} posts • Last activity: {forum.lastActivity}
              </small>
            </div>
            {forum.notifications > 0 && (
              <div style={{
                background: COLORS.danger,
                color: "white",
                borderRadius: "50%",
                width: "20px",
                height: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: "bold"
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
