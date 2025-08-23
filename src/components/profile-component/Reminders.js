import React, { useState } from "react";
import Card from "./Card";
import AddReminderModal from "./AddReminderModal"; // Import the new modal component
import { COLORS, BUTTON_STYLES } from "./constants"; // Import COLORS and BUTTON_STYLES

export default function Reminders({ reminders, onAddReminder, onReminderRemove }) {
  const [showModal, setShowModal] = useState(false); // State to control modal visibility
  const [expandedReminder, setExpandedReminder] = useState(null);

  const truncateDescription = (description, maxLength) => {
    if (description.length <= maxLength) return description;
    return description.substring(0, maxLength) + "...";
  };

  const toDate = (dateStr, timeStr) => {
    if (!dateStr) return null;
    const time = (timeStr && timeStr.trim()) ? timeStr : '09:00';
    const d = new Date(`${dateStr}T${time}`);
    return isNaN(d.getTime()) ? null : d;
  };

  const getDaysLeft = (dateStr, timeStr) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reminderDateTime = toDate(dateStr, timeStr);
    if (!reminderDateTime) return "-";
    reminderDateTime.setHours(reminderDateTime.getHours(), reminderDateTime.getMinutes(), 0, 0);
    const diffTime = reminderDateTime.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "1 day left";
    return `${diffDays} days left`;
  };

  const isOverdue = (dateStr, timeStr) => {
    const today = new Date();
    const d = toDate(dateStr, timeStr);
    if (!d) return false;
    return d.getTime() < today.getTime();
  };

  const getReminderColor = (dateStr, timeStr) => {
    const today = new Date();
    const d = toDate(dateStr, timeStr);
    if (!d) return COLORS.secondary;
    const timeDiff = d.getTime() - today.getTime();
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
    if (daysDiff < 0) return COLORS.danger;
    if (daysDiff <= 7) return COLORS.warning;
    return COLORS.success;
  };

  const handleAddReminderClick = (newReminderData) => {
    onAddReminder(newReminderData);
    setShowModal(false);
  };

  const toggleExpand = (index) => {
    setExpandedReminder(expandedReminder === index ? null : index);
  };

  const sortedReminders = [...reminders].sort((a, b) => {
    const dateA = toDate(a.date, a.time) || new Date(8640000000000000);
    const dateB = toDate(b.date, b.time) || new Date(8640000000000000);
    return dateA.getTime() - dateB.getTime();
  });

  return (
    <Card style={{ minHeight: "auto", padding: "15px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
        <h3 style={{ margin: "0", color: COLORS.text }}>Reminders</h3>
        <button
          onClick={() => setShowModal(true)}
          style={{
            ...BUTTON_STYLES.primary, // Apply primary button styles
            fontSize: "14px"
          }}
        >
          Add Reminder
        </button>
      </div>
      <ul style={{ 
        marginTop: "10px", 
        maxHeight: "250px", 
        overflowY: "auto",
        listStyle: "none",
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: "8px"
      }}>
        {sortedReminders.map((reminder, i) => (
          <li key={i} style={{
            padding: "10px", 
            background: getReminderColor(reminder.date, reminder.time),
            borderRadius: "6px",
            marginBottom: "8px", 
            fontSize: "14px",
            color: "white",
            display: "flex",
            flexDirection: "column", 
            justifyContent: "space-between",
            alignItems: "flex-start",
            position: "relative"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", cursor: "pointer", alignItems: "center" }} onClick={() => toggleExpand(i)}>
              <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, overflow: "hidden" }}>
                <span style={{ fontSize: "16px", fontWeight: "bold" }}>{reminder.title}</span>
                {reminder.description && (
                  <span style={{ 
                    fontSize: "12px", 
                    opacity: 0.8, 
                    marginTop: "4px", 
                    lineHeight: "1.2em", 
                    minHeight: reminder.description ? "1.2em" : "0em" 
                  }}>
                    {reminder.description && reminder.description}
                  </span>
                )}
                {reminder.link && expandedReminder !== i && (
                  <a 
                    href={reminder.link} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    style={{ 
                      fontSize: "12px", 
                      opacity: 0.8, 
                      marginTop: "4px", 
                      color: "white", 
                      textDecoration: "underline",
                      maxWidth: "100%",
                      display: "block" 
                    }}
                    onClick={(e) => e.stopPropagation()} 
                  >
                    {reminder.link}
                  </a>
                )}
              </div>
              <div style={{ fontSize: "12px", opacity: 0.8, flexShrink: 0, marginLeft: "10px" }}>
                {getDaysLeft(reminder.date, reminder.time)}
              </div>
            </div>
            {expandedReminder === i && (
              <div style={{ marginTop: "10px", width: "100%" }}>
                {reminder.description && <p style={{ margin: "5px 0" }}>**Description:** {reminder.description}</p>}
                {reminder.link && (
                  <p style={{ margin: "5px 0" }}>
                    **Link:** <a href={reminder.link} target="_blank" rel="noopener noreferrer" style={{ color: "white" }}>{reminder.link}</a>
                  </p>
                )}
              </div>
            )}
            <button 
              onClick={() => onReminderRemove(i)} 
              style={{ ...BUTTON_STYLES.primary, background: COLORS.danger, padding: "4px 8px", cursor: "pointer", marginTop: "10px", alignSelf: "flex-end" }}
            >
              Remove
            </button>
            {isOverdue(reminder.date, reminder.time) && (
              <span style={{ 
                position: "absolute",
                bottom: "8px",
                left: "10px",
                fontSize: "11px",
                fontWeight: "bold",
                color: "#fff",
                background: "rgba(231, 76, 60, 0.9)",
                padding: "2px 6px",
                borderRadius: "4px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
              }}>
                OVERDUE
              </span>
            )}
          </li>
        ))}
      </ul>
      <AddReminderModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        onAddReminder={handleAddReminderClick}
      />
    </Card>
  );
}