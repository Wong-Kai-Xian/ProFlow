import React, { useState, useEffect } from 'react';
import { COLORS, INPUT_STYLES, BUTTON_STYLES, CARD_STYLES, LAYOUT } from '../profile-component/constants'; // Import CARD_STYLES and LAYOUT

export default function AddReminderModal({ isOpen, onClose, onSave, editingReminder }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [type, setType] = useState('meeting'); // Default type
  const [priority, setPriority] = useState('medium'); // Default priority
  const [description, setDescription] = useState(''); // Added description state

  useEffect(() => {
    if (isOpen && editingReminder) {
      setTitle(editingReminder.title || '');
      setDate(editingReminder.date || '');
      setTime(editingReminder.time || '');
      setType(editingReminder.type || 'meeting');
      setPriority(editingReminder.priority || 'medium');
      setDescription(editingReminder.description || ''); // Set description on edit
    } else if (isOpen) {
      // Reset form when opening for a new reminder
      setTitle('');
      setDate('');
      setTime('');
      setType('meeting');
      setPriority('medium');
      setDescription(''); // Reset description on new reminder
    }
  }, [isOpen, editingReminder]);

  const handleSubmit = () => {
    if (!title) {
      alert('Please fill in the Title.');
      return;
    }
    if (!date && !time) {
      alert('Please provide at least a Date or a Time.');
      return;
    }

    const reminderData = {
      title,
      date,
      time,
      type,
      priority,
      description, // Include description in the data
    };
    onSave(reminderData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: COLORS.white,
        borderRadius: LAYOUT.borderRadius,
        padding: LAYOUT.gap,
        width: '90%',
        maxWidth: '500px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: CARD_STYLES.base.boxShadow // Reuse card shadow
      }}>
        <h3 style={{ 
          marginTop: 0, 
          marginBottom: '20px', 
          color: COLORS.dark, 
          fontSize: '20px',
          textAlign: 'center'
        }}>
          {editingReminder ? 'Edit Forum Reminder' : 'Add New Forum Reminder'} {/* Updated title */}
        </h3>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: COLORS.dark }}>Title:</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ ...INPUT_STYLES.base, width: '100%', boxSizing: 'border-box' }} // Apply base style for consistency
            placeholder="Reminder title"
            required
          />
        </div>

        <div style={{ display: 'flex', gap: LAYOUT.smallGap, marginBottom: '15px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: COLORS.dark }}>Date (optional):</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ ...INPUT_STYLES.base, width: '100%', boxSizing: 'border-box' }} // Apply base style
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: COLORS.dark }}>Time (optional):</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={{ ...INPUT_STYLES.base, width: '100%', boxSizing: 'border-box' }} // Apply base style
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: LAYOUT.smallGap, marginBottom: '15px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: COLORS.dark }}>Type:</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={{ ...INPUT_STYLES.select, width: '100%', boxSizing: 'border-box' }} // Apply select style
            >
              <option value="meeting">Meeting</option>
              <option value="deadline">Deadline</option>
              <option value="event">Event</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: COLORS.dark }}>Priority:</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              style={{ ...INPUT_STYLES.select, width: '100%', boxSizing: 'border-box' }} // Apply select style
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: COLORS.dark }}>Description (optional):</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ ...INPUT_STYLES.textarea, width: '100%', boxSizing: 'border-box' }} // Apply textarea style
            placeholder="Description for the reminder"
            rows="3"
          />
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
