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
    <div style={{ fontFamily: "Arial, sans-serif" }}>
      <TopBar />
      
      <div style={{ padding: "20px" }}>
        <h2>Forums</h2>
        
        {/* Full-width Forum List */}
        <ForumList onForumSelect={handleForumSelect} />
      </div>
    </div>
  );
}
