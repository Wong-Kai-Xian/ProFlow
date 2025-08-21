import React, { useState } from 'react';
import { COLORS, LAYOUT, BUTTON_STYLES, INPUT_STYLES } from '../profile-component/constants';

export default function Reminders({ reminders, setReminders }) {
  const [newReminderText, setNewReminderText] = useState('');

  const handleAddReminder = () => {
    if (newReminderText.trim()) {
      const newReminder = {
        id: Date.now() + Math.random(),
        text: newReminderText.trim(),
        timestamp: new Date().toLocaleString(),
      };
      setReminders((prevReminders) => [newReminder, ...prevReminders]); // Add new reminders to the top
      setNewReminderText('');
    }
  };

  const handleRemoveReminder = (id) => {
    setReminders((prevReminders) => prevReminders.filter(reminder => reminder.id !== id));
  };

  return (
    <div style={{
      background: COLORS.cardBackground,
      padding: LAYOUT.gap,
      borderRadius: LAYOUT.borderRadius,
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      display: "flex",
      flexDirection: "column",
      flexGrow: 1,
      minHeight: 0,
    }}>
      <h3 style={{ margin: "0 0 10px 0", color: COLORS.text }}>Reminders</h3>

      {/* Add Reminder Input */}
      <div style={{ display: "flex", gap: LAYOUT.smallGap, marginBottom: LAYOUT.smallGap }}>
        <input
          type="text"
          placeholder="Add a new reminder..."
          value={newReminderText}
          onChange={(e) => setNewReminderText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAddReminder()}
          style={{
            ...INPUT_STYLES.base,
            flex: 1,
          }}
        />
        <button
          onClick={handleAddReminder}
          style={BUTTON_STYLES.primary}
        >
          Add
        </button>
      </div>

      {/* Reminders List */}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, overflowY: "auto", flexGrow: 1 }}>
        {reminders.length === 0 ? (
          <p style={{ color: COLORS.lightText, fontSize: "14px", fontStyle: "italic" }}>No reminders yet.</p>
        ) : (
          reminders.map((reminder) => (
            <li key={reminder.id} style={{
              background: COLORS.light,
              padding: LAYOUT.smallGap,
              borderRadius: LAYOUT.smallBorderRadius,
              marginBottom: LAYOUT.smallGap,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div>
                <p style={{ margin: 0, color: COLORS.text, fontSize: "14px" }}>{reminder.text}</p>
                <small style={{ color: COLORS.lightText, fontSize: "10px" }}>{reminder.timestamp}</small>
              </div>
              <button
                onClick={() => handleRemoveReminder(reminder.id)}
                style={{
                  background: "none",
                  border: "none",
                  color: COLORS.danger,
                  fontSize: "16px",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
