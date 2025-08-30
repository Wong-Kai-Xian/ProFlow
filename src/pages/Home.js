// src/pages/Home.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import Dashboard from "../components/Dashboard";
import Contacts from "../components/Contacts"; 
import UpcomingEvents from "../components/UpcomingEvents";
import ProjectsTab from "../components/ProjectsTab";
import HomeGroupForum from "../components/HomeGroupForum";
import GlobalFinancePanel from "../components/GlobalFinancePanel";
import { useAuth } from '../contexts/AuthContext';
import { DESIGN_SYSTEM, getPageContainerStyle, getCardStyle, getPageHeaderStyle, getContentContainerStyle } from '../styles/designSystem';

export default function Home() {
  const navigate = useNavigate();
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [dashboardScope, setDashboardScope] = useState('private');
  const [eventsCalendarOpen, setEventsCalendarOpen] = useState(false);
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
    <div style={getPageContainerStyle()}>
      <TopBar />

      <div style={{
        ...getContentContainerStyle(),
        paddingTop: DESIGN_SYSTEM.spacing['2xl']
      }}>
      <div
        style={{
          display: "grid",
            gridTemplateColumns: `${leftWidth}px 1fr ${rightWidth}px`,
          gridTemplateRows: "1fr",
            gap: DESIGN_SYSTEM.spacing.lg,
          transition: "grid-template-columns 0.3s ease",
            minHeight: "calc(100vh - 250px)"
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
              {/* Projects Section */}
              <div style={{ 
                ...getCardStyle('home'),
                height: "350px",
                marginBottom: DESIGN_SYSTEM.spacing.base,
                display: "flex",
                flexDirection: "column"
              }}>
                <div style={{
                  background: DESIGN_SYSTEM.pageThemes.projects.gradient,
                  padding: DESIGN_SYSTEM.spacing.base,
                  color: DESIGN_SYSTEM.colors.text.inverse
                }}>
                  <h3 style={{
                    margin: "0",
                    fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
                    fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold
                  }}>
                    Projects Hub
                  </h3>
                  <p style={{
                    margin: "4px 0 0 0",
                    fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                    opacity: 0.9
                  }}>
                    Manage and track your projects
                  </p>
                </div>
                <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
                  <ProjectsTab />
                </div>
              </div>

              {/* Contacts Section */}
              <div style={{ 
                ...getCardStyle('home'),
                height: "340px",
                display: "flex",
                flexDirection: "column"
              }}>
                <div style={{
                  background: DESIGN_SYSTEM.pageThemes.customers.gradient,
                  padding: DESIGN_SYSTEM.spacing.base,
                  color: DESIGN_SYSTEM.colors.text.inverse
                }}>
                  <h3 style={{
                    margin: "0",
                    fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
                    fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold
                  }}>
                    Contacts
                  </h3>
                  <p style={{
                    margin: "4px 0 0 0",
                    fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                    opacity: 0.9
                  }}>
                    Connect with your customers
                  </p>
                </div>
                <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
                  <Contacts onSelectCustomer={goToCustomerProfile} />
                </div>
              </div>
            </>
          )}

          {/* Left Collapse Button */}
          <button
            onClick={() => setLeftCollapsed(!leftCollapsed)}
            onMouseEnter={() => setLeftButtonHovered(true)}
            onMouseLeave={() => setLeftButtonHovered(false)}
            style={{
              position: "absolute",
              top: "50%",
              right: -20,
              transform: "translateY(-50%)",
              width: 20,
              height: 80,
              background: leftButtonHovered ? DESIGN_SYSTEM.colors.background.primary : DESIGN_SYSTEM.colors.secondary[100],
              color: leftButtonHovered ? DESIGN_SYSTEM.colors.text.primary : DESIGN_SYSTEM.colors.text.secondary,
              border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
              borderRadius: `${DESIGN_SYSTEM.borderRadius.base} 0 0 ${DESIGN_SYSTEM.borderRadius.base}`,
              padding: 0,
              fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
              fontWeight: DESIGN_SYSTEM.typography.fontWeight.bold,
              fontFamily: DESIGN_SYSTEM.typography.fontFamily.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: DESIGN_SYSTEM.shadows.sm,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            {leftCollapsed ? ">" : "<"}
          </button>
        </div>

        {/* Middle Panel */}
        <div style={{
          gridColumn: 2, 
          gridRow: 1,
          ...getCardStyle('home'),
          height: "800px",
          display: "flex",
          flexDirection: "column"
        }}>
          <div style={{
            background: DESIGN_SYSTEM.pageThemes.home.gradient,
            padding: DESIGN_SYSTEM.spacing.base,
            color: DESIGN_SYSTEM.colors.text.inverse,
            borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: DESIGN_SYSTEM.spacing.base }}>
              <div>
                <h2 style={{
                  margin: "0",
                  fontSize: DESIGN_SYSTEM.typography.fontSize.xl,
                  fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold
                }}>
                  Dashboard
                </h2>
                <p style={{
                  margin: "4px 0 0 0",
                  fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                  opacity: 0.9
                }}>
                  Overview of your work and progress
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setDashboardScope('private')}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: `1px solid ${dashboardScope === 'private' ? DESIGN_SYSTEM.colors.primary[500] : DESIGN_SYSTEM.colors.secondary[300]}`,
                    background: dashboardScope === 'private' ? DESIGN_SYSTEM.colors.primary[600] : DESIGN_SYSTEM.colors.secondary[100],
                    color: dashboardScope === 'private' ? DESIGN_SYSTEM.colors.text.inverse : DESIGN_SYSTEM.colors.text.primary,
                    cursor: 'pointer',
                    fontSize: 12
                  }}
                >
                  Private
                </button>
                <button
                  onClick={() => setDashboardScope('public')}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: `1px solid ${dashboardScope === 'public' ? DESIGN_SYSTEM.colors.primary[500] : DESIGN_SYSTEM.colors.secondary[300]}`,
                    background: dashboardScope === 'public' ? DESIGN_SYSTEM.colors.primary[600] : DESIGN_SYSTEM.colors.secondary[100],
                    color: dashboardScope === 'public' ? DESIGN_SYSTEM.colors.text.inverse : DESIGN_SYSTEM.colors.text.primary,
                    cursor: 'pointer',
                    fontSize: 12
                  }}
                >
                  Public
                </button>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
            <Dashboard scope={dashboardScope} />
          </div>
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
              {/* Upcoming Events Section */}
              <div style={{ 
                ...getCardStyle('home'),
                height: "320px",
                marginBottom: DESIGN_SYSTEM.spacing.base,
                display: "flex",
                flexDirection: "column"
              }}>
                <div style={{
                  background: DESIGN_SYSTEM.pageThemes.home.gradient,
                  padding: DESIGN_SYSTEM.spacing.base,
                  color: DESIGN_SYSTEM.colors.text.inverse,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <h3 style={{
                      margin: "0",
                      fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
                      fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold
                    }}>
                      Upcoming Events
                    </h3>
                    <p style={{
                      margin: "4px 0 0 0",
                      fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                      opacity: 0.9
                    }}>
                      Stay on top of your schedule
                    </p>
                  </div>
                </div>
                <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
                  <UpcomingEvents embedded externalCalendarOpen={eventsCalendarOpen} onRequestCloseCalendar={() => setEventsCalendarOpen(false)} />
                </div>
              </div>

              {/* General Forum Section */}
              <div style={{ 
                ...getCardStyle('home'),
                height: "340px",
                display: "flex",
                flexDirection: "column"
              }}>
                <div style={{
                  background: DESIGN_SYSTEM.pageThemes.forums.gradient,
                  padding: DESIGN_SYSTEM.spacing.base,
                  color: DESIGN_SYSTEM.colors.text.inverse
                }}>
                  <h3 style={{
                    margin: "0",
                    fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
                    fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold
                  }}>
                    General Forum
                  </h3>
                  <p style={{
                    margin: "4px 0 0 0",
                    fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                    opacity: 0.9
                  }}>
                    Community discussions and updates
                  </p>
                </div>
                <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
                  <HomeGroupForum />
                </div>
              </div>

              {/* Finance Overview Section */}
              <div style={{ 
                ...getCardStyle('home'),
                height: "340px",
                display: "flex",
                flexDirection: "column"
              }}>
                <GlobalFinancePanel />
              </div>
            </>
          )}

          {/* Right Collapse Button */}
          <button
            onClick={() => setRightCollapsed(!rightCollapsed)}
            onMouseEnter={() => setRightButtonHovered(true)}
            onMouseLeave={() => setRightButtonHovered(false)}
            style={{
              position: "absolute",
              top: "50%",
              left: -20,
              transform: "translateY(-50%)",
              width: 20,
              height: 80,
              background: rightButtonHovered ? DESIGN_SYSTEM.colors.background.primary : DESIGN_SYSTEM.colors.secondary[100],
              color: rightButtonHovered ? DESIGN_SYSTEM.colors.text.primary : DESIGN_SYSTEM.colors.text.secondary,
              border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
              borderRadius: `0 ${DESIGN_SYSTEM.borderRadius.base} ${DESIGN_SYSTEM.borderRadius.base} 0`,
              padding: 0,
              fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
              fontWeight: DESIGN_SYSTEM.typography.fontWeight.bold,
              fontFamily: DESIGN_SYSTEM.typography.fontFamily.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: DESIGN_SYSTEM.shadows.sm,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            {rightCollapsed ? "<" : ">"}
          </button>
        </div>
      </div>
      
      </div>
      
      {/* Footer Bar */}
      <div style={{
        height: "40px",
        backgroundColor: DESIGN_SYSTEM.colors.secondary[800],
        color: DESIGN_SYSTEM.colors.text.inverse,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `0 ${DESIGN_SYSTEM.spacing.xl}`,
        fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
        fontFamily: DESIGN_SYSTEM.typography.fontFamily.primary
      }}>
        <div style={{ display: "flex", gap: DESIGN_SYSTEM.spacing.xl }}>
          <span style={{ cursor: "pointer", opacity: 0.8, transition: "opacity 0.2s" }}>Help</span>
          <span style={{ cursor: "pointer", opacity: 0.8, transition: "opacity 0.2s" }}>Support</span>
          <span style={{ cursor: "pointer", opacity: 0.8, transition: "opacity 0.2s" }}>Documentation</span>
        </div>
        <div style={{ display: "flex", gap: DESIGN_SYSTEM.spacing.xl }}>
          <span>© 2025 ProFlow</span>
          <span style={{ cursor: "pointer", opacity: 0.8, transition: "opacity 0.2s" }}>Privacy</span>
          <span style={{ cursor: "pointer", opacity: 0.8, transition: "opacity 0.2s" }}>Terms</span>
        </div>
      </div>
    </div>
  );
}
