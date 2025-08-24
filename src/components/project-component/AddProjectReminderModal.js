import React, { useState, useEffect } from 'react';
import { COLORS, LAYOUT, BUTTON_STYLES, INPUT_STYLES, CARD_STYLES } from '../profile-component/constants';

export default function AddProjectReminderModal({ isOpen, onClose, onSave, editingReminder }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  useEffect(() => {
    if (isOpen && editingReminder) {
      setTitle(editingReminder.title || '');
      setDescription(editingReminder.description || '');
      setDate(editingReminder.date || '');
      setTime(editingReminder.time || '');
    } else if (isOpen) {
      // Reset form when opening for a new reminder
      setTitle('');
      setDescription('');
      setDate('');
      setTime('');
    }
  }, [isOpen, editingReminder]);

  const handleSubmit = () => {
    if (!title || !date) {
      alert('Please fill in required fields: Title and Date.');
      return;
    }

    const reminderData = {
      title,
      description,
      date,
      time,
    };
    onSave(reminderData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0, 0, 0, 0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200 }}>
      <div style={{ backgroundColor: COLORS.white, borderRadius: LAYOUT.borderRadius, padding: LAYOUT.gap, width: '92%', maxWidth: 600, maxHeight: '85vh', overflowY: 'auto', boxShadow: CARD_STYLES.base.boxShadow }}>
        <h3 style={{ marginTop: 0, marginBottom: LAYOUT.gap, color: COLORS.dark, fontSize: '20px', textAlign: 'center' }}>
          {editingReminder ? 'Edit Project Reminder' : 'Add New Project Reminder'}
        </h3>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: COLORS.dark }}>Title:</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ ...INPUT_STYLES.base, width: '100%', boxSizing: 'border-box' }}
            placeholder="Reminder title"
            required
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: COLORS.dark }}>Description (optional):</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ ...INPUT_STYLES.textarea, width: '100%', boxSizing: 'border-box', minHeight: '100px' }} // Made bigger
            placeholder="Description for the reminder"
            rows="4"
          />
        </div>

        <div style={{ display: 'flex', gap: LAYOUT.smallGap, marginBottom: '15px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: COLORS.dark }}>Date:</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ ...INPUT_STYLES.base, width: '100%', boxSizing: 'border-box' }}
              required
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: COLORS.dark }}>Time:</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={{ ...INPUT_STYLES.base, width: '100%', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={onClose}
            style={{ ...BUTTON_STYLES.secondary, padding: '10px 20px' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{ ...BUTTON_STYLES.primary, padding: '10px 20px' }}
          >
            {editingReminder ? 'Update Reminder' : 'Add Reminder'}
          </button>
        </div>
      </div>
    </div>
  );
}
