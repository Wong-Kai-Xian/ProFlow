import React from 'react';
import { COLORS, LAYOUT, BUTTON_STYLES } from '../profile-component/constants';

export default function ApprovalModal({ isOpen, onClose, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000
    }}>
      <div style={{
        background: COLORS.background,
        padding: LAYOUT.gap,
        borderRadius: LAYOUT.borderRadius,
        boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
        width: "400px",
        display: "flex",
        flexDirection: "column",
        gap: LAYOUT.smallGap,
      }}>
        <h3 style={{ margin: 0, color: COLORS.text }}>Advance Stage Approval</h3>
        
        <p style={{ color: COLORS.text, fontSize: "14px", lineHeight: "1.5" }}>
          Are you sure you want to advance to the next stage? All tasks in the current stage must be complete.
        </p>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: LAYOUT.smallGap, marginTop: LAYOUT.smallGap }}>
          <button onClick={onClose} style={{ ...BUTTON_STYLES.secondary }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{ ...BUTTON_STYLES.primary }}>
            Send Approval & Advance
          </button>
        </div>
      </div>
    </div>
  );
}
