import React, { useEffect, useState } from "react";

export default function GroupForum() {
  const [forums, setForums] = useState([]);

  useEffect(() => {
    // Mock forum data since Firebase might not be set up yet
    setForums([
      { title: "Project Alpha Discussion", posts: 12, lastActivity: "2 hours ago" },
      { title: "Client Feedback Thread", posts: 8, lastActivity: "5 hours ago" },
      { title: "Team Updates", posts: 15, lastActivity: "1 day ago" },
      { title: "Technical Issues", posts: 6, lastActivity: "3 days ago" }
    ]);
  }, []);

  return (
    <div style={{ background: '#F8F9F9', padding: '15px', borderRadius: '10px' }}>
      <h3 style={{ marginTop: 0, color: '#2C3E50' }}>Group Forum</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {forums.map((forum, index) => (
          <li key={index} style={{ 
            background: 'white', 
            margin: '10px 0', 
            padding: '10px', 
            borderRadius: '5px',
            borderLeft: '4px solid #3498DB'
          }}>
            <strong>{forum.title}</strong>
            <br />
            <small style={{ color: '#7F8C8D' }}>
              {forum.posts} posts • Last activity: {forum.lastActivity}
            </small>
          </li>
        ))}
      </ul>
    </div>
  );
}