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

export default function ForumList({ onForumSelect, onEditForum, onDeleteForum, forums, projects }) {
  // `forums` prop is now directly from Firebase via ForumListPage
  const [sortBy, setSortBy] = useState("alphabetic");
  const [searchTerm, setSearchTerm] = useState("");

  // Helper function to get project name by ID
  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    return project ? project.name : "Unknown Project";
  };

  // Remove the useEffect for mock data as data now comes from props
  // useEffect(() => {
  //   const defaultForums = [
  //     // ... mock data ...
  //   ];
  //   const allForums = [...defaultForums, ...(customForums || [])];
  //   setForums(allForums);
  // }, [customForums]);

  // Filter and sort forums - use the `forums` prop directly
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
        // Ensure lastActivity is a valid Date object for comparison
        return filtered.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
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

                {/* Delete Button */}
                {onDeleteForum && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteForum(forum.id);
                    }}
                    style={{
                      position: "absolute",
                      top: "16px",
                      right: onEditForum ? "50px" : "16px", // Adjust position if Edit button is present
                      background: COLORS.danger,
                      border: "none",
                      borderRadius: "6px",
                      padding: "6px 8px",
                      cursor: "pointer",
                      fontSize: "12px",
                      color: COLORS.white,
                      transition: "all 0.2s ease",
                      zIndex: 1
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = "#c0392b";
                      e.target.style.transform = "scale(1.05)";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = COLORS.danger;
                      e.target.style.transform = "scale(1)";
                    }}
                  >
                    Delete
                  </button>
                )}
                {/* Notification Badge */}
                {forum.notifications > 0 && (
                  <div style={{
                    position: "absolute",
                    top: "16px",
                    right: (onEditForum || onDeleteForum) ? "94px" : "16px", // Adjust position if Edit/Delete button is present
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

                {/* Project Name (if available) */}
                {forum.projectId && (
                  <div style={{
                    color: COLORS.primary,
                    fontSize: "13px",
                    marginBottom: "8px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                  }}>
                    <span style={{ marginRight: "6px", fontSize: "16px" }}>📁</span>
                    {getProjectName(forum.projectId)}
                  </div>
                )}

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
                  <span>{forum.members ? forum.members.length : 0} members</span> {/* Use forum.members.length */}
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
                  Last activity: {forum.lastActivity ? new Date(forum.lastActivity).toLocaleDateString() : 'N/A'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
