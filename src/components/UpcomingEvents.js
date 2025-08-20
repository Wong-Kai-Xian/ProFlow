import React, { useEffect, useState } from "react";
import Card from "./profile-component/Card"; // Corrected import path
import { COLORS, LAYOUT } from "./profile-component/constants"; // Import constants

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
    <Card>
      <h3 style={{ marginTop: 0, color: COLORS.text }}>Upcoming Events</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {events.map((event, index) => (
          <li key={index} style={{ 
            background: COLORS.cardBackground, 
            margin: LAYOUT.smallGap + " 0", 
            padding: LAYOUT.smallGap, 
            borderRadius: LAYOUT.smallBorderRadius,
            borderLeft: `4px solid ${COLORS.warning}`
          }}>
            <strong>{event.name}</strong>
            <br />
            <small style={{ color: COLORS.lightText }}>
              {event.date.toLocaleDateString()} at {event.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </small>
          </li>
        ))}
      </ul>
    </Card>
  );
}