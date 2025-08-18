import React from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import ForumList from "../components/ForumList";
import Projects from "../components/ProjectsTab";
import Contacts from "../components/Contacts";
import UpcomingEvents from "../components/UpcomingEvents";
import GroupForum from "../components/GroupForum";

export default function ForumListPage() {
  const navigate = useNavigate();
  
  const handleForumSelect = (forum) => {
    // Navigate to the specific forum page
    console.log("Selected forum:", forum);
    navigate(`/forum/${forum.id}`);
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif' }}>
      <TopBar />
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 2fr 1fr",
        gridTemplateRows: "auto 1fr",
        gap: "20px",
        padding: "10px",
        minHeight: "90vh"
      }}>
        {/* Left column: Projects + Contacts */}
        <div style={{ gridColumn: 1, gridRow: "1 / span 2", display: "flex", flexDirection: "column", gap: "8px" }}>
          <Projects />
          <Contacts />
        </div>

        {/* Middle: Forum List */}
        <div style={{ gridColumn: 2, gridRow: "1 / span 2" }}>
          <ForumList onForumSelect={handleForumSelect} />
        </div>

        {/* Top-right: Upcoming Reminders */}
        <div style={{ gridColumn: 3, gridRow: 1 }}>
          <UpcomingEvents style={{ maxHeight: "200px", overflowY: "auto" }} />
        </div>

        {/* Bottom-right: Group Forum */}
        <div style={{ gridColumn: 3, gridRow: 2, alignSelf: "start" }}>
          <GroupForum />
        </div>
      </div>
    </div>
  );
}
