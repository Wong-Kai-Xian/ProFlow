import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from '../contexts/AuthContext'; // Import useAuth
import { db } from '../firebase';
import { doc, getDoc, collection, onSnapshot, query } from 'firebase/firestore';
import UserAvatar from './shared/UserAvatar';
import NotificationCenter from './NotificationCenter';
import NotificationAgent from './NotificationAgent';
import FollowUpAgent from './FollowUpAgent';

export default function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { currentUser } = useAuth(); // Get currentUser from AuthContext
  const [userProfile, setUserProfile] = useState(null);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const topLevelPaths = ['/', '/finance', '/project', '/forum', '/customer-profiles', '/approvals', '/team'];
  const showBack = !topLevelPaths.includes(location.pathname);

  // Fetch user profile data including photo
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (currentUser?.uid) {
        try {
          const docRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserProfile(docSnap.data());
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      }
    };

    fetchUserProfile();
  }, [currentUser?.uid]);

  // Listen for unread notifications
  useEffect(() => {
    if (!currentUser?.uid) { setUnreadCount(0); return; }
    const q = query(collection(db, 'users', currentUser.uid, 'notifications'));
    const unsub = onSnapshot(q, snap => {
      const cnt = snap.docs.reduce((acc, d) => (d.data().unread ? acc + 1 : acc), 0);
      setUnreadCount(cnt);
    });
    return () => unsub();
  }, [currentUser?.uid]);

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
      backdropFilter: 'blur(10px)',
      position: 'sticky',
      top: 0,
      zIndex: 1000
    }}>
      <NotificationAgent />
      <FollowUpAgent />
      {/* Back button */}
      {showBack && (
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'rgba(255,255,255,0.15)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: 8,
            padding: '8px 12px',
            cursor: 'pointer'
          }}
          title="Back"
        >
          ← Back
        </button>
      )}
      <img 
        src="/proflow-logo.png" 
        alt="ProFlow Logo" 
        onClick={() => navigate('/')}
        style={{ 
          height: '45px', 
          marginRight: '32px', 
          flexShrink: 0,
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
          cursor: 'pointer',
          transition: 'transform 0.2s ease, filter 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'scale(1.05)';
          e.target.style.filter = 'drop-shadow(0 4px 8px rgba(0,0,0,0.4)) brightness(1.1)';
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'scale(1)';
          e.target.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))';
        }}
        title="Go to Home Page"
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
            to="/finance" 
            style={getLinkStyle("/finance")}
            onMouseEnter={(e) => {
              if (location.pathname !== "/finance") {
                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                e.target.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (location.pathname !== "/finance") {
                e.target.style.background = 'transparent';
                e.target.style.transform = 'translateY(0)';
              }
            }}
          >
            Finance
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
        <div style={{ marginLeft: 'auto', position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Notifications bell */}
          <div onClick={() => setIsNotifOpen(true)} style={{ cursor: 'pointer', position: 'relative', width: 36, height: 36, borderRadius: 9999, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.35)' }} title="Notifications">
            <span style={{ fontSize: 18, color: '#fff' }}>🔔</span>
            {unreadCount > 0 && (
              <span style={{ position: 'absolute', top: -6, right: -8, background: '#ef4444', color: '#fff', borderRadius: 9999, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <div 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            style={{ marginRight: '25px', cursor: 'pointer' }}
          >
            <UserAvatar 
              user={{
                ...currentUser,
                ...userProfile,
                email: currentUser.email
              }} 
              size={42} 
            />
          </div>

          {isDropdownOpen && (
            <div style={{
              position: 'absolute',
              top: '50px',
              right: '20px', /* Adjusted right position for more spacing */
              backgroundColor: '#34495E',
              borderRadius: '5px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
              zIndex: 9999,
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
      {currentUser && (
        <NotificationCenter userId={currentUser.uid} isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
      )}
    </nav>
  );
}