import React, { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase";

export default function UpcomingEvents() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    async function fetchEvents() {
      const q = query(collection(db, "events"), orderBy("date"), limit(5));
      const querySnapshot = await getDocs(q);
      setEvents(querySnapshot.docs.map(doc => doc.data()));
    }
    fetchEvents();
  }, []);

  return (
    <div style={{ background: '#F8F9F9', padding: '15px', borderRadius: '10px' }}>
      <h3>Upcoming Events</h3>
      <ul>
        {events.map((event, index) => (
          <li key={index}>{event.name} - {new Date(event.date.seconds * 1000).toLocaleDateString()}</li>
        ))}
      </ul>
    </div>
  );
}
