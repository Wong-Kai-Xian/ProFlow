import React, { useState, useEffect } from 'react';
import { COLORS } from '../profile-component/constants';
import { db } from '../../firebase';
import { doc, updateDoc, serverTimestamp, onSnapshot, collection, query, where } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import UserAvatar from '../shared/UserAvatar';

export default function ActiveUsers({ members }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [userActivities, setUserActivities] = useState({});
  const { currentUser } = useAuth();

  // Update current user's last activity
  useEffect(() => {
    const updateUserActivity = async () => {
      if (currentUser?.uid) {
        try {
          await updateDoc(doc(db, "users", currentUser.uid), {
            lastActivity: serverTimestamp(),
            isOnline: true
          });
        } catch (error) {
          console.error("Error updating user activity:", error);
        }
      }
    };

    updateUserActivity();
    
    // Update activity every 30 seconds while user is active
    const interval = setInterval(updateUserActivity, 30000);
    
    // Update activity when user leaves
    const handleBeforeUnload = () => {
      if (currentUser?.uid) {
        updateDoc(doc(db, "users", currentUser.uid), {
          isOnline: false
        }).catch(console.error);
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (currentUser?.uid) {
        updateDoc(doc(db, "users", currentUser.uid), {
          isOnline: false
        }).catch(console.error);
      }
    };
  }, [currentUser?.uid]);

  // Listen to user activities
  useEffect(() => {
    if (members.length === 0) return;

    const userIds = members.map(member => member.id).filter(Boolean);
    if (userIds.length === 0) return;

    const unsubscribes = userIds.map(userId => {
      return onSnapshot(doc(db, "users", userId), (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setUserActivities(prev => ({
            ...prev,
            [userId]: {
              isOnline: data.isOnline || false,
              lastActivity: data.lastActivity
            }
          }));
        }
      });
    });

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [members]);

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return 'Never';
    
    const now = new Date();
    const lastActivity = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diffMs = now - lastActivity;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  const usersWithStatus = members.map(member => {
    const activity = userActivities[member.id] || {};
    const isRecentlyActive = activity.lastActivity && 
      (new Date() - (activity.lastActivity.toDate ? activity.lastActivity.toDate() : new Date(activity.lastActivity))) < 5 * 60 * 1000; // 5 minutes

    return {
      id: member.id,
      name: member.name,
      avatar: member.name ? member.name[0].toUpperCase() : '?',
      email: member.email,
      isOnline: activity.isOnline && isRecentlyActive,
      lastSeen: formatLastSeen(activity.lastActivity)
    };
  });

  const onlineUsers = usersWithStatus.filter(user => user.isOnline);
  const offlineUsers = usersWithStatus.filter(user => !user.isOnline);

  const getAvatarColor = (name) => {
    const colors = ['#3498DB', '#E74C3C', '#27AE60', '#F39C12', '#9B59B6', '#E67E22'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div style={{
      padding: '16px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
        cursor: 'pointer'
      }} onClick={() => setIsExpanded(!isExpanded)}>
        <h3 style={{ 
          margin: 0, 
          color: COLORS.dark, 
          fontSize: '18px',
          fontWeight: '700'
        }}>
          Online Members ({onlineUsers.length})
        </h3>
        <span style={{ 
          color: COLORS.lightText, 
          fontSize: '14px',
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.3s ease'
        }}>
          ▼
        </span>
      </div>

      {isExpanded && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          {/* Online Users */}
          {onlineUsers.map((user, index) => (
            <div key={user.id} style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 0',
              borderBottom: '1px solid #F8F9FA'
            }}>
              <div style={{
                position: 'relative',
                marginRight: '8px'
              }}>
                <UserAvatar 
                  user={user} 
                  size={36}
                  showBorder={false}
                />
                {user.isOnline && (
                  <div style={{
                    position: 'absolute',
                    bottom: '-2px',
                    right: '-2px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: '#27AE60',
                    border: '2px solid white'
                  }} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: COLORS.dark,
                  marginBottom: '2px'
                }}>
                  {user.name}
                </div>
                <div style={{ 
                  fontSize: '12px', 
                  color: COLORS.lightText,
                  marginBottom: '2px'
                }}>
                  {user.email}
                </div>
                <div style={{ 
                  fontSize: '12px', 
                  color: user.isOnline ? COLORS.success : COLORS.lightText
                }}>
                  {user.isOnline ? 'Online' : `Last seen ${user.lastSeen}`}
                </div>
              </div>
            </div>
          ))}

          {/* Offline Users */}
          {offlineUsers.length > 0 && (
            <>
              <div style={{
                fontSize: '13px',
                color: COLORS.lightText,
                fontWeight: '600',
                margin: '10px 0 5px 0',
                textTransform: 'uppercase'
              }}>
                Recently Active
              </div>
              {offlineUsers.slice(0, 3).map((user) => (
                <div key={user.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px 0',
                  opacity: 0.7
                }}>
                  <div style={{
                    position: 'relative',
                    marginRight: '8px'
                  }}>
                    <UserAvatar 
                      user={user} 
                      size={32}
                      showBorder={false}
                      style={{ opacity: 0.8 }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontSize: '13px', 
                      fontWeight: '500', 
                      color: COLORS.dark,
                      marginBottom: '2px'
                    }}>
                      {user.name}
                    </div>
                    <div style={{ 
                      fontSize: '11px', 
                      color: COLORS.lightText,
                      marginBottom: '2px'
                    }}>
                      {user.email}
                    </div>
                    <div style={{ 
                      fontSize: '11px', 
                      color: COLORS.lightText
                    }}>
                      {user.lastSeen}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
