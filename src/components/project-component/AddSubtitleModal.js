import React, { useState } from 'react';
import { COLORS, LAYOUT, BUTTON_STYLES, INPUT_STYLES } from '../profile-component/constants';

const SUBTITLE_COLORS = [
  "#3498DB", // Blue
  "#E74C3C", // Red
  "#27AE60", // Green
  "#9B59B6", // Purple
  "#F39C12", // Orange
  "#1ABC9C", // Teal
];

export default function AddSubtitleModal({ isOpen, onClose, onAddSubtitle }) {
  const [subtitleName, setSubtitleName] = useState('');
  const [selectedColor, setSelectedColor] = useState(SUBTITLE_COLORS[0]);

  if (!isOpen) return null;

  const handleAddClick = () => {
    if (subtitleName.trim()) {
      onAddSubtitle(subtitleName.trim(), selectedColor); // Pass selected color
      setSubtitleName('');
      setSelectedColor(SUBTITLE_COLORS[0]); // Reset to default
      onClose();
    }
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
    }}>
      <div style={{
        background: COLORS.background,
        padding: LAYOUT.gap,
        borderRadius: LAYOUT.borderRadius,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        width: "400px",
        maxWidth: "90%",
        display: "flex",
        flexDirection: "column",
        gap: LAYOUT.gap,
      }}>
        <h3 style={{ margin: "0 0 10px 0", color: COLORS.text }}>Add New Subtitle</h3>
        <input
          type="text"
          placeholder="Subtitle Name"
          value={subtitleName}
          onChange={(e) => setSubtitleName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAddClick()}
          style={INPUT_STYLES.base}
        />

        {/* Color Picker */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: LAYOUT.smallGap, marginBottom: LAYOUT.smallGap }}>
          <p style={{ margin: "0", color: COLORS.text, width: "100%" }}>Choose a color:</p>
          {SUBTITLE_COLORS.map((color, index) => (
            <div
              key={index}
              onClick={() => setSelectedColor(color)}
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "50%",
                backgroundColor: color,
                border: `2px solid ${selectedColor === color ? COLORS.primary : COLORS.lightBorder}`,
                cursor: "pointer",
                transition: "border 0.2s ease-in-out",
              }}
              title={color}
            ></div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: LAYOUT.smallGap }}>
          <button onClick={onClose} style={BUTTON_STYLES.tertiary}>
            Cancel
          </button>
          <button onClick={handleAddClick} style={BUTTON_STYLES.primary}>
            Add Subtitle
          </button>
        </div>
      </div>
    </div>
  );
}
