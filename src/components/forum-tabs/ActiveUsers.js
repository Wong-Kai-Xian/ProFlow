import React, { useState } from 'react';
import { COLORS } from '../profile-component/constants';
import UserAvatar from '../shared/UserAvatar';

export default function ActiveUsers({ members }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const usersWithStatus = members.map(member => ({
    id: member.id,
    name: member.name,
    avatar: member.name ? member.name[0].toUpperCase() : '?',
    email: member.email,
    isOnline: Math.random() > 0.5, // Randomly assign online status
    lastSeen: Math.random() > 0.5 ? `${Math.floor(Math.random() * 10) + 1} minutes ago` : null // Random last seen
  }));

  const onlineUsers = usersWithStatus.filter(user => user.isOnline);
  const offlineUsers = usersWithStatus.filter(user => !user.isOnline);

  const getAvatarColor = (name) => {
    const colors = ['#3498DB', '#E74C3C', '#27AE60', '#F39C12', '#9B59B6', '#E67E22'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '10px',
      padding: '12px',
      marginBottom: '15px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      border: '1px solid #ECF0F1'
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
        <div>
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
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: getAvatarColor(user.name),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: 'white',
                      opacity: 0.8
                    }}>
                      {user.avatar}
                    </div>
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
