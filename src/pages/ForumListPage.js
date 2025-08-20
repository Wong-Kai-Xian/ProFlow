// src/pages/ForumListPage.js
import React from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import ForumList from "../components/ForumList";

export default function ForumListPage() {
  const navigate = useNavigate();

  const handleForumSelect = (forum) => {
    console.log("Selected forum:", forum);
    navigate(`/forum/${forum.id}`);
  };

  return (
    <div 
      style={{ 
        fontFamily: "Arial, sans-serif", 
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a, #1e293b)", // same theme as Project.js
        color: "white"
      }}
    >
      {/* Top Navigation Bar */}
      <TopBar />

      {/* Page Content */}
      <div 
        style={{ 
          display: "flex", 
          flexDirection: "column",
          alignItems: "center",
          padding: "20px",
        }}
      >
        {/* Forum List in the Center */}
        <div style={{ width: "80%", maxWidth: "900px" }}>
          <ForumList onForumSelect={handleForumSelect} />
        </div>

        {/* Background Logo */}
        <div 
          style={{ 
            marginTop: "40px", 
            opacity: 0.08, 
            textAlign: "center" 
          }}
        >
          <img 
            src="/logo.png" 
            alt="ProFlow Logo" 
            style={{ maxWidth: "300px" }}
          />
        </div>
      </div>
    </div>
  );
}
