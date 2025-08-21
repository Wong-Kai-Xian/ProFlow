import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function TopBar() {
  const location = useLocation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const getLinkStyle = (path) => ({
    margin: '0 10px',
    color: 'white',
    textDecoration: 'none',
    fontWeight: location.pathname === path ? 'bold' : 'normal',
    borderBottom: location.pathname === path ? '2px solid #3498DB' : 'none',
    paddingBottom: '5px',
    transition: 'all 0.3s ease'
  });

  const handleProfileClick = () => {
    console.log("Profile clicked");
    setIsDropdownOpen(false); // Close dropdown after selection
  };

  const handleLogout = () => {
    console.log("Logout clicked");
    setIsDropdownOpen(false); // Close dropdown after selection
  };

  return (
    <nav style={{ display: 'flex', padding: '10px', background: '#2C3E50', color: 'white', width: '100%', margin: '0', boxSizing: 'border-sizing', alignItems: 'center', gap: '10px' }}>
      <img src="/proflow-logo.png" alt="ProFlow Logo" style={{ height: '45px', marginRight: '20px', flexShrink: 0 }} /> {/* Logo set to PNG */}
      <Link to="/" style={getLinkStyle("/")}>Home</Link>
      <Link to="/project" style={getLinkStyle("/project")}>Project</Link>
      <Link to="/forum" style={getLinkStyle("/forum")}>Forum</Link>
      <Link to="/customer-profiles" style={getLinkStyle("/customer-profiles")}>Customer Profile</Link>
      <Link to="/approvals" style={getLinkStyle("/approvals")}>Approval</Link> {/* New link for Approvals */}
      <Link to="/quote" style={getLinkStyle("/quote")}>Quote</Link>

      {/* User Profile and Logout */}
      <div style={{ marginLeft: 'auto', position: 'relative' }}>
        <div 
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          style={{
            cursor: 'pointer',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: '#3498DB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '18px',
            color: 'white',
            marginRight: '10px' /* Added margin-right for spacing */
          }}
        >
          U {/* Placeholder for User Initial/Logo */}
        </div>

        {isDropdownOpen && (
          <div style={{
            position: 'absolute',
            top: '50px',
            right: '10px', /* Adjusted right position */
            backgroundColor: '#34495E',
            borderRadius: '5px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            zIndex: 100,
            minWidth: '120px',
          }}>
            <div 
              onClick={handleProfileClick}
              style={{
                padding: '10px 15px',
                cursor: 'pointer',
                '&:hover': { backgroundColor: '#4A6572' }
              }}
            >
              Profile
            </div>
            <div 
              onClick={handleLogout}
              style={{
                padding: '10px 15px',
                cursor: 'pointer',
                '&:hover': { backgroundColor: '#4A6572' }
              }}
            >
              Logout
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}