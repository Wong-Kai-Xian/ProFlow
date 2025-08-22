import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import Card from "./profile-component/Card"; // Corrected import path
import { COLORS, LAYOUT } from "./profile-component/constants"; // Import constants
import { db } from "../firebase"; // Import db
import { collection, onSnapshot, query, orderBy, where } from "firebase/firestore"; // Import Firestore functions
import { FaFolder, FaUser, FaComments } from 'react-icons/fa'; // Import icons for origin
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

export default function UpcomingEvents() {
  const [events, setEvents] = useState([]);
  const navigate = useNavigate(); // Initialize useNavigate
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
          if (reminderSnapshot.empty) {
            console.log(`Project ${projectId} has no reminders in its subcollection.`);
          }
          reminderSnapshot.docs.forEach(reminderDoc => {
            const reminderData = reminderDoc.data();
            console.log(`Found project reminder:`, reminderData);
            console.log(`Project reminder date: ${reminderData.date}, time: ${reminderData.time}`);
            if (reminderData.date && reminderData.time) {
              if (!fetchedReminders.some(e => e.id === `${projectId}-${reminderData.title}-${reminderData.date}-${reminderData.time}`)) {
                fetchedReminders.push({
                  id: `${projectId}-${reminderData.title}-${reminderData.date}-${reminderData.time}`,
                  name: reminderData.title,
                  date: new Date(`${reminderData.date}T${reminderData.time}`),
                  origin: "project",
                  sourceId: projectId,
                  sourceName: projectName,
                });
              }
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
          customerData.reminders.forEach(reminder => {
            console.log(`Found customer reminder:`, reminder);
            console.log(`Customer reminder date: ${reminder.date}, time: ${reminder.time}`);
            if (reminder.date && reminder.time) {
              if (!fetchedReminders.some(e => e.id === `${customerId}-${reminder.title}-${reminder.date}-${reminder.time}`)) {
                fetchedReminders.push({
                  id: `${customerId}-${reminder.title}-${reminder.date}-${reminder.time}`,
                  name: reminder.title,
                  date: new Date(`${reminder.date}T${reminder.time}`),
                  origin: "customer",
                  sourceId: customerId,
                  sourceName: customerData.customerProfile?.name, // To display which customer it's from
                });
              }
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
          if (reminderSnapshot.empty) {
            console.log(`Forum ${forumId} has no reminders in its subcollection.`);
          }
          reminderSnapshot.docs.forEach(reminderDoc => {
            const reminderData = reminderDoc.data();
            console.log(`Found forum reminder:`, reminderData);
            console.log(`Forum reminder date: ${reminderData.date}, time: ${reminderData.time}`);
            if (reminderData.date && reminderData.time) {
              if (!fetchedReminders.some(e => e.id === `${forumId}-${reminderData.title}-${reminderData.date}-${reminderData.time}`)) {
                fetchedReminders.push({
                  id: `${forumId}-${reminderData.title}-${reminderData.date}-${reminderData.time}`,
                  name: reminderData.title,
                  date: new Date(`${reminderData.date}T${reminderData.time}`),
                  origin: "forum",
                  sourceId: forumId,
                  sourceName: forumName,
                });
              }
            } else {
              console.warn(`Forum reminder missing date or time for forum ${forumId}:`, reminderData);
            }
          });
          updateEvents();
        }));
      });
    }));

    const updateEvents = () => {
      console.log("Updating events with fetchedReminders:", fetchedReminders);
      // Sort events by date, closest deadline first
      const sortedEvents = [...fetchedReminders].sort((a, b) => a.date.getTime() - b.date.getTime());
      setEvents(sortedEvents);
    };

    return () => unsubscribes.forEach(unsub => unsub());
  }, [currentUser]); // Add currentUser to dependency array

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

  const handleEventClick = (event) => {
    switch (event.origin) {
      case "project":
        navigate(`/project/${event.sourceId}`);
        break;
      case "customer":
        navigate(`/customer/${event.sourceId}`);
        break;
      case "forum":
        navigate(`/forum/${event.sourceId}`);
        break;
      default:
        break;
    }
  };

  return (
    <Card style={{
      height: "350px",
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
    }}>
      <h3 style={{ marginTop: 0, color: COLORS.text, fontSize: "18px" }}>Upcoming Events</h3>
      <ul style={{ listStyle: 'none', padding: 0, overflowY: "auto", flexGrow: 1 }}>
        {events.length === 0 ? (
          <li style={{ padding: LAYOUT.smallGap, color: COLORS.lightText, textAlign: "center" }}>No upcoming events.</li>
        ) : (
          events.map((event, index) => (
            <li 
              key={event.id || index} // Use a stable key
              onClick={() => handleEventClick(event)} // Make event clickable
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: LAYOUT.smallGap, marginBottom: '4px' }}>
                <strong style={{ color: COLORS.text }}>{event.name}</strong>
                <small style={{ color: COLORS.lightText, fontSize: "12px", flexShrink: 0 }}>
                  {getDaysLeft(event.date)}
                </small>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: "12px", color: COLORS.lightText }}>
                {getOriginIcon(event.origin)} {/* Display origin icon */}
                <span>
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
    </Card>
  );
}