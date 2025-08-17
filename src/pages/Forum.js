import React, { useState } from "react";
import TopBar from "../components/TopBar";
import GroupForum from "../components/GroupForum";
import UpcomingEvents from "../components/UpcomingEvents";
import ForumTabs from "../components/ForumTabs";

export default function Forum() {
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
        {/* Left Column - Group Forum only */}
        <div style={{ flex: 1 }}>
          <GroupForum />
        </div>

        {/* Middle Column - Tabbed Content */}
        <div style={{ flex: 2 }}>
          <ForumTabs />
        </div>

        {/* Right Column - Upcoming Events */}
        <div style={{ flex: 1 }}>
          <UpcomingEvents />
        </div>
      </div>
    </div>
  );
}
