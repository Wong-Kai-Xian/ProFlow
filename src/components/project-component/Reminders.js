import React, { useState, useEffect } from 'react';
import { COLORS, LAYOUT, BUTTON_STYLES, INPUT_STYLES } from '../profile-component/constants';
import { db } from "../../firebase"; // Import db
import { collection, addDoc, deleteDoc, onSnapshot, query, orderBy, doc, updateDoc, serverTimestamp } from "firebase/firestore"; // Import Firestore functions and serverTimestamp, updateDoc
import AddProjectReminderModal from "./AddProjectReminderModal"; // Import AddProjectReminderModal

export default function Reminders({ projectId }) {
  const [reminders, setReminders] = useState([]);
  const [showModal, setShowModal] = useState(false); // State for AddReminderModal
  const [editingReminder, setEditingReminder] = useState(null); // State for editing reminder

  useEffect(() => {
    if (projectId) {
      const remindersRef = collection(db, "projects", projectId, "reminders");
      const q = query(remindersRef, orderBy("date", "asc"), orderBy("time", "asc")); // Order by date and time

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const remindersList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setReminders(remindersList);
      });

      return () => unsubscribe(); // Cleanup on unmount
    }
  }, [projectId]);

  const handleAddReminder = async (newReminderData) => {
    if (!projectId) return;
    try {
      await addDoc(collection(db, "projects", projectId, "reminders"), {
        ...newReminderData,
        timestamp: serverTimestamp(), // Use serverTimestamp
      });
      setShowModal(false);
    } catch (error) {
      console.error("Error adding reminder: ", error);
    }
  };

  const handleUpdateReminder = async (id, updatedReminderData) => {
    if (!projectId || !id) return;
    try {
      const reminderRef = doc(db, "projects", projectId, "reminders", id);
      await updateDoc(reminderRef, updatedReminderData);
      setShowModal(false);
      setEditingReminder(null);
    } catch (error) {
      console.error("Error updating reminder: ", error);
    }
  };

  const handleRemoveReminder = async (id) => {
    if (!projectId) return;
    if (!window.confirm("Are you sure you want to delete this reminder?")) return; // Add confirmation
    try {
      await deleteDoc(doc(db, "projects", projectId, "reminders", id));
    } catch (error) {
      console.error("Error removing reminder: ", error);
    }
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

      {/* Add Reminder Button */}
      <button
        onClick={() => { setEditingReminder(null); setShowModal(true); }}
        style={{
          ...BUTTON_STYLES.primary,
          marginBottom: LAYOUT.smallGap,
          width: "100%",
        }}
      >
        + Add New Reminder
      </button>

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
                <p style={{ margin: 0, color: COLORS.text, fontSize: "14px", fontWeight: "bold" }}>{reminder.title}</p>
                <small style={{ color: COLORS.lightText, fontSize: "12px" }}>{reminder.date} {reminder.time ? `at ${reminder.time}` : ''}</small>
              </div>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button
                  onClick={() => {
                    if (!reminder?.date) return;
                    const time = (reminder.time && reminder.time.trim()) ? reminder.time : '09:00';
                    const start = new Date(`${reminder.date}T${time}`);
                    if (isNaN(start.getTime())) return;
                    const dt = start.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//ProFlow//EN\nBEGIN:VEVENT\nUID:${(reminder.id || Math.random()) + '@proflow'}\nDTSTAMP:${dt}\nDTSTART:${dt}\nSUMMARY:${(reminder.title || '').replace(/\n/g,' ')}\nDESCRIPTION:${(reminder.description || '').replace(/\n/g,' ')}\nEND:VEVENT\nEND:VCALENDAR`;
                    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${(reminder.title || 'reminder').replace(/[^a-z0-9]+/gi,'-')}.ics`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: COLORS.primary,
                    fontSize: "16px",
                    cursor: "pointer",
                  }}
                  title="Add to Calendar"
                >
                  📅
                </button>
                <button
                  onClick={() => { setEditingReminder(reminder); setShowModal(true); }}
                  style={{
                    background: "none",
                    border: "none",
                    color: COLORS.primary,
                    fontSize: "16px",
                    cursor: "pointer",
                  }}
                >
                  ✏️
                </button>
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
                  🗑️
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
      <AddProjectReminderModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={editingReminder ? (data) => handleUpdateReminder(editingReminder.id, data) : handleAddReminder}
        editingReminder={editingReminder}
      />
    </div>
  );
}
