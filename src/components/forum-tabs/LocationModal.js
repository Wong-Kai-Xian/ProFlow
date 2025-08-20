import React, { useState } from "react";

export default function LocationModal({ isOpen, onClose, onSave }) {
  const [location, setLocation] = useState("");

  const handleSave = () => {
    if (location.trim()) {
      onSave(location.trim());
      setLocation("");
      onClose();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

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
        backgroundColor: "white",
        borderRadius: "10px",
        padding: "20px",
        width: "90%",
        maxWidth: "400px",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)"
      }}>
        <h3 style={{ 
          margin: "0 0 15px 0", 
          color: "#2C3E50",
          fontSize: "18px"
        }}>
          Add Location
        </h3>
        
        <div style={{ marginBottom: "20px" }}>
          <label style={{
            display: "block",
            marginBottom: "8px",
            fontSize: "14px",
            fontWeight: "500",
            color: "#2C3E50"
          }}>
            Enter Location
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="e.g., Room 305, Main Building or Kuala Lumpur"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "6px",
              border: "1px solid #BDC3C7",
              fontSize: "14px",
              outline: "none",
              boxSizing: "border-box"
            }}
            autoFocus
          />
        </div>
        
        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "10px"
        }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "1px solid #BDC3C7",
              backgroundColor: "white",
              color: "#7F8C8D",
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!location.trim()}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: location.trim() ? "#3498DB" : "#BDC3C7",
              color: "white",
              cursor: location.trim() ? "pointer" : "not-allowed",
              fontSize: "14px"
            }}
          >
            Save Location
          </button>
        </div>
      </div>
    </div>
  );
}
