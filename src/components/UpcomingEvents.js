import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "./profile-component/Card"; // Corrected import path
import { COLORS, LAYOUT } from "./profile-component/constants"; // Import constants
import { db } from "../firebase"; // Import db
import { collection, onSnapshot, query, orderBy, where, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore"; // Import Firestore functions
import { FaFolder, FaUser, FaComments, FaCalendarAlt } from 'react-icons/fa'; // Import icons for origin and calendar
import { useAuth } from '../contexts/AuthContext'; // Import useAuth
import { DESIGN_SYSTEM } from '../styles/designSystem';

export default function UpcomingEvents({ embedded = false, externalCalendarOpen = false, onRequestCloseCalendar }) {
  const [events, setEvents] = useState([]);
  const navigate = useNavigate();
  const { currentUser } = useAuth(); // Get currentUser from AuthContext
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0,0,0,0);
    return d;
  });
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    if (!currentUser) {
      setEvents([]); // Clear events if no user is logged in
      return;
    }

    const fetchedReminders = [];
    const unsubscribes = [];

    console.log("Setting up Firestore listeners for reminders...");

    // 1. Fetch Project Reminders and Tasks (assigned to me)
    const listenedProjects = new Set();
    const remindersUnsubMap = {};
    const projectQueries = [
      query(collection(db, "projects"), where("userId", "==", currentUser.uid)),
      query(collection(db, "projects"), where("ownerId", "==", currentUser.uid)),
    ];
    if (currentUser.email) {
      try { projectQueries.push(query(collection(db, "projects"), where("team", "array-contains", currentUser.email))); } catch {}
    }
    const handleProjectSnapshot = (projectSnapshot) => {
      console.log("Projects snapshot received.");
      projectSnapshot.docs.forEach(projectDoc => {
        const projectId = projectDoc.id;
        const projectData = projectDoc.data();
        const projectName = projectData.name; // Get project name
        console.log(`Processing project ${projectId}:`, projectData);

        // Process project tasks assigned to current user (if any)
        try {
          // Remove existing task events for this project before re-adding
          for (let i = fetchedReminders.length - 1; i >= 0; i--) {
            if (fetchedReminders[i].origin === 'project' && fetchedReminders[i].sourceId === projectId && fetchedReminders[i].taskId) {
              fetchedReminders.splice(i, 1);
            }
          }
          const sections = Array.isArray(projectData?.tasks) ? projectData.tasks : [];
          sections.forEach((section, secIdx) => {
            const tasks = Array.isArray(section?.tasks) ? section.tasks : [];
            tasks.forEach((t, taskIdx) => {
              const assignedRaw = (t.assignedTo || t.assignee || '').toString().toLowerCase();
              const meName = (currentUser.displayName || '').toLowerCase();
              const meEmail = (currentUser.email || '').toLowerCase();
              if (!assignedRaw) return;
              const isMine = assignedRaw === meName || assignedRaw === meEmail;
              if (!isMine) return;
              if (!t.deadline) return;
              const timeVal = '09:00';
              const idSafe = t.id || `${secIdx}-${taskIdx}`;
              fetchedReminders.push({
                id: `task:${projectId}:${idSafe}`,
                name: t.title || t.name || 'Task',
                date: new Date(`${t.deadline}T${timeVal}`),
                origin: 'project', // keep origin as project for existing UI badges
                sourceId: projectId,
                sourceName: projectName,
                description: (t.description || ''),
                taskId: idSafe,
                category: 'task'
              });
            });
          });
          updateEvents();
        } catch (e) { console.warn('Failed processing tasks for project', projectId, e); }

        if (!listenedProjects.has(projectId)) {
          listenedProjects.add(projectId);
          const projectRemindersQuery = query(collection(db, "projects", projectId, "reminders"));
          const unsubRem = onSnapshot(projectRemindersQuery, (reminderSnapshot) => {
            console.log(`Project ${projectId} reminders snapshot received.`);
            // Remove existing reminder events for this project before re-adding (do not remove task events)
            for (let i = fetchedReminders.length - 1; i >= 0; i--) {
              if (fetchedReminders[i].origin === 'project' && fetchedReminders[i].sourceId === projectId && fetchedReminders[i].reminderId) {
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
          });
          unsubscribes.push(unsubRem);
          remindersUnsubMap[projectId] = unsubRem;
        }
      });
    };
    projectQueries.forEach((pq) => unsubscribes.push(onSnapshot(pq, handleProjectSnapshot)));

    // 2. Fetch Customer Profile Reminders (owned or shared via access)
    const customerProfilesOwned = query(collection(db, "customerProfiles"), where("userId", "==", currentUser.uid)); // Legacy userId
    const customerProfilesShared = query(collection(db, "customerProfiles"), where("access", "array-contains", currentUser.uid)); // Access-based
    const handleCustomerSnapshot = (snapshot) => {
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
    };
    unsubscribes.push(onSnapshot(customerProfilesOwned, handleCustomerSnapshot));
    unsubscribes.push(onSnapshot(customerProfilesShared, handleCustomerSnapshot));

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
        // Avoid duplicating notifications for tasks (handled by FollowUpAgent)
        if (ev.taskId) continue;
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
        return <FaFolder size={12} color={DESIGN_SYSTEM.colors.accent.green} />;
      case "customer":
        return <FaUser size={12} color={DESIGN_SYSTEM.colors.accent.orange} />;
      case "forum":
        return <FaComments size={12} color={DESIGN_SYSTEM.colors.accent.purple} />;
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

  const openCalendar = () => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0,0,0,0);
    setCalendarMonth(d);
    setSelectedDate(null);
    setShowCalendar(true);
  };
  const isCalendarOpen = !!(externalCalendarOpen || showCalendar);

  // Keep month in sync when opened externally
  useEffect(() => {
    if (externalCalendarOpen) {
      const d = new Date();
      d.setDate(1);
      d.setHours(0,0,0,0);
      setCalendarMonth(d);
      setSelectedDate(null);
    }
  }, [externalCalendarOpen]);
  const closeCalendar = () => { if (onRequestCloseCalendar) try { onRequestCloseCalendar(); } catch {} ; setShowCalendar(false); };

  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
  const firstDayIdx = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();
  const daysArray = Array.from({ length: firstDayIdx + daysInMonth }, (_, i) => i < firstDayIdx ? null : new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), i - firstDayIdx + 1));
  const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const eventsOn = (d) => events.filter(ev => isSameDay(new Date(ev.date), d));

  const CalendarModal = isCalendarOpen && (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 72, zIndex: 2000 }} onClick={closeCalendar}>
      <div style={{ width: 800, maxWidth: '92vw', maxHeight: '88vh', background: '#fff', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: 12, background: COLORS.cardBackground, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => { setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)); setSelectedDate(null); }} style={{ cursor: 'pointer' }}>{'<'}</button>
            <strong style={{ color: COLORS.text }}>{calendarMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</strong>
            <button onClick={() => { setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)); setSelectedDate(null); }} style={{ cursor: 'pointer' }}>{'>'}</button>
          </div>
          <button onClick={closeCalendar} style={{ cursor: 'pointer' }}>Close</button>
        </div>
        <div style={{ padding: 12, display: 'grid', gridTemplateRows: 'auto 1fr', gap: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', fontSize: 12, color: COLORS.lightText, textAlign: 'center' }}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} style={{ padding: 6 }}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, overflow: 'auto' }}>
            {daysArray.map((d, idx) => (
              <div key={idx} onClick={() => d && setSelectedDate(d)} style={{ border: '1px solid #eee', borderRadius: 8, minHeight: 84, padding: 6, background: d ? '#fff' : 'transparent', cursor: d ? 'pointer' : 'default', minWidth: 0, overflow: 'hidden' }}>
                {d && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: COLORS.lightText }}>{d.getDate()}</span>
                    {isSameDay(d, new Date()) && <span style={{ fontSize: 10, color: COLORS.primary }}>Today</span>}
                  </div>
                )}
                {d && (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {eventsOn(d).slice(0, 3).map(ev => (
                      <div key={ev.id} title={`${ev.name} • ${ev.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`} style={{ fontSize: 11, color: COLORS.text, background: COLORS.cardBackground, borderLeft: `3px solid ${getEventColor(ev.date)}`, padding: '2px 4px', borderRadius: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {getOriginIcon(ev.origin)}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 10, color: ev.origin === 'project' ? DESIGN_SYSTEM.colors.accent.green : ev.origin === 'forum' ? DESIGN_SYSTEM.colors.accent.purple : ev.origin === 'customer' ? DESIGN_SYSTEM.colors.accent.orange : COLORS.lightText }}>
                          {ev.origin === 'project' ? 'Project' : ev.origin === 'forum' ? 'Forum' : ev.origin === 'customer' ? 'Client' : ''}
                        </span>
                      </div>
                    ))}
                    {eventsOn(d).length > 3 && <div style={{ fontSize: 10, color: COLORS.lightText }}>+{eventsOn(d).length - 3} more</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8 }}>
            {selectedDate ? (
              <>
                <strong style={{ color: COLORS.text, fontSize: 14 }}>Events on {selectedDate.toLocaleDateString()}</strong>
                <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0 0', maxHeight: 200, overflow: 'auto' }}>
                  {eventsOn(selectedDate).sort((a,b) => a.date.getTime() - b.date.getTime()).map(ev => (
                    <li
                      key={ev.id}
                      onClick={() => {
                        if (ev.origin === 'project' && ev.reminderId) {
                          navigate(`/project/${ev.sourceId}?reminderId=${encodeURIComponent(ev.reminderId)}`);
                        } else if (ev.origin === 'project' && ev.taskId) {
                          navigate(`/project/${ev.sourceId}?taskId=${encodeURIComponent(ev.taskId)}`);
                        } else if (ev.origin === 'forum' && ev.reminderId) {
                          navigate(`/forum/${ev.sourceId}?reminderId=${encodeURIComponent(ev.reminderId)}`);
                        } else if (ev.origin === 'customer') {
                          navigate(`/customer/${ev.sourceId}`);
                        }
                        closeCalendar();
                      }}
                      style={{ padding: '6px 4px', borderBottom: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: getEventColor(ev.date), display: 'inline-block' }} />
                        <strong style={{ fontSize: 12, color: COLORS.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name}</strong>
                        <span style={{ fontSize: 11, color: COLORS.lightText }}>{ev.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 16, fontSize: 11, overflow: 'hidden' }}>
                        {getOriginIcon(ev.origin)}
                        <span
                          title={ev.sourceName}
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: ev.origin === 'project' ? DESIGN_SYSTEM.colors.accent.green : ev.origin === 'forum' ? DESIGN_SYSTEM.colors.accent.purple : ev.origin === 'customer' ? DESIGN_SYSTEM.colors.accent.orange : COLORS.lightText
                          }}
                        >
                          {ev.origin === 'project' ? `Project: ${ev.sourceName}` : ev.origin === 'customer' ? `Client: ${ev.sourceName}` : ev.origin === 'forum' ? `Forum: ${ev.sourceName}` : ''}
                        </span>
                      </div>
                    </li>
                  ))}
                  {eventsOn(selectedDate).length === 0 && (
                    <li style={{ padding: '6px 4px', color: COLORS.lightText }}>No events for this day.</li>
                  )}
                </ul>
              </>
            ) : (
              <div style={{ fontSize: 12, color: COLORS.lightText }}>Select a day to view its events.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const List = (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, overflowY: "auto", flexGrow: 1, minHeight: 0, position: 'relative' }}>
        <div style={{ position: 'sticky', top: 0, padding: 6, display: 'flex', justifyContent: 'flex-end', background: 'linear-gradient(to bottom, rgba(255,255,255,0.96), rgba(255,255,255,0.6))', zIndex: 1 }}>
          <button onClick={openCalendar} title="Open calendar" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, border: `1px solid ${COLORS.secondary}`, background: '#fff', cursor: 'pointer', fontSize: 12, color: COLORS.text }}>
            <FaCalendarAlt size={12} /> Calendar
          </button>
        </div>
        {events.length === 0 ? (
          <li style={{ padding: LAYOUT.smallGap, color: COLORS.lightText, textAlign: "center" }}>No upcoming events.</li>
        ) : (
          events.map((event, index) => (
            <li 
              key={event.id || index} // Use a stable key
              onClick={() => {
                if (event.origin === 'project' && event.reminderId) {
                  navigate(`/project/${event.sourceId}?reminderId=${encodeURIComponent(event.reminderId)}`);
                } else if (event.origin === 'project' && event.taskId) {
                  navigate(`/project/${event.sourceId}?taskId=${encodeURIComponent(event.taskId)}`);
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
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
        {List}
        {CalendarModal}
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <h3 style={{ marginTop: 0, color: COLORS.text, fontSize: "18px" }}>Upcoming Events</h3>
        <button onClick={openCalendar} title="Open calendar" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, border: `1px solid ${COLORS.secondary}`, background: '#fff', cursor: 'pointer', fontSize: 12, color: COLORS.text }}>
          <FaCalendarAlt size={12} /> Calendar
        </button>
      </div>
      {List}
      {CalendarModal}
    </Card>
  );
}