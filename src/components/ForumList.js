import React, { useState, useEffect } from "react";
import { COLORS, BUTTON_STYLES, INPUT_STYLES } from "./profile-component/constants";

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

export default function ForumList({ onForumSelect, onEditForum, customForums }) {
  const [forums, setForums] = useState([]);
  const [sortBy, setSortBy] = useState("alphabetic");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    // Mock forum data - in real app this would come from backend
    const defaultForums = [
      {
        id: 1,
        name: "Project Alpha Discussion",
        memberCount: 24,
        description: "Main discussion forum for Project Alpha development and updates",
        notifications: 5,
        lastActivity: "2025-01-20 14:30",
        members: ["Alice", "Bob", "Charlie", "David"]
      },
      {
        id: 2,
        name: "Client Feedback Hub",
        memberCount: 18,
        description: "Centralized location for client feedback and responses",
        notifications: 2,
        lastActivity: "2025-01-20 10:15",
        members: ["Eve", "Frank", "Grace"]
      },
      {
        id: 3,
        name: "Team Updates",
        memberCount: 32,
        description: "Daily standups, announcements, and team coordination",
        notifications: 8,
        lastActivity: "2025-01-20 16:45",
        members: ["Henry", "Iris", "Jack", "Kate", "Liam"]
      },
      {
        id: 4,
        name: "Technical Support",
        memberCount: 15,
        description: "Technical issues, bug reports, and troubleshooting",
        notifications: 0,
        lastActivity: "2025-01-19 09:20",
        members: ["Mia", "Noah", "Olivia"]
      },
      {
        id: 5,
        name: "Design Reviews",
        memberCount: 12,
        description: "UI/UX discussions, design feedback, and creative reviews",
        notifications: 3,
        lastActivity: "2025-01-20 11:30",
        members: ["Paul", "Quinn", "Rose"]
      },
      {
        id: 6,
        name: "Marketing Strategy",
        memberCount: 8,
        description: "Marketing campaigns, social media, and promotional activities",
        notifications: 1,
        lastActivity: "2025-01-18 15:00",
        members: ["Sam", "Tina"]
      }
    ];

    // Combine default forums with custom forums
    const allForums = [...defaultForums, ...(customForums || [])];
    setForums(allForums);
  }, [customForums]);

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
    <div>
      {/* Header */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        marginBottom: "30px"
      }}>
        
        {/* Sort Buttons */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button 
            style={{ 
              ...BUTTON_STYLES.secondary,
              backgroundColor: sortBy === "alphabetic" ? COLORS.primary : COLORS.light,
              color: sortBy === "alphabetic" ? COLORS.white : COLORS.dark,
              padding: "8px 16px",
              fontSize: "14px"
            }}
            onClick={() => setSortBy("alphabetic")}
          >
            Alphabetic
          </button>
          <button 
            style={{ 
              ...BUTTON_STYLES.secondary,
              backgroundColor: sortBy === "notifications" ? COLORS.primary : COLORS.light,
              color: sortBy === "notifications" ? COLORS.white : COLORS.dark,
              padding: "8px 16px",
              fontSize: "14px"
            }}
            onClick={() => setSortBy("notifications")}
          >
            Notifications
          </button>
          <button 
            style={{ 
              ...BUTTON_STYLES.secondary,
              backgroundColor: sortBy === "recent" ? COLORS.primary : COLORS.light,
              color: sortBy === "recent" ? COLORS.white : COLORS.dark,
              padding: "8px 16px",
              fontSize: "14px"
            }}
            onClick={() => setSortBy("recent")}
          >
            Recent Activity
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: "30px" }}>
        <input
          type="text"
          placeholder="Search forums..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            ...INPUT_STYLES.base,
            width: "100%",
            maxWidth: "400px",
            padding: "12px 16px",
            fontSize: "16px",
            borderRadius: "8px",
            border: `2px solid ${COLORS.border}`,
            transition: "border-color 0.3s ease"
          }}
          onFocus={(e) => {
            e.target.style.borderColor = COLORS.primary;
          }}
          onBlur={(e) => {
            e.target.style.borderColor = COLORS.border;
          }}
        />
      </div>

      {/* Forums Grid */}
      {filteredAndSortedForums.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "60px 20px",
          color: COLORS.lightText,
          fontSize: "18px"
        }}>
          {searchTerm ? `No forums found matching "${searchTerm}"` : "No forums available"}
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "24px",
          marginBottom: "30px"
        }}>
          {filteredAndSortedForums.map((forum) => {
            const bgColor = stringToColor(forum.name);
            return (
              <div
                key={forum.id}
                onClick={() => handleForumClick(forum)}
                style={{
                  position: "relative",
                  backgroundColor: COLORS.white,
                  borderRadius: "12px",
                  padding: "24px",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                  border: `1px solid ${COLORS.border}`,
                  cursor: "pointer",
                  transition: "all 0.3s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 8px 25px rgba(0, 0, 0, 0.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.08)";
                }}
              >
                {/* Edit Button */}
                {onEditForum && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditForum(forum);
                    }}
                    style={{
                      position: "absolute",
                      top: "16px",
                      right: "16px",
                      background: COLORS.light,
                      border: "none",
                      borderRadius: "6px",
                      padding: "6px 8px",
                      cursor: "pointer",
                      fontSize: "12px",
                      color: COLORS.dark,
                      transition: "all 0.2s ease",
                      zIndex: 1
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = COLORS.primary;
                      e.target.style.color = COLORS.white;
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = COLORS.light;
                      e.target.style.color = COLORS.dark;
                    }}
                  >
                    Edit
                  </button>
                )}
                {/* Notification Badge */}
                {forum.notifications > 0 && (
                  <div style={{
                    position: "absolute",
                    top: "16px",
                    right: onEditForum ? "60px" : "16px",
                    fontSize: "12px",
                    color: COLORS.white,
                    background: COLORS.danger,
                    borderRadius: "50%",
                    width: "24px",
                    height: "24px",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    fontWeight: "700"
                  }}>
                    {forum.notifications}
                  </div>
                )}

                {/* Forum Icon */}
                <div style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "12px",
                  backgroundColor: bgColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "32px",
                  fontWeight: "700",
                  color: COLORS.white,
                  marginBottom: "20px"
                }}>
                  {getInitials(forum.name)}
                </div>

                {/* Forum Content */}
                <h3 style={{
                  margin: "0 0 8px 0",
                  color: COLORS.dark,
                  fontSize: "20px",
                  fontWeight: "700",
                  lineHeight: "1.3"
                }}>
                  {forum.name}
                </h3>

                {/* Member Count */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  color: COLORS.lightText,
                  fontSize: "14px",
                  marginBottom: "12px",
                  fontWeight: "600"
                }}>
                  <span style={{ marginRight: "6px", fontSize: "16px" }}>👥</span>
                  <span>{forum.memberCount} members</span>
                </div>

                {/* Description */}
                <p style={{
                  color: COLORS.lightText,
                  fontSize: "15px",
                  margin: "0 0 16px 0",
                  lineHeight: "1.4",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden"
                }}>
                  {forum.description}
                </p>

                {/* Last Activity */}
                <div style={{
                  fontSize: "13px",
                  color: COLORS.lightText,
                  padding: "8px 12px",
                  backgroundColor: COLORS.light,
                  borderRadius: "6px",
                  fontWeight: "500"
                }}>
                  Last activity: {new Date(forum.lastActivity).toLocaleDateString()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
