import React from 'react';

// Generate a consistent color based on string (same as CustomerProfileList)
const stringToColor = (str) => {
  if (!str) return '#3b82f6'; // Default blue color
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return "#" + "00000".substring(0, 6 - c.length) + c;
};

// Shared UserAvatar component for consistent avatar display across the app
// Always shows initials only, no photo uploads
const UserAvatar = ({ user, size = 40, showBorder = true, borderColor = 'rgba(255,255,255,0.3)', shape = 'circle', style = {} }) => {
  const initials = (() => {
    const name = user?.name;
    const email = user?.email;
    if (typeof name === 'string' && name.trim().length > 0) {
      return name.trim().split(/\s+/).map(n => n && n[0] ? n[0].toUpperCase() : '').join('').slice(0, 2) || 'U';
    }
    if (typeof email === 'string' && email.length > 0) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'U';
  })();
  
  // Generate color based on name or email
  const colorSource = (typeof user?.name === 'string' && user.name.length > 0) ? user.name : ((typeof user?.email === 'string' && user.email.length > 0) ? user.email : 'User');
  const backgroundColor = stringToColor(colorSource);
  
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: shape === 'circle' ? '50%' : '8px',
      backgroundColor,
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.4,
      fontWeight: 'bold',
      border: showBorder ? `2px solid ${borderColor}` : 'none',
      flexShrink: 0,
      ...style
    }}>
      {initials}
    </div>
  );
};

export default UserAvatar;
