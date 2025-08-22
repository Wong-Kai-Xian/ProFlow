// src/pages/Home.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import Dashboard from "../components/Dashboard";
import Contacts from "../components/Contacts"; 
import UpcomingEvents from "../components/UpcomingEvents";
import ProjectsTab from "../components/ProjectsTab";
import HomeGroupForum from "../components/HomeGroupForum"; // Use HomeGroupForum
import { COLORS, LAYOUT, BUTTON_STYLES } from "../components/profile-component/constants"; // Import COLORS and LAYOUT
import { db } from "../firebase"; // Import db
import { collection, onSnapshot, query, orderBy, where } from "firebase/firestore"; // Import Firestore functions
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

export default function Home() {
  const navigate = useNavigate();
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const { currentUser } = useAuth(); // Get currentUser from AuthContext
  // Forums state is now managed within HomeGroupForum, so we can remove it here
  // const [forums, setForums] = useState([]);

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
      background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
      minHeight: "100vh",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      margin: "0",
      padding: "0",
      overflowX: "hidden",
      boxSizing: "border-box"
    }}>
      <TopBar />

      {/* Welcome Header */}
      <div style={{
        padding: "30px",
        textAlign: "center",
        background: "rgba(255, 255, 255, 0.1)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.2)"
      }}>
        <h1 style={{
          margin: "0 0 8px 0",
          fontSize: "32px",
          fontWeight: "700",
          color: "#2d3748",
          textShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
          Welcome to ProFlow
        </h1>
        <p style={{
          margin: 0,
          fontSize: "16px",
          color: "#4a5568",
          opacity: 0.8
        }}>
          Manage your projects, team, and workflows in one place
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${leftCollapsed ? 40 : '1fr'} 4fr ${rightCollapsed ? 40 : '1fr'}`,
          gridTemplateRows: "1fr",
          gap: "20px",
          padding: "20px",
          transition: "grid-template-columns 0.3s ease",
          flex: 1,
          minHeight: "calc(100vh - 200px)",
          overflowX: "hidden",
          width: "100%",
          maxWidth: "1400px",
          margin: "0 auto",
          boxSizing: "border-box"
        }}>
        {/* Left Panel */}
        <div
          style={{
            gridColumn: 1,
            gridRow: 1,
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            height: "100%",
            minWidth: leftCollapsed ? 'auto' : '200px', /* Ensure it can shrink */
            maxWidth: leftCollapsed ? 'auto' : '300px' /* Optional: add max width */
          }}>
          {!leftCollapsed && currentUser && (
            <>
              <div style={{ 
                height: "350px",
                marginBottom: "20px",
                background: "rgba(255, 255, 255, 0.95)",
                borderRadius: "16px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                backdropFilter: "blur(10px)",
                overflow: "hidden",
                flexShrink: 0
              }}>
                <ProjectsTab />
              </div>
              <div style={{ 
                height: "340px",
                background: "rgba(255, 255, 255, 0.95)",
                borderRadius: "16px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                backdropFilter: "blur(10px)",
                overflow: "hidden",
                flexShrink: 0
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
              background: leftButtonHovered ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.7)",
              color: leftButtonHovered ? "#2d3748" : "#4a5568",
              border: "1px solid rgba(255,255,255,0.3)",
              backdropFilter: "blur(10px)",
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
          height: "800px",
          maxWidth: "100%",
          background: "rgba(255, 255, 255, 0.95)",
          borderRadius: "20px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          backdropFilter: "blur(10px)",
          overflow: "hidden",
          boxSizing: "border-box"
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
            gap: "12px",
            height: "100%",
            minWidth: rightCollapsed ? 'auto' : '200px', /* Ensure it can shrink */
            maxWidth: rightCollapsed ? 'auto' : '300px' /* Optional: add max width */
          }}
        >
          {!rightCollapsed && currentUser && (
            <>
              <div style={{ 
                height: "320px",
                marginBottom: "20px",
                background: "rgba(255, 255, 255, 0.95)",
                borderRadius: "16px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                backdropFilter: "blur(10px)",
                overflow: "hidden",
                flexShrink: 0
              }}>
                <UpcomingEvents />
              </div>

              <div style={{ 
                height: "340px",
                marginTop: "20px",
                background: "rgba(255, 255, 255, 0.95)",
                borderRadius: "16px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                backdropFilter: "blur(10px)",
                overflow: "hidden",
                flexShrink: 0
              }}>
                <HomeGroupForum />
              </div>
            </>
          )}

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
              background: rightButtonHovered ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.7)",
              color: rightButtonHovered ? "#2d3748" : "#4a5568",
              border: "1px solid rgba(255,255,255,0.3)",
              backdropFilter: "blur(10px)",
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
        boxSizing: "border-box" /* Added boxSizing */
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
