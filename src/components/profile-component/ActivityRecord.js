import React, { useState } from "react";
import Card from "./Card";
import { COLORS, BUTTON_STYLES, INPUT_STYLES, ACTIVITY_TYPES } from "./constants";

export default function ActivityRecord({ activities, onAddActivity }) {
  const [newActivity, setNewActivity] = useState("");
  const [newType, setNewType] = useState("Gmail");

  const handleAddActivity = () => {
    if (!newActivity.trim()) return;

    const now = new Date();
    const timestamp = now.toLocaleString();

    onAddActivity({
      type: newType,
      time: timestamp,
      description: newActivity.trim()
    });

    setNewActivity("");
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleAddActivity();
    }
  };

  return (
    <Card style={{ minHeight: "300px" }}>
      {/* Header */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: "15px"
      }}>
        <h3 style={{ margin: 0, color: COLORS.text }}>Activity Record</h3>
        <button
          onClick={handleAddActivity}
          style={BUTTON_STYLES.primary}
        >
          + Add
        </button>
      </div>

      {/* Input Row */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
          style={{
            ...INPUT_STYLES.base,
            minWidth: "100px",
          }}
        >
          {ACTIVITY_TYPES.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Enter activity description"
          value={newActivity}
          onChange={(e) => setNewActivity(e.target.value)}
          onKeyPress={handleKeyPress}
          style={{
            ...INPUT_STYLES.base,
            flex: 1
          }}
        />
      </div>

      {/* Activity List */}
      {activities.length === 0 ? (
        <p style={{ 
          color: COLORS.lightText, 
          fontSize: "14px", 
          fontStyle: "italic",
          textAlign: "center",
          padding: "20px 0"
        }}>
          No activities recorded yet. Add one to get started!
        </p>
      ) : (
        <ul style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          maxHeight: "200px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }}>
          {activities.map((activity, index) => (
            <li
              key={index}
              style={{
                background: "#f8f9fa",
                borderRadius: "8px",
                padding: "12px",
                border: `1px solid ${COLORS.lightBorder}`,
                transition: "all 0.2s ease"
              }}
            >
              <div style={{ 
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "4px"
              }}>
                <span style={{
                  background: COLORS.primary,
                  color: "white",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  fontSize: "11px",
                  fontWeight: "600"
                }}>
                  {activity.type}
                </span>
                <span style={{ 
                  fontSize: "12px", 
                  color: COLORS.lightText 
                }}>
                  {activity.time}
                </span>
              </div>
              <div style={{ 
                fontSize: "14px", 
                color: COLORS.text,
                lineHeight: "1.4"
              }}>
                {activity.description}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
