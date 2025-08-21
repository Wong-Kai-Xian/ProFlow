// src/pages/Home.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import Dashboard from "../components/Dashboard";
import Contacts from "../components/Contacts"; 
import UpcomingEvents from "../components/UpcomingEvents";
import ProjectsTab from "../components/ProjectsTab";
import GroupForum from "../components/GroupForum";
import { COLORS, LAYOUT, BUTTON_STYLES } from "../components/profile-component/constants"; // Import COLORS and LAYOUT

export default function Home() {
  const navigate = useNavigate();
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // State for hover effects on collapse buttons
  const [leftButtonHovered, setLeftButtonHovered] = useState(false);
  const [rightButtonHovered, setRightButtonHovered] = useState(false);

  const leftWidth = leftCollapsed ? 40 : 300;
  const rightWidth = rightCollapsed ? 40 : 300;

  // Redirect to customer profile page
  const goToCustomerProfile = (customerId) => {
    navigate(`/customer/${customerId}`);
  };

  return (
    <div style={{
      fontFamily: "Arial, sans-serif",
      position: "relative",
      background: COLORS.background,
      height: "100vh", // Changed from minHeight to height
      display: "flex", // Added flex display
      flexDirection: "column", // Added flex direction
    }}>
      <TopBar />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${leftWidth}px 1fr ${rightWidth}px`,
          gridTemplateRows: "auto 1fr",
          gap: LAYOUT.gap,
          padding: LAYOUT.gap,
          flexGrow: 1, // Changed from minHeight to flexGrow
          transition: "grid-template-columns 0.3s ease"
        }}
      >
        {/* Left Panel */}
        <div
          style={{
            gridColumn: 1,
            gridRow: "1 / span 2",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: LAYOUT.smallGap
          }}
        >
          {!leftCollapsed && (
            <>
              <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
                <ProjectsTab />
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
                <Contacts onSelectCustomer={goToCustomerProfile} />
              </div>
            </>
          )}

          {/* Left Collapse Button */}
          <button
            onClick={() => setLeftCollapsed(!leftCollapsed)}
            onMouseEnter={() => setLeftButtonHovered(true)}
            onMouseLeave={() => setLeftButtonHovered(false)}
            style={{
              ...BUTTON_STYLES.flat,
              position: "absolute",
              top: "50%",
              right: -20,
              transform: "translateY(-50%)",
              width: 20,
              height: 80,
              background: leftButtonHovered ? "rgba(0,0,0,0.1)" : "rgba(0,0,0,0.05)",
              color: leftButtonHovered ? COLORS.text : COLORS.lightText,
              border: `1px solid ${COLORS.lightBorder}`,
              borderRadius: LAYOUT.smallBorderRadius + " 0 0 " + LAYOUT.smallBorderRadius,
              padding: 0,
              fontSize: "18px",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "none",
              cursor: "pointer",
              transition: "all 0.2s ease-in-out",
            }}
          >
            {leftCollapsed ? ">" : "<"}
          </button>
        </div>

        {/* Middle Panel */}
        <div style={{
          gridColumn: 2, 
          gridRow: "1 / span 2",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto", // Enable scrolling for the middle panel
          minHeight: 0 // Allow content to shrink and enable scrolling
        }}>
          <Dashboard />
        </div>

        {/* Right Panel */}
        <div
          style={{
            gridColumn: 3,
            gridRow: "1 / span 2",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: LAYOUT.smallGap
          }}
        >
          <div>
            {!rightCollapsed && <UpcomingEvents />}
          </div>

          <div style={{ flexGrow: 1 }}>
            {!rightCollapsed && <GroupForum />}
          </div>

          {/* Right Collapse Button */}
          <button
            onClick={() => setRightCollapsed(!rightCollapsed)}
            onMouseEnter={() => setRightButtonHovered(true)}
            onMouseLeave={() => setRightButtonHovered(false)}
            style={{
              ...BUTTON_STYLES.flat,
              position: "absolute",
              top: "50%",
              left: -20,
              transform: "translateY(-50%)",
              width: 20,
              height: 80,
              background: rightButtonHovered ? "rgba(0,0,0,0.1)" : "rgba(0,0,0,0.05)",
              color: rightButtonHovered ? COLORS.text : COLORS.lightText,
              border: `1px solid ${COLORS.lightBorder}`,
              borderRadius: "0 " + LAYOUT.smallBorderRadius + " " + LAYOUT.smallBorderRadius + " 0",
              padding: 0,
              fontSize: "18px",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "none",
              cursor: "pointer",
              transition: "all 0.2s ease-in-out",
            }}
          >
            {rightCollapsed ? "<" : ">"}
          </button>
        </div>
      </div>
    </div>
  );
}
