import React from 'react';
import { COLORS, BUTTON_STYLES, LAYOUT } from '../profile-component/constants';

export default function ConfirmationModal({ isOpen, onClose, onConfirm, message }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: COLORS.white,
        borderRadius: LAYOUT.borderRadius,
        padding: '30px', // Increased padding
        width: '90%',
        maxWidth: '500px', // Increased max width
        boxShadow: LAYOUT.shadow,
        textAlign: 'center'
      }}>
        <h3 style={{ 
          marginTop: 0, 
          marginBottom: LAYOUT.gap, 
          color: COLORS.dark, 
          fontSize: '18px' 
        }}>
          Confirm Action
        </h3>
        <p style={{ 
          marginBottom: LAYOUT.gap, 
          color: COLORS.text, 
          fontSize: '15px' 
        }}>
          {message || "Are you sure you want to proceed?"}
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: LAYOUT.smallGap }}>
          <button 
            onClick={onClose} 
            style={{ ...BUTTON_STYLES.secondary, padding: '10px 20px' }}
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm} 
            style={{ ...BUTTON_STYLES.danger, padding: '10px 20px' }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
