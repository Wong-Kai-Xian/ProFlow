import React, { useState, useEffect } from 'react';
import { COLORS } from '../profile-component/constants';
import { db } from '../../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import AddReminderModal from './AddReminderModal'; // Import the new modal

export default function ForumReminders({ forumId }) {
  console.log("ForumReminders: Initial forumId prop:", forumId);
  const [isExpanded, setIsExpanded] = useState(true);
  const [reminders, setReminders] = useState([]);
  const [showReminderModal, setShowReminderModal] = useState(false); // State for modal visibility
  const [editingReminder, setEditingReminder] = useState(null); // State to hold reminder being edited

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
    if (!window.confirm("Are you sure you want to delete this reminder?")) return;
    try {
      await deleteDoc(doc(db, `forums/${forumId}/reminders`, id));
    } catch (error) {
      console.error("Error deleting reminder: ", error);
    }
  };

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '10px',
      padding: '15px',
      marginBottom: '15px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      border: '1px solid #ECF0F1'
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
        <div>
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
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontSize: '15px', 
                    fontWeight: '600', 
                    color: COLORS.dark,
                    marginBottom: '3px'
                  }}>
                    {reminder.title}
                  </div>
                  <div style={{ 
                    fontSize: '13px', 
                    color: COLORS.lightText 
                  }}>
                    {formatDate(reminder.date)} at {reminder.time}
                  </div>
                </div>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: getPriorityColor(reminder.priority)
                }} />
                {/* Reminder actions */}
                <div style={{ display: 'flex', gap: '5px', marginLeft: '10px' }}>
                  <button
                    onClick={() => { setEditingReminder(reminder); setShowReminderModal(true); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: COLORS.primary
                    }}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteReminder(reminder.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: COLORS.danger
                    }}
                  >
                    🗑️
                  </button>
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
    </div>
  );
}
