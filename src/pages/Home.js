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
      minHeight: "100vh",
      width: "100vw",
      display: "flex",
      flexDirection: "column",
      margin: "0",
      padding: "0",
      overflowX: "hidden"
    }}>
      <TopBar />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${leftWidth}px 1fr ${rightWidth}px`,
          gridTemplateRows: "1fr",
          gap: "15px",
          padding: "15px",
          transition: "grid-template-columns 0.3s ease",
          flex: 1,
          minHeight: "calc(100vh - 100px)",
          overflowX: "hidden",
          width: "100%",
          boxSizing: "border-box"
        }}
      >
        {/* Left Panel */}
        <div
          style={{
            gridColumn: 1,
            gridRow: 1,
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            height: "100%"
          }}
        >
          {!leftCollapsed && (
            <>
              <div style={{ 
                height: "350px",
                marginBottom: "30px"
              }}>
                <ProjectsTab />
              </div>
              <div style={{ 
                height: "340px"
              }}>
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
          gridRow: 1,
          height: "760px",
          backgroundColor: COLORS.cardBackground,
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
        }}>
          <Dashboard />
        </div>

        {/* Right Panel */}
        <div
          style={{
            gridColumn: 3,
            gridRow: 1,
            position: "relative",
            display: "flex",
            flexDirection: "column",
            height: "100%"
          }}
        >
          <div style={{ 
            height: "320px",
            marginBottom: "20px"
          }}>
            {!rightCollapsed && <UpcomingEvents />}
          </div>

          <div style={{ 
            height: "340px",
            marginTop: "50px"
          }}>
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
      
      {/* Footer Bar */}
      <div style={{
        height: "40px",
        backgroundColor: COLORS.secondary,
        color: COLORS.white,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 2rem",
        fontSize: "14px",
        width: "100%",
        margin: "0",
        boxSizing: "border-box"
      }}>
        <div style={{ display: "flex", gap: "2rem" }}>
          <span style={{ cursor: "pointer" }}>Help</span>
          <span style={{ cursor: "pointer" }}>Support</span>
          <span style={{ cursor: "pointer" }}>Documentation</span>
        </div>
        <div style={{ display: "flex", gap: "2rem" }}>
          <span>© 2025 ProFlow</span>
          <span style={{ cursor: "pointer" }}>Privacy</span>
          <span style={{ cursor: "pointer" }}>Terms</span>
        </div>
      </div>
    </div>
  );
}
