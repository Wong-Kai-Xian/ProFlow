import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { COLORS, LAYOUT, BUTTON_STYLES, INPUT_STYLES } from '../profile-component/constants';
import { db } from "../../firebase"; // Import db
import { collection, addDoc, deleteDoc, onSnapshot, query, orderBy, doc, updateDoc, serverTimestamp } from "firebase/firestore"; // Import Firestore functions and serverTimestamp, updateDoc
import AddProjectReminderModal from "./AddProjectReminderModal"; // Import AddProjectReminderModal

export default function Reminders({ projectId, autoOpenReminderId }) {
  const [reminders, setReminders] = useState([]);
  const [showModal, setShowModal] = useState(false); // State for AddReminderModal
  const [editingReminder, setEditingReminder] = useState(null); // State for editing reminder
  const [openActionsId, setOpenActionsId] = useState(null); // Which reminder's actions menu is open
  const [actionsPos, setActionsPos] = useState({ top: 0, left: 0 });
  const [viewReminder, setViewReminder] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const closeActions = useCallback(() => setOpenActionsId(null), []);

  useEffect(() => {
    if (!openActionsId) return;
    const onWin = () => closeActions();
    window.addEventListener('scroll', onWin, true);
    window.addEventListener('resize', onWin, true);
    const onClick = () => closeActions();
    // Use bubble phase so clicks on menu items trigger before close
    window.addEventListener('click', onClick, false);
    return () => {
      window.removeEventListener('scroll', onWin, true);
      window.removeEventListener('resize', onWin, true);
      window.removeEventListener('click', onClick, false);
    };
  }, [openActionsId, closeActions]);

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

  useEffect(() => {
    if (!autoOpenReminderId || !reminders || reminders.length === 0) return;
    const found = reminders.find(r => r.id === autoOpenReminderId);
    if (found) setViewReminder(found);
  }, [autoOpenReminderId, reminders]);

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
    if (!projectId || !id) return;
    try {
      await deleteDoc(doc(db, "projects", projectId, "reminders", id));
    } catch (error) {
      console.error("Error removing reminder: ", error);
    }
  };

  const downloadReminderIcs = (r) => {
    try {
      if (!r || !r.date) return;
      const time = (r.time && r.time.trim()) ? r.time : '09:00';
      const start = new Date(`${r.date}T${time}`);
      if (isNaN(start.getTime())) return;
      const dt = start.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const summary = (r.title || '').replace(/\n/g, ' ');
      const description = (r.description || '').replace(/\n/g, ' ');
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//ProFlow//EN',
        'BEGIN:VEVENT',
        `UID:${(r.id || Math.random()) + '@proflow'}`,
        `DTSTAMP:${dt}`,
        `DTSTART:${dt}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\n');
      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(r.title || 'reminder').replace(/[^a-z0-9]+/gi,'-')}.ics`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
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
              alignItems: "flex-start",
              gap: '8px'
            }}>
              <div onClick={() => setViewReminder(reminder)} style={{ minWidth: 0, display: 'flex', flexDirection: 'column', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={{ margin: 0, color: COLORS.text, fontSize: "14px", fontWeight: "bold", maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={reminder.title}>{reminder.title}</span>
                  {reminder.title && reminder.title.length > 30 && (
                    <span style={{ fontSize: 10, color: COLORS.lightText, border: `1px solid ${COLORS.border}`, borderRadius: 999, padding: '2px 6px' }}>more</span>
                  )}
                </div>
                {reminder.description && (
                  <div style={{ color: COLORS.lightText, fontSize: "12px", maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={reminder.description}>{reminder.description}</div>
                )}
                <small style={{ color: COLORS.lightText, fontSize: "12px" }}>{reminder.date} {reminder.time ? `at ${reminder.time}` : ''}</small>
              </div>
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'inline-block' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      const menuW = 200; const menuH = 124; const pad = 8;
                      let left = rect.right + pad; // prefer right
                      if (left + menuW > window.innerWidth - pad) left = rect.left - menuW - pad; // flip left
                      let top = rect.top - menuH - pad; // prefer above
                      if (top < pad) top = Math.min(rect.bottom + pad, window.innerHeight - menuH - pad); // fallback below
                      setActionsPos({ top, left });
                      setOpenActionsId(prev => prev === reminder.id ? null : reminder.id);
                    }}
                    style={{ background: 'none', border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '2px 6px', cursor: 'pointer', fontSize: 14, color: COLORS.text }}
                    title="Actions"
                  >
                    ⚙️
                  </button>
                  {openActionsId === reminder.id && ReactDOM.createPortal(
                    (<div style={{ position: 'fixed', top: actionsPos.top, left: actionsPos.left, background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 8, boxShadow: '0 16px 40px rgba(0,0,0,0.18)', minWidth: 180, zIndex: 4000 }} onClick={(ev) => ev.stopPropagation()}>
                      <button onClick={() => { setEditingReminder(reminder); setShowModal(true); closeActions(); }} style={{ background: 'none', border: 'none', padding: '8px 12px', width: '100%', textAlign: 'left', cursor: 'pointer', fontSize: 13 }}>Edit</button>
                      <button onClick={() => { if (reminder?.date) {
                        const time = (reminder.time && reminder.time.trim()) ? reminder.time : '09:00';
                        const start = new Date(`${reminder.date}T${time}`);
                        if (!isNaN(start.getTime())) {
                          const dt = start.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                          const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//ProFlow//EN\nBEGIN:VEVENT\nUID:${(reminder.id || Math.random()) + '@proflow'}\nDTSTAMP:${dt}\nDTSTART:${dt}\nSUMMARY:${(reminder.title || '').replace(/\n/g,' ')}\nDESCRIPTION:${(reminder.description || '').replace(/\n/g,' ')}\nEND:VEVENT\nEND:VCALENDAR`;
                          const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a'); a.href = url; a.download = `${(reminder.title || 'reminder').replace(/[^a-z0-9]+/gi,'-')}.ics`; a.click(); URL.revokeObjectURL(url);
                        }
                      } closeActions(); }} style={{ background: 'none', border: 'none', padding: '8px 12px', width: '100%', textAlign: 'left', cursor: 'pointer', fontSize: 13 }}>Add to Calendar</button>
                      <button onClick={() => { setConfirmDelete(reminder); closeActions(); }} style={{ background: 'none', border: 'none', padding: '8px 12px', width: '100%', textAlign: 'left', cursor: 'pointer', color: COLORS.danger, fontSize: 13 }}>Delete</button>
                    </div>), document.body)
                  }
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
      <AddProjectReminderModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingReminder(null); }}
        onSave={editingReminder ? (data) => handleUpdateReminder(editingReminder.id, data) : handleAddReminder}
        editingReminder={editingReminder}
      />
      {confirmDelete && ReactDOM.createPortal((
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 3600, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setConfirmDelete(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: '92%', maxWidth: 440, boxShadow: '0 20px 50px rgba(0,0,0,0.25)', padding: 18 }}>
            <h4 style={{ margin: 0, color: COLORS.dark, fontSize: 18 }}>Delete reminder?</h4>
            <div style={{ marginTop: 8, color: COLORS.text, fontSize: 14 }}>
              This will permanently remove:
              <div style={{ marginTop: 6, padding: 10, background: '#fafafa', border: `1px solid ${COLORS.border}`, borderRadius: 8 }}>
                <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{confirmDelete.title || 'Untitled'}</div>
                <div style={{ fontSize: 12, color: COLORS.lightText, marginTop: 4 }}>{confirmDelete.date || '-'} {confirmDelete.time ? `at ${confirmDelete.time}` : ''}</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ background: 'transparent', border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={async () => { const rid = confirmDelete?.id; setConfirmDelete(null); await handleRemoveReminder(rid); }} style={{ background: COLORS.danger, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      ), document.body)}
      {viewReminder && ReactDOM.createPortal((
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 3500, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setViewReminder(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '95%', maxWidth: 680, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 999, background: COLORS.light, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.text, fontWeight: 700 }}>⏰</div>
              <h3 style={{ margin: 0, color: COLORS.dark, fontSize: 22, fontWeight: 700, letterSpacing: 0.2, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{viewReminder.title}</h3>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: COLORS.lightText }}>When</span>
              <span style={{ fontSize: 12, color: COLORS.text, background: '#f3f4f6', border: `1px solid ${COLORS.border}`, padding: '4px 8px', borderRadius: 999 }}>{viewReminder.date || '-'}</span>
              {viewReminder.time && (
                <span style={{ fontSize: 12, color: COLORS.text, background: '#f3f4f6', border: `1px solid ${COLORS.border}`, padding: '4px 8px', borderRadius: 999 }}>at {viewReminder.time}</span>
              )}
            </div>
            {viewReminder.description && (
              <div style={{ marginTop: 12, padding: 14, background: '#fafafa', border: `1px solid ${COLORS.border}`, borderRadius: 10, whiteSpace: 'pre-wrap', color: COLORS.text, lineHeight: 1.7, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                {viewReminder.description}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button onClick={() => setViewReminder(null)} style={{ background: 'transparent', border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}>Close</button>
              <button onClick={() => { downloadReminderIcs(viewReminder); setViewReminder(null); }} style={{ background: '#111827', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', fontWeight: 600 }}>Add to Calendar</button>
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
}
