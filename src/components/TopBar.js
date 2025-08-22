import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

export default function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { currentUser } = useAuth(); // Get currentUser from AuthContext

  const getLinkStyle = (path) => {
    const isActive = location.pathname === path;
    return {
      margin: '0 8px',
      color: 'white',
      textDecoration: 'none',
      fontWeight: isActive ? '600' : '500',
      padding: '12px 16px',
      borderRadius: '8px',
      position: 'relative',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      background: isActive ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
      backdropFilter: isActive ? 'blur(10px)' : 'none',
      border: isActive ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
      boxShadow: isActive ? '0 4px 12px rgba(0, 0, 0, 0.15)' : 'none',
      transform: isActive ? 'translateY(-1px)' : 'translateY(0)'
    };
  };

  const handleProfileClick = () => {
    console.log("Profile clicked");
    setIsDropdownOpen(false); // Close dropdown after selection
    if (currentUser) {
      navigate(`/profile/${currentUser.uid}`);
    }
  };

  const handleLogout = () => {
    // Redirect to login page on logout
    navigate('/login'); 
    setIsDropdownOpen(false); // Close dropdown after selection
  };

  return (
    <nav style={{ 
      display: 'flex', 
      padding: '16px 24px', 
      background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)', 
      color: 'white', 
      width: '100%', 
      margin: '0', 
      boxSizing: 'border-box', 
      alignItems: 'center', 
      gap: '16px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
      backdropFilter: 'blur(10px)'
    }}>
      <img 
        src="/proflow-logo.png" 
        alt="ProFlow Logo" 
        style={{ 
          height: '45px', 
          marginRight: '32px', 
          flexShrink: 0,
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
        }} 
      />
      {currentUser && (
        <>
          <Link 
            to="/" 
            style={getLinkStyle("/")}
            onMouseEnter={(e) => {
              if (location.pathname !== "/") {
                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                e.target.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (location.pathname !== "/") {
                e.target.style.background = 'transparent';
                e.target.style.transform = 'translateY(0)';
              }
            }}
          >
            Home
          </Link>
          <Link 
            to="/project" 
            style={getLinkStyle("/project")}
            onMouseEnter={(e) => {
              if (location.pathname !== "/project") {
                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                e.target.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (location.pathname !== "/project") {
                e.target.style.background = 'transparent';
                e.target.style.transform = 'translateY(0)';
              }
            }}
          >
            Project
          </Link>
          <Link 
            to="/forum" 
            style={getLinkStyle("/forum")}
            onMouseEnter={(e) => {
              if (location.pathname !== "/forum") {
                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                e.target.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (location.pathname !== "/forum") {
                e.target.style.background = 'transparent';
                e.target.style.transform = 'translateY(0)';
              }
            }}
          >
            Forum
          </Link>
          <Link 
            to="/customer-profiles" 
            style={getLinkStyle("/customer-profiles")}
            onMouseEnter={(e) => {
              if (location.pathname !== "/customer-profiles") {
                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                e.target.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (location.pathname !== "/customer-profiles") {
                e.target.style.background = 'transparent';
                e.target.style.transform = 'translateY(0)';
              }
            }}
          >
            Customer Profile
          </Link>
          <Link 
            to="/approvals" 
            style={getLinkStyle("/approvals")}
            onMouseEnter={(e) => {
              if (location.pathname !== "/approvals") {
                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                e.target.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (location.pathname !== "/approvals") {
                e.target.style.background = 'transparent';
                e.target.style.transform = 'translateY(0)';
              }
            }}
          >
            Approval
          </Link>
          <Link 
            to="/quote" 
            style={getLinkStyle("/quote")}
            onMouseEnter={(e) => {
              if (location.pathname !== "/quote") {
                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                e.target.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (location.pathname !== "/quote") {
                e.target.style.background = 'transparent';
                e.target.style.transform = 'translateY(0)';
              }
            }}
          >
            Quote
          </Link>
          <Link 
            to="/team" 
            style={getLinkStyle("/team")}
            onMouseEnter={(e) => {
              if (location.pathname !== "/team") {
                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                e.target.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (location.pathname !== "/team") {
                e.target.style.background = 'transparent';
                e.target.style.transform = 'translateY(0)';
              }
            }}
          >
            Team
          </Link>
        </>
      )}

      {/* User Profile and Logout */}
      {currentUser && (
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
              marginRight: '25px' /* Increased margin-right for more spacing */
            }}
          >
            {currentUser.email ? currentUser.email[0].toUpperCase() : 'U'} {/* Display first letter of email or 'U' */}
          </div>

          {isDropdownOpen && (
            <div style={{
              position: 'absolute',
              top: '50px',
              right: '20px', /* Adjusted right position for more spacing */
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
      )}
    </nav>
  );
}