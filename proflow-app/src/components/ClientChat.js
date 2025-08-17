import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export default function ClientChat() {
  const [clients, setClients] = useState([]);

  useEffect(() => {
    async function fetchClients() {
      const querySnapshot = await getDocs(collection(db, "clients"));
      setClients(querySnapshot.docs.map(doc => doc.data()));
    }
    fetchClients();
  }, []);

  return (
    <div style={{ background: '#F8F9F9', padding: '15px', borderRadius: '10px' }}>
      <h3>Client Chat</h3>
      <ul>
        {clients.map((client, index) => (
          <li key={index}>
            {client.project} - {client.name}
            <button onClick={() => window.open(`https://t.me/${client.telegram}`, "_blank")}>Telegram</button>
            <button onClick={() => window.location.href=`mailto:${client.email}`}>Email</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
