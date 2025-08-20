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

  useEffect(() => {
    // Mock forum data - in real app this would come from backend
    setForums([
      {
        id: 1,
        name: "Project Alpha Discussion",
        memberCount: 24,
        description: "Main discussion forum for Project Alpha development and updates"
      },
      {
        id: 2,
        name: "Client Feedback Hub",
        memberCount: 18,
        description: "Centralized location for client feedback and responses"
      },
      {
        id: 3,
        name: "Team Updates",
        memberCount: 32,
        description: "Daily standups, announcements, and team coordination"
      },
      {
        id: 4,
        name: "Technical Support",
        memberCount: 15,
        description: "Technical issues, bug reports, and troubleshooting"
      },
      {
        id: 5,
        name: "Design Reviews",
        memberCount: 12,
        description: "UI/UX discussions, design feedback, and creative reviews"
      },
      {
        id: 6,
        name: "Marketing Strategy",
        memberCount: 8,
        description: "Marketing campaigns, social media, and promotional activities"
      }
    ]);
  }, []);

  const handleForumClick = (forum) => {
    if (onForumSelect) {
      onForumSelect(forum);
    }
  };

  return (
    <div
      style={{
        padding: "20px",
        backgroundColor: "#F8F9F9",
        borderRadius: "10px",
        height: "100%",
        overflow: "auto"
      }}
    >
      <h2
        style={{
          color: "#2C3E50",
          marginBottom: "20px",
          textAlign: "center"
        }}
      >
        Your Forums
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "20px",
          padding: "10px"
        }}
      >
        {forums.map((forum) => {
          const bgColor = stringToColor(forum.name);
          return (
            <div
              key={forum.id}
              style={{
                backgroundColor: "white",
                borderRadius: "10px",
                overflow: "hidden",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                cursor: "pointer"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
              }}
            >
              {/* Forum Logo (instead of picture) */}
              <div
                style={{
                  width: "100%",
                  height: "120px",
                  borderRadius: "0",
                  backgroundColor: bgColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "32px",
                  fontWeight: "bold",
                  color: "#fff"
                }}
              >
                {getInitials(forum.name)}
              </div>

              {/* Forum Content */}
              <div style={{ padding: "15px" }}>
                {/* Forum Name - Clickable */}
                <h3
                  onClick={() => handleForumClick(forum)}
                  style={{
                    margin: "0 0 10px 0",
                    color: "#2C3E50",
                    fontSize: "16px",
                    fontWeight: "600",
                    cursor: "pointer",
                    textDecoration: "none"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.color = "#3498DB";
                    e.target.style.textDecoration = "underline";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = "#2C3E50";
                    e.target.style.textDecoration = "none";
                  }}
                >
                  {forum.name}
                </h3>

                {/* Member Count */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    color: "#7F8C8D",
                    fontSize: "14px",
                    marginBottom: "8px"
                  }}
                >
                  <span style={{ marginRight: "5px" }}>👥</span>
                  <span>{forum.memberCount} members</span>
                </div>

                {/* Description */}
                <p
                  style={{
                    color: "#95A5A6",
                    fontSize: "12px",
                    margin: 0,
                    lineHeight: "1.4"
                  }}
                >
                  {forum.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
