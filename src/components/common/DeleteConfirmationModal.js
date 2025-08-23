import React from 'react';
import { DESIGN_SYSTEM, getButtonStyle } from '../../styles/designSystem';

export default function DeleteConfirmationModal({ isOpen, onClose, onConfirm, itemName, itemType = 'item' }) {
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
          Confirm Deletion
        </h2>
        <p style={{
          margin: `0 0 ${DESIGN_SYSTEM.spacing.lg} 0`,
          fontSize: DESIGN_SYSTEM.typography.fontSize.base,
          color: DESIGN_SYSTEM.colors.text.secondary,
        }}>
          Are you sure you want to delete this {itemType} <strong style={{ color: DESIGN_SYSTEM.colors.error }}>{itemName}</strong>? This action cannot be undone.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: DESIGN_SYSTEM.spacing.lg }}> {/* Increased gap here */}
          <button
            onClick={onClose}
            style={{
              ...getButtonStyle('secondary', 'neutral'),
              padding: `${DESIGN_SYSTEM.spacing.sm} ${DESIGN_SYSTEM.spacing.lg}`,
              fontSize: DESIGN_SYSTEM.typography.fontSize.base,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              ...getButtonStyle('primary', 'error'),
              padding: `${DESIGN_SYSTEM.spacing.sm} ${DESIGN_SYSTEM.spacing.lg}`,
              fontSize: DESIGN_SYSTEM.typography.fontSize.base,
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
