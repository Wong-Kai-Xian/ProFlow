import React, { useState } from "react";

export default function ActivityRecord() {
  const [activities, setActivities] = useState([
    { type: "Gmail", time: "2025-08-20 10:00", description: "Sent introduction email" },
    { type: "Call", time: "2025-08-20 14:00", description: "Scheduled call with client" },
  ]);

  const [newActivity, setNewActivity] = useState("");
  const [newType, setNewType] = useState("Gmail");

  const handleAddActivity = () => {
    if (!newActivity.trim()) return;

    const now = new Date();
    const timestamp = now.toLocaleString();

    setActivities([
      ...activities,
      { type: newType, time: timestamp, description: newActivity },
    ]);

    setNewActivity("");
  };

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        padding: "20px",
        minHeight: "350px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Activity Record</h3>
        <button
          onClick={handleAddActivity}
          style={{
            background: "#3498DB",
            color: "#fff",
            border: "none",
            padding: "6px 14px",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          + Add
        </button>
      </div>

      {/* Input Row */}
      <div style={{ display: "flex", gap: "10px" }}>
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
          style={{
            padding: "6px 8px",
            borderRadius: "6px",
            border: "1px solid #ccc",
            minWidth: "100px",
          }}
        >
          <option value="Call">Call</option>
          <option value="Gmail">Gmail</option>
          <option value="Meeting">Meeting</option>
        </select>
        <input
          type="text"
          placeholder="Enter activity description"
          value={newActivity}
          onChange={(e) => setNewActivity(e.target.value)}
          style={{
            flex: 1,
            padding: "6px 10px",
            borderRadius: "6px",
            border: "1px solid #ccc",
          }}
        />
      </div>

      {/* Activity List */}
      <ul
        style={{
          marginTop: "10px",
          overflowY: "auto",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {activities.map((a, i) => (
          <li
            key={i}
            style={{
              background: "#f9f9f9",
              borderRadius: "8px",
              padding: "12px 16px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              boxShadow: "inset 0 0 2px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ fontWeight: "bold", fontSize: "14px" }}>
              [{a.type}] {a.time}
            </div>
            <div style={{ fontSize: "13px", color: "#555" }}>{a.description}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
