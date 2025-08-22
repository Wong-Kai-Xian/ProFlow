import React, { useState } from 'react';
import { COLORS, BUTTON_STYLES, INPUT_STYLES } from '../profile-component/constants';

export default function JoinProjectModal({ isOpen, onClose, onJoin, joinProjectError }) {
  const [projectId, setProjectId] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (projectId.trim()) {
      onJoin(projectId.trim());
    }
  };

  const handleClose = () => {
    setProjectId('');
    onClose();
  };

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
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '32px',
        borderRadius: '16px',
        width: '90%',
        maxWidth: '480px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
        border: '1px solid #f0f0f0'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{ 
            margin: 0, 
            color: COLORS.dark,
            fontSize: '24px',
            fontWeight: '700'
          }}>
            Join Project
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: COLORS.lightText,
              padding: '4px',
              borderRadius: '4px'
            }}
          >
            ✕
          </button>
        </div>

        <p style={{
          color: COLORS.lightText,
          marginBottom: '24px',
          fontSize: '16px',
          lineHeight: '1.5'
        }}>
          Enter the Project ID shared with you to join an existing project.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: COLORS.dark,
              fontSize: '16px',
              fontWeight: '600'
            }}>
              Project ID
            </label>
            <input
              type="text"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="e.g., proj123abc456"
              style={{
                ...INPUT_STYLES.base,
                width: '100%',
                padding: '14px 16px',
                fontSize: '16px',
                borderRadius: '8px',
                border: `2px solid ${COLORS.border}`,
                boxSizing: 'border-box'
              }}
              autoFocus
            />
          </div>

          {joinProjectError && (
            <div style={{
              backgroundColor: '#fdf2f2',
              border: '1px solid #fca5a5',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <p style={{ 
                color: COLORS.danger, 
                margin: 0, 
                fontSize: '14px',
                fontWeight: '500'
              }}>
                {joinProjectError}
              </p>
            </div>
          )}

          <div style={{ 
            display: 'flex', 
            gap: '12px',
            justifyContent: 'flex-end'
          }}>
            <button
              type="button"
              onClick={handleClose}
              style={{
                ...BUTTON_STYLES.secondary,
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: '600',
                borderRadius: '8px'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!projectId.trim()}
              style={{
                ...BUTTON_STYLES.primary,
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: '600',
                borderRadius: '8px',
                opacity: !projectId.trim() ? 0.6 : 1,
                cursor: !projectId.trim() ? 'not-allowed' : 'pointer'
              }}
            >
              Join Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
