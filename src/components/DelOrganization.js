import React, { useState } from "react";
import { COLORS, LAYOUT, BUTTON_STYLES, INPUT_STYLES, CARD_STYLES } from "./profile-component/constants";

export default function DelOrganization({ organizations, onDelete, onClose }) {
  const [selectedOrg, setSelectedOrg] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  const handleSearch = (value) => {
    setSelectedOrg(value);
    if (value.length > 0) {
      const filtered = organizations
        .map(org => org.name)
        .filter(name => name.toLowerCase().includes(value.toLowerCase()));
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const handleSelect = (name) => {
    setSelectedOrg(name);
    setSuggestions([]);
  };

  const handleDelete = () => {
    if (selectedOrg) {
      if (window.confirm(`Are you sure you want to delete "${selectedOrg}" and all its profiles?`)) {
        onDelete(selectedOrg);
      }
    }
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(0,0,0,0.4)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999
      }}
    >
      <div
        style={{
          ...CARD_STYLES.base,
          width: "400px",
        }}
      >
        <h2 style={{ marginBottom: LAYOUT.smallGap, color: COLORS.text }}>Delete Organization</h2>
        <input
          type="text"
          value={selectedOrg}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Select organization to delete"
          style={{
            ...INPUT_STYLES.base,
            width: "100%",
            marginBottom: LAYOUT.smallGap
          }}
        />
        {suggestions.length > 0 && (
          <ul style={{
            maxHeight: "150px",
            overflowY: "auto",
            border: `1px solid ${COLORS.border}`,
            borderRadius: LAYOUT.smallBorderRadius,
            marginBottom: LAYOUT.smallGap,
            background: COLORS.light,
            listStyle: "none",
            padding: LAYOUT.smallGap
          }}>
            {suggestions.map((s, i) => (
              <li
                key={i}
                onClick={() => handleSelect(s)}
                style={{ padding: "5px", cursor: "pointer", color: COLORS.text }}
              >
                {s}
              </li>
            ))}
          </ul>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: LAYOUT.smallGap }}>
          <button onClick={onClose} style={{ ...BUTTON_STYLES.secondary }}>
            Cancel
          </button>
          <button
            onClick={handleDelete}
            style={{ ...BUTTON_STYLES.primary, background: COLORS.danger }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
