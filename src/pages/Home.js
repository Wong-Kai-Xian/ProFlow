// src/pages/Home.js
import React from "react";
import TopBar from "../components/TopBar";
import Dashboard from "../components/Dashboard";
import GroupForum from "../components/GroupForum";
import Contacts from "../components/Contacts"; 
import UpcomingEvents from "../components/UpcomingEvents";
import Projects from "../components/Projects";

export default function Home() {
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

        {/* Middle: Dashboard */}
        <div style={{ gridColumn: 2, gridRow: "1 / span 2" }}>
          <Dashboard />
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
