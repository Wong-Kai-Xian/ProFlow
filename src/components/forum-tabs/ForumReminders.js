import React, { useState } from 'react';

export default function ForumReminders() {
  const [isExpanded, setIsExpanded] = useState(true);

  // Mock reminders data
  const reminders = [
    {
      id: 1,
      title: "Team Standup Meeting",
      date: "2025-01-21",
      time: "10:00 AM",
      type: "meeting",
      priority: "high"
    },
    {
      id: 2,
      title: "Project Milestone Review",
      date: "2025-01-23",
      time: "2:00 PM",
      type: "deadline",
      priority: "medium"
    },
    {
      id: 3,
      title: "Client Presentation",
      date: "2025-01-25",
      time: "3:30 PM",
      type: "meeting",
      priority: "high"
    }
  ];

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
          color: '#2C3E50', 
          fontSize: '16px',
          fontWeight: '600'
        }}>
          Reminders
        </h3>
        <span style={{ 
          color: '#7F8C8D', 
          fontSize: '12px',
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.3s ease'
        }}>
          ▼
        </span>
      </div>

      {isExpanded && (
        <div>
          {reminders.length === 0 ? (
            <p style={{ 
              fontSize: '12px', 
              color: '#7F8C8D', 
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
                  fontSize: '14px', 
                  marginRight: '8px' 
                }}>
                  {getTypeIcon(reminder.type)}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: '#2C3E50',
                    marginBottom: '2px'
                  }}>
                    {reminder.title}
                  </div>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#7F8C8D' 
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
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
