import React, { useEffect, useState } from "react";
import Card from "./profile-component/Card"; // Corrected import path
import { COLORS, LAYOUT } from "./profile-component/constants"; // Import constants

export default function UpcomingEvents() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    // Mock events data since Firebase might not be set up yet
    const mockEvents = [
      { name: "Project Alpha Deadline", date: new Date(Date.now() + 86400000 * 3) }, // 3 days from now
      { name: "Client Meeting - Sarah", date: new Date(Date.now() + 86400000 * 5) }, // 5 days from now
      { name: "Team Standup", date: new Date(Date.now() + 86400000 * 1) }, // 1 day from now
      { name: "Code Review Session", date: new Date(Date.now() + 86400000 * 7) }, // 7 days from now
      { name: "Sprint Planning", date: new Date(Date.now() + 86400000 * 10) }, // 10 days from now
      { name: "Overdue Task Review", date: new Date(Date.now() - 86400000 * 2) }, // 2 days ago (overdue)
    ];

    // Sort events by date, closest deadline first
    const sortedEvents = mockEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
    setEvents(sortedEvents);
  }, []);

  const getDaysLeft = (eventDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today to start of day
    const eventDay = new Date(eventDate);
    eventDay.setHours(0, 0, 0, 0); // Normalize event date to start of day

    const diffTime = eventDay.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return <span style={{ fontWeight: 'bold', color: COLORS.danger }}>OVERDUE</span>;
    } else if (diffDays === 0) {
      return "Today!";
    } else if (diffDays === 1) {
      return "1 day left";
    } else {
      return `${diffDays} days left`;
    }
  };

  const getEventColor = (eventDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDay = new Date(eventDate);
    eventDay.setHours(0, 0, 0, 0);

    const diffTime = eventDay.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return COLORS.danger; // Overdue
    } else if (diffDays <= 3) {
      return COLORS.warning; // Within 3 days
    } else if (diffDays <= 7) {
      return COLORS.primary; // Within 7 days
    } else {
      return COLORS.secondary; // More than 7 days
    }
  };

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
            borderLeft: `4px solid ${getEventColor(event.date)}` // Dynamic border color
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: LAYOUT.smallGap }}>
              <strong style={{ color: COLORS.text }}>{event.name}</strong>
              <small style={{ color: COLORS.lightText, fontSize: "12px", flexShrink: 0 }}>
                {getDaysLeft(event.date)}
              </small>
            </div>
            <small style={{ color: COLORS.lightText }}>
              {event.date.toLocaleDateString()} at {event.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </small>
          </li>
        ))}
      </ul>
    </Card>
  );
}