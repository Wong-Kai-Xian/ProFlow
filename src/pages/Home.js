// src/pages/Home.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import Dashboard from "../components/Dashboard";
import Contacts from "../components/Contacts"; 
import UpcomingEvents from "../components/UpcomingEvents";
import ProjectsTab from "../components/ProjectsTab";
import GroupForum from "../components/GroupForum";

export default function Home() {
  const navigate = useNavigate();
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const leftWidth = leftCollapsed ? 40 : 300;
  const rightWidth = rightCollapsed ? 40 : 300;

  // Redirect to customer profile page
  const goToCustomerProfile = (customerId) => {
    navigate(`/customer/${customerId}`);
  };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", position: "relative" }}>
      <TopBar />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${leftWidth}px 1fr ${rightWidth}px`,
          gridTemplateRows: "auto 1fr",
          gap: "20px",
          padding: "10px",
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
            gap: "8px"
          }}
        >
          {!leftCollapsed && (
            <>
              <ProjectsTab />
              <Contacts onSelectCustomer={goToCustomerProfile} />
            </>
          )}

          {/* Left Collapse Button */}
          <div
            onClick={() => setLeftCollapsed(!leftCollapsed)}
            style={{
              position: "absolute",
              top: "50%",
              right: -20,
              transform: "translateY(-50%)",
              width: 20,
              height: 80,
              background: "#3498DB",
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              borderRadius: "4px 0 0 4px",
              userSelect: "none",
            }}
          >
            {leftCollapsed ? ">" : "<"}
          </div>
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
            gap: "8px"
          }}
        >
          <div style={{ marginTop: rightCollapsed ? 0 : 0, maxHeight: 300, overflowY: "auto" }}>
            {!rightCollapsed && <UpcomingEvents />}
          </div>

          <div style={{ marginTop: rightCollapsed ? 0 : 20 }}>
            {!rightCollapsed && <GroupForum />}
          </div>

          {/* Right Collapse Button */}
          <div
            onClick={() => setRightCollapsed(!rightCollapsed)}
            style={{
              position: "absolute",
              top: "50%",
              left: -20,
              transform: "translateY(-50%)",
              width: 20,
              height: 80,
              background: "#3498DB",
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              borderRadius: "0 4px 4px 0",
              userSelect: "none",
            }}
          >
            {rightCollapsed ? "<" : ">"}
          </div>
        </div>
      </div>
    </div>
  );
}
