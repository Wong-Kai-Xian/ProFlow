import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { COLORS } from '../profile-component/constants';
import { db } from '../../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import AddReminderModal from './AddReminderModal'; // Import the new modal

export default function ForumReminders({ forumId, autoOpenReminderId }) {
  console.log("ForumReminders: Initial forumId prop:", forumId);
  const [isExpanded, setIsExpanded] = useState(true);
  const [reminders, setReminders] = useState([]);
  const [showReminderModal, setShowReminderModal] = useState(false); // State for modal visibility
  const [editingReminder, setEditingReminder] = useState(null); // State to hold reminder being edited
  const [openMenuId, setOpenMenuId] = useState(null); // track which action menu is open
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [viewReminder, setViewReminder] = useState(null); // details modal
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    if (!forumId) return;

    const remindersRef = collection(db, `forums/${forumId}/reminders`);
    const q = query(remindersRef, orderBy('timestamp', 'asc')); // Order by timestamp ascending

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const remindersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || null
      }));
      setReminders(remindersData);
    });

    return () => unsubscribe();
  }, [forumId]);

  useEffect(() => {
    if (!autoOpenReminderId || !reminders || reminders.length === 0) return;
    const found = reminders.find(r => r.id === autoOpenReminderId);
    if (found) setViewReminder(found);
  }, [autoOpenReminderId, reminders]);

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close, true);
    const onClick = () => setOpenMenuId(null);
    // Use bubble phase so clicks on menu buttons fire first
    window.addEventListener('click', onClick, false);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close, true);
      window.removeEventListener('click', onClick, false);
    };
  }, [openMenuId]);

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#E74C3C';
      case 'medium': return '#F39C12';
      case 'low': return '#27AE60';
      default: return '#7F8C8D';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'meeting': return '📅';
      case 'deadline': return '⏰';
      case 'event': return '🎯';
      default: return '📋';
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const diffTime = date - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `In ${diffDays} days`;
    return date.toLocaleDateString();
  };

  const handleAddReminder = async (newReminder) => {
    console.log("ForumReminders: handleAddReminder called with newReminder:", newReminder, "for forumId:", forumId);
    if (!forumId) {
      console.error("ForumReminders: forumId is missing, cannot add reminder.");
      return;
    }
    try {
      await addDoc(collection(db, `forums/${forumId}/reminders`), {
        ...newReminder,
        timestamp: serverTimestamp(),
      });
      console.log("Forum reminder successfully added to Firestore.");
    } catch (error) {
      console.error("Error adding reminder: ", error);
    }
  };

  const handleUpdateReminder = async (id, updatedReminder) => {
    if (!forumId || !id) return;
    try {
      const reminderRef = doc(db, `forums/${forumId}/reminders`, id);
      await updateDoc(reminderRef, updatedReminder);
    } catch (error) {
      console.error("Error updating reminder: ", error);
    }
  };

  const handleDeleteReminder = async (id) => {
    if (!forumId || !id) return;
    try {
      await deleteDoc(doc(db, `forums/${forumId}/reminders`, id));
    } catch (error) {
      console.error("Error deleting reminder: ", error);
    }
  };

  return (
    <div style={{
      padding: '16px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
        cursor: 'pointer'
      }} onClick={() => setIsExpanded(!isExpanded)}>
        <h3 style={{ 
          margin: 0, 
          color: COLORS.dark, 
          fontSize: '18px',
          fontWeight: '700'
        }}>
          Reminders
        </h3>
        <span style={{ 
          color: COLORS.lightText, 
          fontSize: '14px',
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.3s ease'
        }}>
          ▼
        </span>
      </div>

      {/* Add New Reminder Button (always visible) */}
      <button
        onClick={() => { setEditingReminder(null); setShowReminderModal(true); }}
        style={{
          backgroundColor: COLORS.primary,
          color: COLORS.white,
          border: 'none',
          borderRadius: '8px',
          padding: '10px 15px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          marginBottom: '15px',
          width: '100%'
        }}
      >
        + Add New Reminder
      </button>

      {isExpanded && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          {reminders.length === 0 ? (
            <p style={{ 
              fontSize: '15px', 
              color: COLORS.lightText, 
              textAlign: 'center',
              fontStyle: 'italic',
              margin: '10px 0'
            }}>
              No upcoming reminders
            </p>
          ) : (
            reminders.map((reminder) => (
              <div key={reminder.id} style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px',
                borderRadius: '6px',
                backgroundColor: '#F8F9FA',
                marginBottom: '6px',
                border: `1px solid ${getPriorityColor(reminder.priority)}20`,
                borderLeft: `3px solid ${getPriorityColor(reminder.priority)}`
              }}>
                <span style={{ 
                  fontSize: '16px', 
                  marginRight: '10px' 
                }}>
                  {getTypeIcon(reminder.type)}
                </span>
                <div onClick={() => setViewReminder(reminder)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: COLORS.dark, marginBottom: '3px', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={reminder.title}>{reminder.title}</span>
                    {reminder.title && reminder.title.length > 30 && (
                      <span style={{ fontSize: 10, color: COLORS.lightText, border: `1px solid ${COLORS.border}`, borderRadius: 999, padding: '2px 6px', cursor: 'default' }}>more</span>
                    )}
                  </div>
                  {reminder.description && (
                    <div style={{ color: COLORS.lightText, fontSize: '12px', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={reminder.description}>{reminder.description}</div>
                  )}
                  <div style={{ 
                    fontSize: '13px', 
                    color: COLORS.lightText 
                  }}>
                    {formatDate(reminder.date)} {reminder.time && reminder.time.trim() ? `at ${reminder.time}` : ''}
                  </div>
                </div>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: getPriorityColor(reminder.priority)
                }} />
                {/* Reminder actions */}
                <div style={{ position: 'relative', marginLeft: '10px' }}>
                  <button onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const menuW = 200; const menuH = 124; const pad = 8;
                    let left = rect.left - menuW - pad; // prefer left
                    if (left < pad) left = Math.min(rect.right + pad, window.innerWidth - menuW - pad); // fallback right
                    let top = rect.top - menuH - pad; // prefer above
                    if (top < pad) top = Math.min(rect.bottom + pad, window.innerHeight - menuH - pad); // fallback below
                    setMenuPos({ top, left });
                    setOpenMenuId(prev => prev === reminder.id ? null : reminder.id);
                  }} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '2px 6px', cursor: 'pointer', fontSize: 14 }} title="Actions">
                    ⚙️
                  </button>
                  {openMenuId === reminder.id && ReactDOM.createPortal(
                    (
                      <div style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 16px 40px rgba(0,0,0,0.18)', minWidth: 180, zIndex: 4000 }} onClick={(ev) => ev.stopPropagation()}>
                        <button onClick={() => {
                          if (!reminder?.date) { setOpenMenuId(null); return; }
                          const time = (reminder.time && reminder.time.trim()) ? reminder.time : '09:00';
                          const start = new Date(`${reminder.date}T${time}`);
                          if (isNaN(start.getTime())) { setOpenMenuId(null); return; }
                          const dt = start.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                          const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//ProFlow//EN\nBEGIN:VEVENT\nUID:${(reminder.id || Math.random()) + '@proflow'}\nDTSTAMP:${dt}\nDTSTART:${dt}\nSUMMARY:${(reminder.title || '').replace(/\n/g,' ')}\nDESCRIPTION:${(reminder.note || '').replace(/\n/g,' ')}\nEND:VEVENT\nEND:VCALENDAR`;
                          const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${(reminder.title || 'reminder').replace(/[^a-z0-9]+/gi,'-')}.ics`;
                          a.click();
                          URL.revokeObjectURL(url);
                          setOpenMenuId(null);
                        }} style={{ background: 'none', border: 'none', padding: '8px 12px', width: '100%', textAlign: 'left', cursor: 'pointer', fontSize: 13 }}>Add to Calendar</button>
                        <button onClick={() => { setEditingReminder(reminder); setShowReminderModal(true); setOpenMenuId(null); }} style={{ background: 'none', border: 'none', padding: '8px 12px', width: '100%', textAlign: 'left', cursor: 'pointer', fontSize: 13 }}>Edit</button>
                        <button onClick={() => { setConfirmDelete(reminder); setOpenMenuId(null); }} style={{ background: 'none', border: 'none', padding: '8px 12px', width: '100%', textAlign: 'left', cursor: 'pointer', color: '#E74C3C', fontSize: 13 }}>Delete</button>
                      </div>
                    ), document.body)
                  }
                </div>
              </div>
            ))
          )}
        </div>
      )}
      <AddReminderModal
        isOpen={showReminderModal}
        onClose={() => setShowReminderModal(false)}
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
              <button onClick={async () => { const rid = confirmDelete?.id; setConfirmDelete(null); await handleDeleteReminder(rid); }} style={{ background: '#E74C3C', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      ), document.body)}
      {viewReminder && ReactDOM.createPortal((
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 3500, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setViewReminder(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '95%', maxWidth: 680, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 999, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{getTypeIcon(viewReminder.type)}</div>
              <h3 style={{ margin: 0, fontSize: 22, color: COLORS.dark, fontWeight: 700, letterSpacing: 0.2, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{viewReminder.title}</h3>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: COLORS.lightText }}>When</span>
              <span style={{ fontSize: 12, color: COLORS.text, background: '#f3f4f6', border: `1px solid ${COLORS.border}`, padding: '4px 8px', borderRadius: 999 }}>{viewReminder.date || '-'}</span>
              {viewReminder.time && (
                <span style={{ fontSize: 12, color: COLORS.text, background: '#f3f4f6', border: `1px solid ${COLORS.border}`, padding: '4px 8px', borderRadius: 999 }}>at {viewReminder.time}</span>
              )}
              <span style={{ fontSize: 12, color: COLORS.lightText, marginLeft: 8 }}>Priority</span>
              <span style={{ fontSize: 12, color: '#fff', background: getPriorityColor(viewReminder.priority), padding: '4px 10px', borderRadius: 999 }}>{viewReminder.priority || 'medium'}</span>
            </div>
            {viewReminder.description && (
              <div style={{ marginTop: 12, padding: 14, background: '#fafafa', border: `1px solid ${COLORS.border}`, borderRadius: 10, whiteSpace: 'pre-wrap', color: COLORS.text, lineHeight: 1.7, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                {viewReminder.description}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button onClick={() => setViewReminder(null)} style={{ background: 'transparent', border: `1px solid #e5e7eb`, borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}>Close</button>
              <button onClick={() => {
                const r = viewReminder; if (!r?.date) { setViewReminder(null); return; }
                const t = (r.time && r.time.trim()) ? r.time : '09:00';
                const start = new Date(`${r.date}T${t}`);
                if (isNaN(start.getTime())) { setViewReminder(null); return; }
                const dt = start.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//ProFlow//EN\nBEGIN:VEVENT\nUID:${(r.id || Math.random()) + '@proflow'}\nDTSTAMP:${dt}\nDTSTART:${dt}\nSUMMARY:${(r.title || '').replace(/\n/g,' ')}\nDESCRIPTION:${(r.description || '').replace(/\n/g,' ')}\nEND:VEVENT\nEND:VCALENDAR`;
                const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `${(r.title || 'reminder').replace(/[^a-z0-9]+/gi,'-')}.ics`; a.click(); URL.revokeObjectURL(url);
                setViewReminder(null);
              }} style={{ background: '#111827', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', fontWeight: 600 }}>Add to Calendar</button>
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
}
