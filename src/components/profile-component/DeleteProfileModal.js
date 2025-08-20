import React from "react";
import { COLORS, BUTTON_STYLES, LAYOUT } from "./constants";

export default function DeleteProfileModal({ isOpen, onClose, onDeleteConfirm, contactName }) {
  if (!isOpen) return null;

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <h3 style={{ color: COLORS.text, marginBottom: LAYOUT.gap }}>Confirm Deletion</h3>
        <p style={{ color: COLORS.text, marginBottom: LAYOUT.gap }}>
          Are you sure you want to delete <span style={{ fontWeight: "bold" }}>{contactName}</span> from your contacts?
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: LAYOUT.smallGap }}>
          <button onClick={onClose} style={{ ...BUTTON_STYLES.secondary }}>
            Cancel
          </button>
          <button onClick={onDeleteConfirm} style={{ ...BUTTON_STYLES.danger }}>
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
  backgroundColor: "rgba(0, 0, 0, 0.7)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
};

const modalContentStyle = {
  backgroundColor: COLORS.background,
  padding: LAYOUT.gap,
  borderRadius: LAYOUT.borderRadius,
  boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
  width: "90%",
  maxWidth: "400px",
  maxHeight: "80vh",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
};
