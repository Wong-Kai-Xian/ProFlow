import React from 'react';
import { DESIGN_SYSTEM, getButtonStyle } from '../../styles/designSystem';

export default function ConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmButtonType = 'primary',
  isLoading = false 
}) {
  if (!isOpen) return null;

  const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  };

  const modalContentStyle = {
    backgroundColor: DESIGN_SYSTEM.colors.background.primary,
    padding: DESIGN_SYSTEM.spacing.xl,
    borderRadius: DESIGN_SYSTEM.borderRadius.lg,
    maxWidth: '450px',
    width: '90%',
    boxShadow: DESIGN_SYSTEM.shadows.lg,
    textAlign: 'center',
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <h2 style={{
          margin: `0 0 ${DESIGN_SYSTEM.spacing.md} 0`,
          fontSize: DESIGN_SYSTEM.typography.fontSize['xl'],
          fontWeight: DESIGN_SYSTEM.typography.fontWeight.bold,
          color: DESIGN_SYSTEM.colors.text.primary,
        }}>
          {title}
        </h2>
        <p style={{
          margin: `0 0 ${DESIGN_SYSTEM.spacing.lg} 0`,
          fontSize: DESIGN_SYSTEM.typography.fontSize.base,
          color: DESIGN_SYSTEM.colors.text.secondary,
          lineHeight: 1.5,
        }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: DESIGN_SYSTEM.spacing.lg }}>
          <button
            onClick={onClose}
            style={{
              ...getButtonStyle('secondary', 'neutral'),
              padding: `${DESIGN_SYSTEM.spacing.sm} ${DESIGN_SYSTEM.spacing.lg}`,
              fontSize: DESIGN_SYSTEM.typography.fontSize.base,
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              ...getButtonStyle('primary', confirmButtonType === 'danger' ? 'error' : 'home'),
              padding: `${DESIGN_SYSTEM.spacing.sm} ${DESIGN_SYSTEM.spacing.lg}`,
              fontSize: DESIGN_SYSTEM.typography.fontSize.base,
              opacity: isLoading ? 0.6 : 1,
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
