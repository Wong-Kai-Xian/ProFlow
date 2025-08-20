import React, { useState } from "react";
import Card from "./Card";

export default function Reminders({ reminders, onAddReminder }) {
  const [newReminder, setNewReminder] = useState("");

  const handleAdd = () => {
    if (newReminder.trim()) {
      onAddReminder(newReminder);
      setNewReminder("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  return (
    <Card style={{ minHeight: "180px" }}>
      <h3>Reminders</h3>
      <div style={{ 
        display: "flex", 
        gap: "8px", 
        marginBottom: "10px" 
      }}>
        <input
          type="text"
          placeholder="New Reminder"
          value={newReminder}
          onChange={(e) => setNewReminder(e.target.value)}
          onKeyPress={handleKeyPress}
          style={{ 
            flex: 1, 
            padding: "6px", 
            borderRadius: "6px", 
            border: "1px solid #ccc",
            fontSize: "14px"
          }}
        />
        <button
          onClick={handleAdd}
          style={{ 
            padding: "6px 12px", 
            borderRadius: "6px", 
            background: "#3498DB", 
            color: "white", 
            border: "none",
            cursor: "pointer",
            fontSize: "14px"
          }}
        >
          Add
        </button>
      </div>
      <ul style={{ 
        marginTop: "10px", 
        maxHeight: "120px", 
        overflowY: "auto",
        listStyle: "none",
        padding: 0
      }}>
        {reminders.map((reminder, i) => (
          <li key={i} style={{ 
            padding: "8px", 
            background: "#f9f9f9", 
            borderRadius: "6px", 
            marginBottom: "6px",
            fontSize: "14px"
          }}>
            {reminder}
          </li>
        ))}
      </ul>
    </Card>
  );
}