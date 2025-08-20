import React from 'react';
import { COLORS } from './constants';

const IncompleteStageModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
        maxWidth: '400px',
        textAlign: 'center'
      }}>
        <h4 style={{ color: COLORS.danger, marginBottom: '15px' }}>Incomplete Stage!</h4>
        <p style={{ marginBottom: '20px' }}>Please complete the current and all preceding stages before proceeding to this stage.</p>
        <button
          onClick={onClose}
          style={{
            padding: '8px 15px',
            borderRadius: '5px',
            background: COLORS.primary,
            color: 'white',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          Got It
        </button>
      </div>
    </div>
  );
};

export default IncompleteStageModal;
