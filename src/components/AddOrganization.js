import React, { useState } from "react";
import { COLORS, LAYOUT, BUTTON_STYLES, INPUT_STYLES, CARD_STYLES } from "./profile-component/constants";

export default function AddOrganization({ onClose, onSave }) {
  const [orgName, setOrgName] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  const availableOrgs = [
    "Microsoft", "Google", "Amazon", "Meta", "Netflix", "Tesla", "OpenAI", "IBM",
  ];

  const handleSearch = (value) => {
    setOrgName(value);
    if (value.length > 0) {
      const filtered = availableOrgs.filter(org =>
        org.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const handleSelect = (name) => {
    setOrgName(name);
    setSuggestions([]);
  };

  const handleSave = () => {
    if (orgName) onSave(orgName);
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
          width: "90%",
          maxWidth: "400px",
          boxSizing: "border-box", // Ensure proper box model
        }}
      >
        <h2 style={{ marginBottom: LAYOUT.smallGap, color: COLORS.text }}>Add Organization</h2>
        <input
          type="text"
          value={orgName}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Enter organization name"
          style={{
            ...INPUT_STYLES.base,
            width: "100%",
            marginBottom: LAYOUT.smallGap,
            boxSizing: "border-box", // Ensure proper box model
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
            padding: LAYOUT.smallGap,
            boxSizing: "border-box", // Ensure proper box model
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
            onClick={handleSave}
            style={{ ...BUTTON_STYLES.primary }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
