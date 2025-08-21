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

  const getDaysLeft = (deadline) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reminderDate = new Date(deadline);
    reminderDate.setHours(0, 0, 0, 0);

    const timeDiff = reminderDate.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    if (daysDiff === 0) {
      return "Today";
    } else if (daysDiff === 1) {
      return "1 day left";
    } else if (daysDiff > 1) {
      return `${daysDiff} days left`;
    } else {
      return `${Math.abs(daysDiff)} days overdue`;
    }
  };

  const isOverdue = (deadline) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of today
    const reminderDate = new Date(deadline);
    reminderDate.setHours(0, 0, 0, 0); // Set to start of reminder date
    return reminderDate.getTime() < today.getTime();
  };

  const getReminderColor = (deadline) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of today
    const reminderDate = new Date(deadline);
    reminderDate.setHours(0, 0, 0, 0); // Set to start of reminder date

    const timeDiff = reminderDate.getTime() - today.getTime();
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

    if (daysDiff < 0) {
      return "#e74c3c"; // Red for overdue
    } else if (daysDiff <= 7) {
      return "#f39c12"; // Orange for due within 7 days
    } else {
      return "#27ae60"; // Green for far in the future
    }
  };

  const handleAddReminderClick = (newReminderData) => {
    onAddReminder(newReminderData);
    setShowModal(false);
  };

  const toggleExpand = (index) => {
    setExpandedReminder(expandedReminder === index ? null : index);
  };

  const sortedReminders = [...reminders].sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

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
            background: getReminderColor(reminder.deadline),
            borderRadius: "6px",
            marginBottom: "8px", 
            fontSize: "14px",
            color: "white",
            display: "flex",
            flexDirection: "column", 
            justifyContent: "space-between",
            alignItems: "flex-start" 
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", cursor: "pointer", alignItems: "center" }} onClick={() => toggleExpand(i)}>
              <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, overflow: "hidden" }}>
                <span style={{ fontSize: "16px", fontWeight: "bold" }}>{reminder.text}</span>
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
                {isOverdue(reminder.deadline) && <span style={{ fontWeight: "bold", marginLeft: "5px", fontSize: "12px" }}>OVERDUE</span>}
              </div>
              <div style={{ fontSize: "12px", opacity: 0.8, flexShrink: 0, marginLeft: "10px" }}>
                {getDaysLeft(reminder.deadline)}
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