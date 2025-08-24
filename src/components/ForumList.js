import React, { useState, useEffect } from "react";
import { DESIGN_SYSTEM, getCardStyle, getButtonStyle } from '../styles/designSystem';
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
              ...getButtonStyle('secondary', 'forums'),
              backgroundColor: sortBy === "alphabetic" ? DESIGN_SYSTEM.colors.primary[500] : DESIGN_SYSTEM.colors.background.secondary,
              color: sortBy === "alphabetic" ? DESIGN_SYSTEM.colors.text.inverse : DESIGN_SYSTEM.colors.text.primary,
              padding: "8px 16px",
              fontSize: "14px"
            }}
            onClick={() => setSortBy("alphabetic")}
          >
            Alphabetic
          </button>
          <button 
            style={{ 
              ...getButtonStyle('secondary', 'forums'),
              backgroundColor: sortBy === "notifications" ? DESIGN_SYSTEM.colors.primary[500] : DESIGN_SYSTEM.colors.background.secondary,
              color: sortBy === "notifications" ? DESIGN_SYSTEM.colors.text.inverse : DESIGN_SYSTEM.colors.text.primary,
              padding: "8px 16px",
              fontSize: "14px"
            }}
            onClick={() => setSortBy("notifications")}
          >
            Notifications
          </button>
          <button 
            style={{ 
              ...getButtonStyle('secondary', 'forums'),
              backgroundColor: sortBy === "recent" ? DESIGN_SYSTEM.colors.primary[500] : DESIGN_SYSTEM.colors.background.secondary,
              color: sortBy === "recent" ? DESIGN_SYSTEM.colors.text.inverse : DESIGN_SYSTEM.colors.text.primary,
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
            fontFamily: DESIGN_SYSTEM.typography.fontFamily.primary,
            width: "100%",
            maxWidth: "400px",
            padding: "12px 16px",
            fontSize: "16px",
            borderRadius: "8px",
            border: `2px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
            transition: "border-color 0.3s ease"
          }}
          onFocus={(e) => {
            e.target.style.borderColor = DESIGN_SYSTEM.colors.primary[500];
          }}
          onBlur={(e) => {
            e.target.style.borderColor = DESIGN_SYSTEM.colors.secondary[300];
          }}
        />
      </div>

      {/* Forums Grid */}
      {filteredAndSortedForums.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "60px 20px",
          color: DESIGN_SYSTEM.colors.background.secondaryText,
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
                      background: DESIGN_SYSTEM.colors.background.secondary,
                      border: "none",
                      borderRadius: "6px",
                      padding: "6px 8px",
                      cursor: "pointer",
                      fontSize: "12px",
                      color: DESIGN_SYSTEM.colors.text.primary,
                      transition: "all 0.2s ease",
                      zIndex: 1
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = DESIGN_SYSTEM.colors.primary[500];
                      e.target.style.color = DESIGN_SYSTEM.colors.text.inverse;
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = DESIGN_SYSTEM.colors.background.secondary;
                      e.target.style.color = DESIGN_SYSTEM.colors.text.primary;
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
                      background: DESIGN_SYSTEM.colors.error, // Red background
                      border: "none",
                      cursor: "pointer",
                      color: DESIGN_SYSTEM.colors.text.inverse, // White icon color
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
                      e.currentTarget.style.backgroundColor = DESIGN_SYSTEM.colors.error; // Revert to original red on mouse leave
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
                    color: DESIGN_SYSTEM.colors.text.inverse,
                    background: DESIGN_SYSTEM.colors.error,
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
                    color: DESIGN_SYSTEM.colors.text.primary,
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
                <div style={{ 
                  marginBottom: DESIGN_SYSTEM.spacing.base, // Reduced margin bottom
                  marginTop: DESIGN_SYSTEM.spacing.lg // Increased margin top to move it lower further
                }}>
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
                    <span style={{ fontWeight: "600" }}>Click to copy Forum ID</span>
                    {/* <span style={{ 
                      fontSize: "11px", 
                      opacity: 0.7,
                      fontStyle: "italic",
                      color: "#047857"
                    }}>
                      click to copy
                    </span> */}
                  </div>
                </div>

                {/* Project Name (if available) */}
                {(forum.projectId || !forum.projectId) && (
                  <div style={{
                    color: DESIGN_SYSTEM.colors.primary[500],
                    fontSize: "13px",
                    fontWeight: "600",
                    marginBottom: "12px",
                    background: `linear-gradient(135deg, ${DESIGN_SYSTEM.colors.primary[500]}15, ${DESIGN_SYSTEM.colors.primary[500]}25)`,
                    padding: "8px 12px",
                    borderRadius: "8px",
                    display: "inline-block",
                    border: `1px solid ${DESIGN_SYSTEM.colors.primary[500]}30`
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
                    <span style={{ fontWeight: "700", color: "#15803d" }}>{typeof forum.actualPostCount === 'number' ? forum.actualPostCount : (forum.posts || 0)}</span>
                  </div>
                </div>

                {/* Description */}
                <div style={{
                  backgroundColor: "#f8f9fb",
                  borderRadius: "8px",
                  padding: "16px",
                  margin: "0 0 16px 0",
                  minHeight: "80px",
                  border: "1px solid #e2e8f0"
                }}>
                  <h4 style={{
                    margin: "0 0 8px 0",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: DESIGN_SYSTEM.colors.text.primary
                  }}>
                    Description
                  </h4>
                  <p style={{
                    color: DESIGN_SYSTEM.colors.background.secondaryText,
                    fontSize: "14px",
                    margin: "0",
                    lineHeight: "1.5",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden"
                  }}>
                    {forum.description || "No description available"}
                  </p>
                </div>

                {/* Last Activity */}
                <div style={{
                  fontSize: "13px",
                  color: DESIGN_SYSTEM.colors.background.secondaryText,
                  padding: "12px 16px",
                  backgroundColor: "#f0f9ff",
                  borderRadius: "8px",
                  fontWeight: "500",
                  border: "1px solid #e0f2fe"
                }}>
                  Last activity: {(() => {
                    if (!forum.lastActivity) return 'No recent activity';
                    try {
                      const date = forum.lastActivity.toDate ? forum.lastActivity.toDate() : new Date(forum.lastActivity);
                      if (isNaN(date.getTime())) return 'Invalid date';
                      return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    } catch (error) {
                      return 'Invalid date';
                    }
                  })()}
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
