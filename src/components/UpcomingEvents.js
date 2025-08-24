import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "./profile-component/Card"; // Corrected import path
import { COLORS, LAYOUT } from "./profile-component/constants"; // Import constants
import { db } from "../firebase"; // Import db
import { collection, onSnapshot, query, orderBy, where, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore"; // Import Firestore functions
import { FaFolder, FaUser, FaComments } from 'react-icons/fa'; // Import icons for origin
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

export default function UpcomingEvents({ embedded = false }) {
  const [events, setEvents] = useState([]);
  const navigate = useNavigate();
  const { currentUser } = useAuth(); // Get currentUser from AuthContext

  useEffect(() => {
    if (!currentUser) {
      setEvents([]); // Clear events if no user is logged in
      return;
    }

    const fetchedReminders = [];
    const unsubscribes = [];

    console.log("Setting up Firestore listeners for reminders...");

    // 1. Fetch Project Reminders
    const projectsQuery = query(collection(db, "projects"), where("userId", "==", currentUser.uid)); // Filter by userId
    unsubscribes.push(onSnapshot(projectsQuery, (projectSnapshot) => {
      console.log("Projects snapshot received.");
      projectSnapshot.docs.forEach(projectDoc => {
        const projectId = projectDoc.id;
        const projectName = projectDoc.data().name; // Get project name
        console.log(`Processing project ${projectId}:`, projectDoc.data());

        const projectRemindersQuery = query(collection(db, "projects", projectId, "reminders"));
        unsubscribes.push(onSnapshot(projectRemindersQuery, (reminderSnapshot) => {
          console.log(`Project ${projectId} reminders snapshot received.`);
          // Remove existing events for this project before re-adding
          for (let i = fetchedReminders.length - 1; i >= 0; i--) {
            if (fetchedReminders[i].origin === 'project' && fetchedReminders[i].sourceId === projectId) {
              fetchedReminders.splice(i, 1);
            }
          }
          if (reminderSnapshot.empty) {
            console.log(`Project ${projectId} has no reminders in its subcollection.`);
          }
          reminderSnapshot.docs.forEach(reminderDoc => {
            const reminderData = reminderDoc.data();
            console.log(`Found project reminder:`, reminderData);
            console.log(`Project reminder date: ${reminderData.date}, time: ${reminderData.time}`);
            if (reminderData.date) {
              const timeVal = reminderData.time && reminderData.time.trim() ? reminderData.time : '09:00';
              fetchedReminders.push({
                id: `${projectId}-${reminderDoc.id}`,
                name: reminderData.title,
                date: new Date(`${reminderData.date}T${timeVal}`),
                origin: "project",
                sourceId: projectId,
                sourceName: projectName,
                description: reminderData.description || '',
                reminderId: reminderDoc.id
              });
            } else {
              console.warn(`Project reminder missing date or time for project ${projectId}:`, reminderData);
            }
          });
          updateEvents();
        }));
      });
    }));

    // 2. Fetch Customer Profile Reminders
    const customerProfilesQuery = query(collection(db, "customerProfiles"), where("userId", "==", currentUser.uid)); // Filter by userId
    unsubscribes.push(onSnapshot(customerProfilesQuery, (snapshot) => {
      console.log("Customer Profiles snapshot received.");
      snapshot.docs.forEach(customerDoc => {
        const customerData = customerDoc.data();
        const customerId = customerDoc.id;
        console.log(`Processing customer profile ${customerId}:`, customerData);
        if (customerData.reminders && Array.isArray(customerData.reminders)) {
          console.log(`Customer ${customerId} has reminders:`, customerData.reminders);
          // Remove existing items for this customer before re-adding
          for (let i = fetchedReminders.length - 1; i >= 0; i--) {
            if (fetchedReminders[i].origin === 'customer' && fetchedReminders[i].sourceId === customerId) {
              fetchedReminders.splice(i, 1);
            }
          }
          customerData.reminders.forEach((reminder, idx) => {
            console.log(`Found customer reminder:`, reminder);
            console.log(`Customer reminder date: ${reminder.date}, time: ${reminder.time}`);
            if (reminder.date) {
              const timeVal = reminder.time && reminder.time.trim() ? reminder.time : '09:00';
              fetchedReminders.push({
                id: `${customerId}-idx-${idx}-${reminder.date}-${timeVal}`,
                name: reminder.title,
                date: new Date(`${reminder.date}T${timeVal}`),
                origin: "customer",
                sourceId: customerId,
                sourceName: customerData.customerProfile?.name,
                description: reminder.description || ''
              });
            } else {
              console.warn(`Customer reminder missing date or time for customer ${customerId}:`, reminder);
            }
          });
        } else {
          console.log(`Customer ${customerId} has no reminders or reminders is not an array.`);
        }
      });
      updateEvents();
    }));

    // 3. Fetch Forum Reminders (from subcollections)
    const forumsQuery = query(collection(db, "forums"), where("members", "array-contains", currentUser.uid)); // Filter by members array
    unsubscribes.push(onSnapshot(forumsQuery, (forumSnapshot) => {
      console.log("Forums snapshot received.");
      forumSnapshot.docs.forEach(forumDoc => {
        const forumId = forumDoc.id;
        const forumName = forumDoc.data().name;
        const forumRemindersQuery = query(collection(db, "forums", forumId, "reminders"));
        // Using a nested onSnapshot for subcollection reminders
        unsubscribes.push(onSnapshot(forumRemindersQuery, (reminderSnapshot) => {
          console.log(`Forum ${forumId} reminders snapshot received.`);
          // Remove existing items for this forum before re-adding
          for (let i = fetchedReminders.length - 1; i >= 0; i--) {
            if (fetchedReminders[i].origin === 'forum' && fetchedReminders[i].sourceId === forumId) {
              fetchedReminders.splice(i, 1);
            }
          }
          if (reminderSnapshot.empty) {
            console.log(`Forum ${forumId} has no reminders in its subcollection.`);
          }
          reminderSnapshot.docs.forEach(reminderDoc => {
            const reminderData = reminderDoc.data();
            console.log(`Found forum reminder:`, reminderData);
            console.log(`Forum reminder date: ${reminderData.date}, time: ${reminderData.time}`);
            if (reminderData.date) {
              const timeVal = reminderData.time && reminderData.time.trim() ? reminderData.time : '09:00';
              fetchedReminders.push({
                id: `${forumId}-${reminderDoc.id}`,
                name: reminderData.title,
                date: new Date(`${reminderData.date}T${timeVal}`),
                origin: "forum",
                sourceId: forumId,
                sourceName: forumName,
                description: reminderData.description || '',
                reminderId: reminderDoc.id
              });
            } else {
              console.warn(`Forum reminder missing date or time for forum ${forumId}:`, reminderData);
            }
          });
          updateEvents();
        }));
      });
    }));

    const updateEvents = async () => {
      console.log("Updating events with fetchedReminders:", fetchedReminders);
      // Sort events by date, closest deadline first
      const sortedEvents = [...fetchedReminders].sort((a, b) => a.date.getTime() - b.date.getTime());
      setEvents(sortedEvents);
      try {
        await maybeNotifyDueSoon(sortedEvents);
      } catch (e) { /* noop */ }
    };

    return () => unsubscribes.forEach(unsub => unsub());
  }, [currentUser]); // Add currentUser to dependency array

  // Notify for items due within user-configured window and overdue (lightweight automation)
  const maybeNotifyDueSoon = async (sorted) => {
    try {
      if (!currentUser) return;
      const now = Date.now();
      // Load per-user rule
      let dueSoonMs = 24 * 60 * 60 * 1000;
      try {
        const ref = doc(db, 'users', currentUser.uid, 'settings', 'notifications');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data();
          if (typeof d.dueSoonHours === 'number') {
            dueSoonMs = Math.max(1, Math.min(168, d.dueSoonHours)) * 60 * 60 * 1000;
          }
          var enableOverdue = d.enableOverdueAlerts !== false;
        } else {
          var enableOverdue = true;
        }
      } catch {
        var enableOverdue = true;
      }
      const seenKey = `proflow_notified_${currentUser.uid}`;
      const seenRaw = localStorage.getItem(seenKey);
      const seen = seenRaw ? JSON.parse(seenRaw) : {};
      let changed = false;
      for (const ev of sorted) {
        const dt = ev.date?.getTime?.();
        if (!dt) continue;
        const timeTo = dt - now;
        // Due soon within configured window
        if (timeTo <= dueSoonMs && timeTo >= 0) {
          const key = `${ev.origin}:${ev.sourceId}:${ev.id}`;
          if (!seen[key]) {
            // Write notification
            try {
              await addDoc(collection(db, 'users', currentUser.uid, 'notifications'), {
                unread: true,
                createdAt: serverTimestamp(),
                origin: ev.origin,
                title: 'Upcoming event',
                message: `${ev.name} • ${ev.date.toLocaleString()}`,
                refType: 'upcomingEvent',
                sourceId: ev.sourceId,
                eventId: ev.id
              });
              seen[key] = Date.now();
              changed = true;
            } catch {}
          }
        }
        // Overdue
        if (enableOverdue && timeTo < 0) {
          const keyOver = `overdue:${ev.origin}:${ev.sourceId}:${ev.id}`;
          if (!seen[keyOver]) {
            try {
              await addDoc(collection(db, 'users', currentUser.uid, 'notifications'), {
                unread: true,
                createdAt: serverTimestamp(),
                origin: ev.origin,
                title: 'Overdue',
                message: `${ev.name} • was due ${ev.date.toLocaleString()}`,
                refType: 'upcomingEvent',
                sourceId: ev.sourceId,
                eventId: ev.id
              });
              seen[keyOver] = Date.now();
              changed = true;
            } catch {}
          }
        }
      }
      if (changed) localStorage.setItem(seenKey, JSON.stringify(seen));
    } catch {}
  };

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

  const getOriginIcon = (origin) => {
    switch (origin) {
      case "project":
        return <FaFolder size={12} color={COLORS.primary} />;
      case "customer":
        return <FaUser size={12} color={COLORS.success} />;
      case "forum":
        return <FaComments size={12} color={COLORS.warning} />;
      default:
        return null;
    }
  };

  const downloadEventIcs = (ev) => {
    try {
      if (!ev || !ev.date) return;
      const dt = ev.date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const summary = (ev.name || '').replace(/\n/g, ' ');
      const description = (ev.description || '').replace(/\n/g, ' ');
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//ProFlow//EN',
        'BEGIN:VEVENT',
        `UID:${(ev.id || Math.random()) + '@proflow'}`,
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
      a.download = `${(ev.name || 'reminder').replace(/[^a-z0-9]+/gi,'-')}.ics`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const List = (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, overflowY: "auto", flexGrow: 1, minHeight: 0 }}>
        {events.length === 0 ? (
          <li style={{ padding: LAYOUT.smallGap, color: COLORS.lightText, textAlign: "center" }}>No upcoming events.</li>
        ) : (
          events.map((event, index) => (
            <li 
              key={event.id || index} // Use a stable key
              onClick={() => {
                if (event.origin === 'project' && event.reminderId) {
                  navigate(`/project/${event.sourceId}?reminderId=${encodeURIComponent(event.reminderId)}`);
                } else if (event.origin === 'forum' && event.reminderId) {
                  navigate(`/forum/${event.sourceId}?reminderId=${encodeURIComponent(event.reminderId)}`);
                } else if (event.origin === 'customer') {
                  navigate(`/customer/${event.sourceId}`);
                }
              }}
              style={{
                background: COLORS.cardBackground,
                margin: LAYOUT.smallGap + " 0",
                padding: LAYOUT.smallGap,
                borderRadius: LAYOUT.smallBorderRadius,
                borderLeft: `4px solid ${getEventColor(event.date)}`,
                cursor: "pointer", // Indicate clickable
                transition: "all 0.2s ease-in-out",
                "&:hover": { // Add hover effect
                  backgroundColor: COLORS.light,
                  transform: "translateX(2px)",
                }
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: LAYOUT.smallGap, marginBottom: '4px', minWidth: 0 }}>
                <strong title={event.name} style={{ color: COLORS.text, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{event.name}</strong>
                <small style={{ color: COLORS.lightText, fontSize: "12px", flexShrink: 0 }}>
                  {getDaysLeft(event.date)}
                </small>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: "12px", color: COLORS.lightText, minWidth: 0 }}>
                {getOriginIcon(event.origin)} {/* Display origin icon */}
                <span title={event.sourceName} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {event.origin === "project" ? `Project: ${event.sourceName}` :
                   event.origin === "customer" ? `Client: ${event.sourceName}` :
                   event.origin === "forum" ? `Forum: ${event.sourceName}` : ''}
                </span>
                <span style={{ marginLeft: 'auto' }}>
                  {event.date.toLocaleDateString()} at {event.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
            </li>
          ))
        )}
      </ul>
  );

  if (embedded) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {List}
      </div>
    );
  }

  return (
    <Card style={{
      height: "350px",
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
      position: 'relative',
      zIndex: 0
    }}>
      <h3 style={{ marginTop: 0, color: COLORS.text, fontSize: "18px" }}>Upcoming Events</h3>
      {List}
    </Card>
  );
}