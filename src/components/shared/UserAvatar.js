import React from 'react';

// Shared UserAvatar component for consistent avatar display across the app
// Always shows initials only, no photo uploads
const UserAvatar = ({ user, size = 40, showBorder = true, borderColor = 'rgba(255,255,255,0.3)' }) => {
  const initials = user?.name 
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) 
    : user?.email?.slice(0, 2).toUpperCase() || 'U';
  
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.4,
      fontWeight: 'bold',
      border: showBorder ? `2px solid ${borderColor}` : 'none',
      flexShrink: 0
    }}>
      {initials}
    </div>
  );
};

export default UserAvatar;
