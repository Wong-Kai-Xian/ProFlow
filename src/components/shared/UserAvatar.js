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
  const stableName = user?.displayName || user?.name || '';
  const stableEmail = user?.email || '';
  const initials = React.useMemo(() => {
    const base = (stableName && stableName.trim().length > 0) ? stableName : stableEmail;
    if (!base) return 'U';
    const parts = base.trim().split(/\s+/).filter(Boolean);
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return base.slice(0, 2).toUpperCase();
  }, [stableName, stableEmail]);

  // Generate color based on stable name or email
  const backgroundColor = React.useMemo(() => stringToColor(stableName || stableEmail || 'User'), [stableName, stableEmail]);
  
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
