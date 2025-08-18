import React, { useEffect, useState } from "react";

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
    <div style={{ background: '#F8F9F9', padding: '15px', borderRadius: '10px', height: '100%', overflowY: 'auto' }}>
      {/* Header with top-right button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <h3 style={{ margin: 0, color: '#2C3E50' }}>Group Forum</h3>
        <button 
          onClick={() => setSortBy(sortBy === "recent" ? "notifications" : "recent")} 
          style={{
            padding: "5px 10px",
            background: "#3498DB",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
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
            background: 'white', 
            margin: '10px 0', 
            padding: '10px', 
            borderRadius: '5px',
            borderLeft: '4px solid #3498DB',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <strong>{forum.title}</strong>
              <br />
              <small style={{ color: '#7F8C8D' }}>
                {forum.posts} posts • Last activity: {forum.lastActivity}
              </small>
            </div>
            {forum.notifications > 0 && (
              <div style={{
                background: "#E74C3C",
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
    </div>
  );
}
