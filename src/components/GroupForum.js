import React, { useEffect, useState } from "react";
import Card from "./profile-component/Card"; // Corrected import path
import { COLORS, LAYOUT, BUTTON_STYLES } from "./profile-component/constants"; // Import constants

export default function GroupForum() {
  const [forums, setForums] = useState([]);
  const [sortBy, setSortBy] = useState("recent"); // recent or notifications

  useEffect(() => {
    // Mock forum data
    setForums([
      { title: "Project Alpha Discussion", posts: 12, lastActivity: "2 hours ago", notifications: 3 },
      { title: "Client Feedback Thread", posts: 8, lastActivity: "5 hours ago", notifications: 1 },
      { title: "Team Updates", posts: 15, lastActivity: "1 day ago", notifications: 0 },
      { title: "Technical Issues", posts: 6, lastActivity: "3 days ago", notifications: 2 }
    ]);
  }, []);

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

  return (
    <Card style={{
      height: "100%",
      overflowY: "auto"
    }}>
      {/* Header with top-right button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: LAYOUT.smallGap }}>
        <h3 style={{ margin: 0, color: COLORS.text }}>Group Forum</h3>
        <button 
          onClick={() => setSortBy(sortBy === "recent" ? "notifications" : "recent")} 
          style={{
            ...BUTTON_STYLES.secondary,
            background: BUTTON_STYLES.secondary.background, // Maintain secondary button background
            color: BUTTON_STYLES.secondary.color, // Maintain secondary button text color
            padding: "5px 10px",
            fontSize: "12px"
          }}
        >
          Sort: {sortBy === "recent" ? "Recent" : "Notifications"}
        </button>
      </div>

      {/* Forum List */}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {sortForums().map((forum, index) => (
          <li key={index} style={{ 
            position: "relative",
            background: COLORS.cardBackground, 
            margin: LAYOUT.smallGap + " 0", 
            padding: LAYOUT.smallGap, 
            borderRadius: LAYOUT.smallBorderRadius,
            borderLeft: `4px solid ${COLORS.primary}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
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
    </Card>
  );
}
