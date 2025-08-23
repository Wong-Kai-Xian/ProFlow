import React from "react";
import { DESIGN_SYSTEM, getButtonStyle } from '../../styles/designSystem'; // Import DESIGN_SYSTEM
// import { COLORS, BUTTON_STYLES, LAYOUT } from "./constants"; // Remove old imports

export default function DeleteProfileModal({ isOpen, onClose, onDeleteConfirm, contactName }) {
  console.log("DeleteProfileModal - isOpen:", isOpen, "contactName:", contactName);
  if (!isOpen) return null;

  return (
    <div style={{ ...modalOverlayStyle, zIndex: 99999, backgroundColor: 'rgba(0, 0, 0, 0.7)' }}>
      <div style={modalContentStyle}>
        <h3 style={{
          color: DESIGN_SYSTEM.colors.text.primary, // Use DESIGN_SYSTEM
          marginBottom: DESIGN_SYSTEM.spacing.md, // Use DESIGN_SYSTEM
          fontSize: DESIGN_SYSTEM.typography.fontSize.xl, // Use DESIGN_SYSTEM
          fontWeight: DESIGN_SYSTEM.typography.fontWeight.bold // Use DESIGN_SYSTEM
        }}>Confirm Deletion</h3>
        <p style={{
          color: DESIGN_SYSTEM.colors.text.secondary, // Use DESIGN_SYSTEM
          marginBottom: DESIGN_SYSTEM.spacing.lg // Use DESIGN_SYSTEM
        }}>
          Are you sure you want to delete <span style={{ fontWeight: "bold", color: DESIGN_SYSTEM.colors.error }}>{contactName}</span> from your contacts?
        </p>
        <div style={{
          display: "flex",
          justifyContent: "center", // Centered buttons
          gap: DESIGN_SYSTEM.spacing.lg // Use DESIGN_SYSTEM for gap
        }}>
          <button
            onClick={onClose}
            style={{
              ...getButtonStyle('secondary', 'neutral'), // Use getButtonStyle with neutral theme
              padding: `${DESIGN_SYSTEM.spacing.sm} ${DESIGN_SYSTEM.spacing.lg}`,
              fontSize: DESIGN_SYSTEM.typography.fontSize.base,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onDeleteConfirm}
            style={{
              ...getButtonStyle('primary', 'error'), // Use getButtonStyle with error theme
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

const modalOverlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.6)", // Slightly darker overlay
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
};

const modalContentStyle = {
  backgroundColor: DESIGN_SYSTEM.colors.background.primary, // Use DESIGN_SYSTEM
  padding: DESIGN_SYSTEM.spacing.xl, // Use DESIGN_SYSTEM
  borderRadius: DESIGN_SYSTEM.borderRadius.lg, // Use DESIGN_SYSTEM
  boxShadow: DESIGN_SYSTEM.shadows.lg, // Use DESIGN_SYSTEM
  width: "90%",
  maxWidth: "450px", // Match the generic DeleteConfirmationModal
  maxHeight: "80vh",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  textAlign: 'center', // Center align text inside modal
};
