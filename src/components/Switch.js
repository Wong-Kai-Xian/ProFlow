import React from 'react';
import { COLORS } from './profile-component/constants';

const Switch = ({ isOn, handleToggle, onColor, offColor, labelText }) => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }}>
      {labelText && <span style={{ fontSize: '12px', color: COLORS.text }}>{labelText}</span>}
      <div
        onClick={handleToggle}
        style={{
          width: '40px',
          height: '20px',
          borderRadius: '10px',
          backgroundColor: isOn ? onColor || COLORS.primary : offColor || COLORS.lightText,
          position: 'relative',
          cursor: 'pointer',
          transition: 'background-color 0.2s ease',
        }}
      >
        <div
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            backgroundColor: 'white',
            position: 'absolute',
            top: '2px',
            left: isOn ? '22px' : '2px',
            transition: 'left 0.2s ease, background-color 0.2s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
          }}
        />
      </div>
    </div>
  );
};

export default Switch;
