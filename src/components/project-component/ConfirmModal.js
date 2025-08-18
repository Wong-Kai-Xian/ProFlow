import React from "react";

export default function ConfirmModal({ visible, onConfirm, onCancel, message }) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          padding: "20px",
          borderRadius: "10px",
          width: "300px",
          textAlign: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
        }}
      >
        <p style={{ marginBottom: "20px" }}>{message}</p>
        <div style={{ display: "flex", justifyContent: "space-around" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 15px",
              borderRadius: "5px",
              border: "1px solid #ccc",
              backgroundColor: "#f0f0f0",
              cursor: "pointer"
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "8px 15px",
              borderRadius: "5px",
              border: "none",
              backgroundColor: "#28a745",
              color: "#fff",
              cursor: "pointer"
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
