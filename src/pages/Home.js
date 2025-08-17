// src/pages/Home.js
import React from "react";
import TopBar from "../components/TopBar";
import Dashboard from "../components/Dashboard";
import GroupForum from "../components/GroupForum";
import ClientChat from "../components/ClientChat";
import UpcomingEvents from "../components/UpcomingEvents";

export default function Home() {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif' }}>
      <TopBar />
      <div style={{
        display: "flex",
        marginTop: "20px",
        padding: "10px",
        gap: "20px",
        minHeight: "90vh"
      }}>
        {/* Left Column */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
          <GroupForum />
          <ClientChat />
        </div>

        {/* Middle Column */}
        <div style={{ flex: 2 }}>
          <Dashboard />
        </div>

        {/* Right Column */}
        <div style={{ flex: 1 }}>
          <UpcomingEvents />
        </div>
      </div>
    </div>
  );
}