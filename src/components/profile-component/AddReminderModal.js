import React, { useState } from 'react';
import { COLORS, LAYOUT, BUTTON_STYLES, INPUT_STYLES, CARD_STYLES } from './constants'; // Import constants

const AddReminderModal = ({ isOpen, onClose, onAddReminder }) => {
  const [title, setTitle] = useState(''); // Changed from reminderText
  const [date, setDate] = useState(''); // Changed from reminderDate
  const [time, setTime] = useState(''); // New state for time
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');

  const handleAdd = () => {
    if (title.trim() && date && time) { // Updated condition
      onAddReminder({
        title: title, // Changed from text
        date: date, // Changed from deadline
        time: time, // New time field
        description: description,
        link: link,
      });
      setTitle('');
      setDate('');
      setTime(''); // Reset time
      setDescription('');
      setLink('');
      onClose();
    } else {
      alert('Please fill in all required fields: Title, Date, and Time.');
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        ...CARD_STYLES.base,
        width: '400px',
        maxWidth: '90%',
        gap: LAYOUT.smallGap,
        display: 'flex',
        flexDirection: 'column',
        padding: LAYOUT.gap // Adjusted padding to use LAYOUT.gap
      }}>
        <h3 style={{ margin: 0, color: COLORS.text }}>Add New Reminder</h3>
        
        <input
          type="text"
          placeholder="Reminder Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ ...INPUT_STYLES.base, width: '100%', boxSizing: 'border-box' }}
          required
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ ...INPUT_STYLES.base, width: '100%', boxSizing: 'border-box' }}
          required
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          style={{ ...INPUT_STYLES.base, width: '100%', boxSizing: 'border-box' }}
          required
        />
        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows="3"
          style={{ ...INPUT_STYLES.textarea, width: '100%', boxSizing: 'border-box' }}
        ></textarea>
        <input
          type="text"
          placeholder="Link (optional)"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          style={{ ...INPUT_STYLES.base, width: '100%', boxSizing: 'border-box' }}
        />

        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: LAYOUT.smallGap,
        }}>
          <button onClick={onClose} style={{ ...BUTTON_STYLES.secondary }}>Cancel</button>
          <button onClick={handleAdd} style={{ ...BUTTON_STYLES.primary }}>Add Reminder</button>
        </div>
      </div>
    </div>
  );
};

export default AddReminderModal;
