import React from 'react';
import Lottie from 'lottie-react';
import catAnim from '../../assets/cat.json';

export default function CatAvatar({ size = 42, onClick, fluffy = true, noBackground = false }) {
  const wrapperStyle = {
    width: size,
    height: size,
    borderRadius: noBackground ? 0 : '50%',
    overflow: noBackground ? 'visible' : 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: noBackground ? 'transparent' : 'linear-gradient(135deg,#fef3c7,#fde68a)',
    boxShadow: noBackground ? 'none' : (fluffy ? '0 6px 14px rgba(0,0,0,0.15)' : 'none'),
    transition: 'transform 200ms ease, box-shadow 200ms ease',
    cursor: onClick ? 'pointer' : 'default'
  };

  const handleMouseEnter = (e) => {
    if (!fluffy || noBackground) return;
    e.currentTarget.style.transform = 'scale(1.06)';
    e.currentTarget.style.boxShadow = '0 10px 22px rgba(0,0,0,0.18)';
  };
  const handleMouseLeave = (e) => {
    if (!fluffy || noBackground) return;
    e.currentTarget.style.transform = 'scale(1)';
    e.currentTarget.style.boxShadow = '0 6px 14px rgba(0,0,0,0.15)';
  };

  return (
    <div style={wrapperStyle} onClick={onClick} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <Lottie animationData={catAnim} loop={true} autoplay={true} style={{ width: size, height: size }} />
    </div>
  );
}
