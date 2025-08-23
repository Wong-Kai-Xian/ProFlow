import React, { useState } from 'react';
import { COLORS, LAYOUT, BUTTON_STYLES, INPUT_STYLES, CARD_STYLES } from './constants'; // Import constants

const AddReminderModal = ({ isOpen, onClose, onAddReminder }) => {
  const [title, setTitle] = useState(''); // Changed from reminderText
  const [date, setDate] = useState(''); // Changed from reminderDate
  const [time, setTime] = useState(''); // New state for time
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');

  const normalizeNaturalDate = (input) => {
    if (!input) return '';
    const s = String(input).trim().toLowerCase();
    const fmt = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const da = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${da}`;
    };
    const today = new Date();
    if (/^today$/.test(s)) return fmt(today);
    if (/^(tmr|tomorrow|tommorow|tommorrow)$/.test(s)) { const d = new Date(today); d.setDate(d.getDate() + 1); return fmt(d); }
    if (/^yesterday$/.test(s)) { const d = new Date(today); d.setDate(d.getDate() - 1); return fmt(d); }
    if (/^next\s*week$/.test(s)) { const d = new Date(today); d.setDate(d.getDate() + 7); return fmt(d); }
    const inDays = s.match(/^in\s+(\d+)\s+days?$/);
    if (inDays) { const d = new Date(today); d.setDate(d.getDate() + parseInt(inDays[1], 10)); return fmt(d); }
    const wd = s.match(/^next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
    if (wd) {
      const map = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };
      const target = map[wd[1]];
      const d = new Date(today);
      const cur = d.getDay();
      let add = (target + 7 - cur) % 7; if (add === 0) add = 7; d.setDate(d.getDate() + add);
      return fmt(d);
    }
    const iso = s.match(/^(\d{4}-\d{2}-\d{2})$/);
    if (iso) return iso[1];
    return '';
  };

  const handleAdd = () => {
    const normalizedDate = normalizeNaturalDate(date) || date;
    if (title.trim() && normalizedDate) {
      onAddReminder({
        title: title,
        date: normalizedDate,
        time: time || '',
        description: description,
        link: link,
      });
      setTitle('');
      setDate('');
      setTime('');
      setDescription('');
      setLink('');
      onClose();
    } else {
      alert('Please fill at least Title and a valid Date (supports "today", "tomorrow", "yesterday", "next week").');
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
