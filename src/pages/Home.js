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
    <div style={{ fontFamily: "Arial, sans-serif", position: "relative", background: COLORS.background, minHeight: "100vh" }}>
      <TopBar />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${leftWidth}px 1fr ${rightWidth}px`,
          gridTemplateRows: "auto 1fr",
          gap: LAYOUT.gap,
          padding: LAYOUT.gap,
          minHeight: "90vh",
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
              <ProjectsTab />
              <Contacts onSelectCustomer={goToCustomerProfile} />
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
        <div style={{ gridColumn: 2, gridRow: "1 / span 2" }}>
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
          <div style={{ marginTop: rightCollapsed ? 0 : 0, maxHeight: 300, overflowY: "auto" }}>
            {!rightCollapsed && <UpcomingEvents />}
          </div>

          <div style={{ marginTop: rightCollapsed ? 0 : LAYOUT.gap }}>
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
