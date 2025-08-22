import React, { useState, useEffect } from "react";
import { COLORS, BUTTON_STYLES, INPUT_STYLES } from "./profile-component/constants";
import { FaTrash } from 'react-icons/fa'; // Import FaTrash icon

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
                  backgroundColor: "white",
                  borderRadius: "16px",
                  padding: "0",
                  boxShadow: "0 8px 30px rgba(0, 0, 0, 0.08)",
                  border: "1px solid #f0f2f5",
                  cursor: "pointer",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  overflow: "hidden"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-8px)";
                  e.currentTarget.style.boxShadow = "0 20px 40px rgba(0, 0, 0, 0.15)";
                  e.currentTarget.style.borderColor = "#e3f2fd";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 8px 30px rgba(0, 0, 0, 0.08)";
                  e.currentTarget.style.borderColor = "#f0f2f5";
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
                      background: COLORS.danger, // Red background
                      border: "none",
                      cursor: "pointer",
                      color: COLORS.white, // White icon color
                      fontSize: "14px", // Match edit button font size for visual consistency
                      padding: "6px 8px", // Match edit button padding
                      borderRadius: "6px", // Make it square with rounded corners
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "background-color 0.2s ease",
                      zIndex: 1,
                      '&:hover': {
                        backgroundColor: "#c0392b", // Darker red on hover
                      }
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#c0392b";
                      e.currentTarget.style.transform = "scale(1.05)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = COLORS.danger; // Revert to original red on mouse leave
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    <FaTrash />
                  </button>
                )}
                {/* Notification Badge */}
                {forum.notifications > 0 && (
                  <div style={{
                    position: "absolute",
                    top: "16px",
                    right: (onEditForum || onDeleteForum) ? (onEditForum && onDeleteForum ? "94px" : "50px") : "16px", // Adjust position if Edit/Delete button is present
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

                {/* Card Header with Gradient */}
                <div style={{
                  background: `linear-gradient(135deg, ${bgColor}15, ${bgColor}25)`,
                  padding: "24px 24px 20px 24px",
                  position: "relative"
                }}>
                  {/* Forum Badge */}
                  <div style={{
                    display: "inline-block",
                    padding: "8px 16px",
                    borderRadius: "20px",
                    backgroundColor: bgColor,
                    color: "white",
                    fontSize: "12px",
                    fontWeight: "600",
                    marginBottom: "16px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    boxShadow: `0 4px 12px ${bgColor}40`
                  }}>
                    {forum.projectId ? 'Project Forum' : 'General Forum'}
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
                </div>

                {/* Card Body */}
                <div style={{ padding: "0 24px 24px 24px" }}>

                {/* Forum ID - Clickable to Copy */}
                <div style={{ marginBottom: "16px" }}>
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(forum.id).then(() => {
                        // Create a temporary tooltip
                        const tooltip = document.createElement('div');
                        tooltip.textContent = 'Forum ID Copied!';
                        tooltip.style.cssText = `
                          position: fixed;
                          background: #10b981;
                          color: white;
                          padding: 8px 12px;
                          border-radius: 6px;
                          font-size: 12px;
                          font-weight: 500;
                          z-index: 9999;
                          top: ${e.clientY - 50}px;
                          left: ${e.clientX - 50}px;
                          pointer-events: none;
                          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
                        `;
                        document.body.appendChild(tooltip);
                        setTimeout(() => document.body.removeChild(tooltip), 2000);
                      }).catch(() => {
                        alert('Failed to copy Forum ID');
                      });
                    }}
                    style={{
                      fontSize: "13px",
                      color: "#059669",
                      wordBreak: "break-all",
                      cursor: "pointer",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #d1fae5",
                      backgroundColor: "#ecfdf5",
                      transition: "all 0.2s ease",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontWeight: "500"
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = "#d1fae5";
                      e.target.style.borderColor = "#a7f3d0";
                      e.target.style.transform = "translateY(-1px)";
                      e.target.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.15)";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = "#ecfdf5";
                      e.target.style.borderColor = "#d1fae5";
                      e.target.style.transform = "translateY(0)";
                      e.target.style.boxShadow = "none";
                    }}
                  >
                    <span style={{ fontWeight: "600" }}>Forum ID: {forum.id}</span>
                    <span style={{ 
                      fontSize: "11px", 
                      opacity: 0.7,
                      fontStyle: "italic",
                      color: "#047857"
                    }}>
                      click to copy
                    </span>
                  </div>
                </div>

                {/* Project Name (if available) */}
                {forum.projectId && (
                  <div style={{
                    color: COLORS.primary,
                    fontSize: "13px",
                    fontWeight: "600",
                    marginBottom: "12px",
                    background: `linear-gradient(135deg, ${COLORS.primary}15, ${COLORS.primary}25)`,
                    padding: "8px 12px",
                    borderRadius: "8px",
                    display: "inline-block",
                    border: `1px solid ${COLORS.primary}30`
                  }}>
                    Project: {getProjectName(forum.projectId)}
                  </div>
                )}

                {/* Stats Row */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  marginBottom: "16px",
                  fontSize: "13px"
                }}>
                  <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    backgroundColor: "#f0f9ff",
                    borderRadius: "6px",
                    border: "1px solid #e0f2fe"
                  }}>
                    <span style={{ fontWeight: "600", color: "#0369a1" }}>Members</span>
                    <span style={{ fontWeight: "700", color: "#0c4a6e" }}>{forum.members ? forum.members.length : 0}</span>
                  </div>
                  <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    backgroundColor: "#f0fdf4",
                    borderRadius: "6px",
                    border: "1px solid #dcfce7"
                  }}>
                    <span style={{ fontWeight: "600", color: "#16a34a" }}>Posts</span>
                    <span style={{ fontWeight: "700", color: "#15803d" }}>{forum.posts || 0}</span>
                  </div>
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
                  padding: "12px 16px",
                  backgroundColor: "#f8f9fb",
                  borderRadius: "8px",
                  fontWeight: "500",
                  marginTop: "16px"
                }}>
                  Last activity: {forum.lastActivity ? new Date(forum.lastActivity).toLocaleDateString() : 'Recently'}
                </div>
                </div> {/* Close card body */}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
