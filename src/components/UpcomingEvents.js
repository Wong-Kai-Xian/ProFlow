import React, { useEffect, useState } from "react";

export default function UpcomingEvents() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    // Mock events data since Firebase might not be set up yet
    const mockEvents = [
      { name: "Project Alpha Deadline", date: new Date(Date.now() + 86400000 * 3) },
      { name: "Client Meeting - Sarah", date: new Date(Date.now() + 86400000 * 5) },
      { name: "Team Standup", date: new Date(Date.now() + 86400000 * 1) },
      { name: "Code Review Session", date: new Date(Date.now() + 86400000 * 7) },
      { name: "Sprint Planning", date: new Date(Date.now() + 86400000 * 10) }
    ];
    setEvents(mockEvents);
  }, []);

  return (
    <div style={{ background: '#F8F9F9', padding: '15px', borderRadius: '10px' }}>
      <h3 style={{ marginTop: 0, color: '#2C3E50' }}>Upcoming Events</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {events.map((event, index) => (
          <li key={index} style={{ 
            background: 'white', 
            margin: '10px 0', 
            padding: '10px', 
            borderRadius: '5px',
            borderLeft: '4px solid #F39C12'
          }}>
            <strong>{event.name}</strong>
            <br />
            <small style={{ color: '#7F8C8D' }}>
              {event.date.toLocaleDateString()} at {event.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </small>
          </li>
        ))}
      </ul>
    </div>
  );
}