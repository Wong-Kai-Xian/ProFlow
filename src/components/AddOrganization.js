import React, { useState } from "react";

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
          background: "white",
          padding: "20px",
          borderRadius: "12px",
          width: "400px",
          boxShadow: "0 5px 15px rgba(0,0,0,0.3)"
        }}
      >
        <h2 style={{ marginBottom: "15px" }}>Add Organization</h2>
        <input
          type="text"
          value={orgName}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Enter organization name"
          style={{
            width: "100%",
            padding: "8px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            marginBottom: "10px"
          }}
        />
        {suggestions.length > 0 && (
          <ul style={{
            maxHeight: "150px",
            overflowY: "auto",
            border: "1px solid #eee",
            borderRadius: "8px",
            marginBottom: "10px",
            background: "#f9f9f9",
            listStyle: "none",
            padding: "5px"
          }}>
            {suggestions.map((s, i) => (
              <li
                key={i}
                onClick={() => handleSelect(s)}
                style={{ padding: "5px", cursor: "pointer" }}
              >
                {s}
              </li>
            ))}
          </ul>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button onClick={onClose} style={{ padding: "6px 12px", borderRadius: "6px", background: "#ccc" }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{ padding: "6px 12px", borderRadius: "6px", background: "#3498DB", color: "white" }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
