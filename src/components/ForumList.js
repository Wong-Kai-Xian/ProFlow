import React, { useState, useEffect } from "react";

// Get initials from forum name
const getInitials = (name) =>
  name
    .split(" ")
    .map((w) => w[0].toUpperCase())
    .join("");

// Generate a consistent color based on string
const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return "#" + "00000".substring(0, 6 - c.length) + c;
};

export default function ForumList({ onForumSelect }) {
  const [forums, setForums] = useState([]);
  const [sortBy, setSortBy] = useState("alphabetic");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    // Mock forum data - in real app this would come from backend
    setForums([
      {
        id: 1,
        name: "Project Alpha Discussion",
        memberCount: 24,
        description: "Main discussion forum for Project Alpha development and updates",
        notifications: 5,
        lastActivity: "2025-01-20 14:30"
      },
      {
        id: 2,
        name: "Client Feedback Hub",
        memberCount: 18,
        description: "Centralized location for client feedback and responses",
        notifications: 2,
        lastActivity: "2025-01-20 10:15"
      },
      {
        id: 3,
        name: "Team Updates",
        memberCount: 32,
        description: "Daily standups, announcements, and team coordination",
        notifications: 8,
        lastActivity: "2025-01-20 16:45"
      },
      {
        id: 4,
        name: "Technical Support",
        memberCount: 15,
        description: "Technical issues, bug reports, and troubleshooting",
        notifications: 0,
        lastActivity: "2025-01-19 09:20"
      },
      {
        id: 5,
        name: "Design Reviews",
        memberCount: 12,
        description: "UI/UX discussions, design feedback, and creative reviews",
        notifications: 3,
        lastActivity: "2025-01-20 11:30"
      },
      {
        id: 6,
        name: "Marketing Strategy",
        memberCount: 8,
        description: "Marketing campaigns, social media, and promotional activities",
        notifications: 1,
        lastActivity: "2025-01-18 15:00"
      }
    ]);
  }, []);

  // Filter and sort forums
  const getFilteredAndSortedForums = () => {
    let filtered = forums.filter(forum =>
      forum.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      forum.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort based on selected option
    switch (sortBy) {
      case "alphabetic":
        return filtered.sort((a, b) => a.name.localeCompare(b.name));
      case "notifications":
        return filtered.sort((a, b) => b.notifications - a.notifications);
      case "recent":
        return filtered.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
      default:
        return filtered;
    }
  };

  const handleForumClick = (forum) => {
    if (onForumSelect) {
      onForumSelect(forum);
    }
  };

  const filteredAndSortedForums = getFilteredAndSortedForums();

  return (
    <div style={{ 
      background: '#F8F9F9', 
      padding: '15px', 
      borderRadius: '10px', 
      display: "flex", 
      flexDirection: "column", 
      height: "100%", 
      overflowY: "auto"
    }}>
      {/* Title + Controls */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        marginBottom: "15px",
        flexWrap: "wrap",
        gap: "10px"
      }}>
        <h3 style={{ margin: 0, color: '#2C3E50' }}>Your Forums</h3>
        
        {/* Sort Buttons */}
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
          <button 
            style={{ 
              ...filterButtonStyle, 
              background: sortBy === "alphabetic" ? "#3498DB" : "#E0E0E0", 
              color: sortBy === "alphabetic" ? "#fff" : "#000" 
            }}
            onClick={() => setSortBy("alphabetic")}
          >
            Alphabetic
          </button>
          <button 
            style={{ 
              ...filterButtonStyle, 
              background: sortBy === "notifications" ? "#3498DB" : "#E0E0E0", 
              color: sortBy === "notifications" ? "#fff" : "#000" 
            }}
            onClick={() => setSortBy("notifications")}
          >
            Notifications
          </button>
          <button 
            style={{ 
              ...filterButtonStyle, 
              background: sortBy === "recent" ? "#3498DB" : "#E0E0E0", 
              color: sortBy === "recent" ? "#fff" : "#000" 
            }}
            onClick={() => setSortBy("recent")}
          >
            Recent Activity
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="Search forums..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 15px",
            borderRadius: "8px",
            border: "1px solid #BDC3C7",
            fontSize: "14px",
            outline: "none",
            boxSizing: "border-box"
          }}
        />
      </div>

      {/* Forums Grid - 4 per row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: "15px",
        flex: 1
      }}>
        {filteredAndSortedForums.length === 0 ? (
          <div style={{
            gridColumn: "1 / -1",
            textAlign: "center",
            color: "#7F8C8D",
            fontSize: "14px",
            fontStyle: "italic",
            padding: "40px 20px"
          }}>
            {searchTerm ? `No forums found matching "${searchTerm}"` : "No forums available"}
          </div>
        ) : (
          filteredAndSortedForums.map((forum) => {
          const bgColor = stringToColor(forum.name);
          return (
            <div
              key={forum.id}
              onClick={() => handleForumClick(forum)}
              style={{
                position: "relative",
                backgroundColor: "white",
                borderRadius: "8px",
                padding: "15px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                cursor: "pointer",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                display: "flex",
                flexDirection: "column",
                minHeight: "140px"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
              }}
            >
              {/* Notification Badge */}
              {forum.notifications > 0 && (
                <div style={{
                  position: "absolute",
                  top: "10px",
                  right: "10px",
                  fontSize: "12px",
                  color: "white",
                  background: "#E74C3C",
                  borderRadius: "50%",
                  width: "20px",
                  height: "20px",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  fontWeight: "bold"
                }}>
                  {forum.notifications}
                </div>
              )}

              {/* Forum Icon */}
              <div style={{
                width: "50px",
                height: "50px",
                borderRadius: "8px",
                backgroundColor: bgColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                fontWeight: "bold",
                color: "#fff",
                marginBottom: "10px"
              }}>
                {getInitials(forum.name)}
              </div>

              {/* Forum Content */}
              <div style={{ flex: 1 }}>
                {/* Forum Name */}
                <h4 style={{
                  margin: "0 0 8px 0",
                  color: "#2C3E50",
                  fontSize: "14px",
                  fontWeight: "600",
                  lineHeight: "1.2"
                }}>
                  {forum.name}
                </h4>

                {/* Member Count */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  color: "#7F8C8D",
                  fontSize: "12px",
                  marginBottom: "6px"
                }}>
                  <span style={{ marginRight: "4px" }}>👥</span>
                  <span>{forum.memberCount} members</span>
                </div>

                {/* Description */}
                <p style={{
                  color: "#95A5A6",
                  fontSize: "11px",
                  margin: "0 0 8px 0",
                  lineHeight: "1.3",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden"
                }}>
                  {forum.description}
                </p>

                {/* Last Activity */}
                <div style={{
                  fontSize: "10px",
                  color: "#BDC3C7",
                  marginTop: "auto"
                }}>
                  Last activity: {new Date(forum.lastActivity).toLocaleDateString()}
                </div>
              </div>
            </div>
          );
        })
        )}
      </div>
    </div>
  );
}

// Button styles (matching ProjectsTab)
const filterButtonStyle = {
  padding: "5px 10px",
  border: "none",
  borderRadius: "5px",
  cursor: "pointer",
  fontSize: "12px"
};
