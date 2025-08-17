import React, { useEffect, useState } from "react";

export default function ClientChat() {
  const [clients, setClients] = useState([]);

  useEffect(() => {
    // Mock client data since Firebase might not be set up yet
    setClients([
      { 
        name: "John Smith", 
        project: "Website Redesign", 
        telegram: "johnsmith", 
        email: "john@example.com",
        status: "online"
      },
      { 
        name: "Sarah Johnson", 
        project: "Mobile App", 
        telegram: "sarahj", 
        email: "sarah@example.com",
        status: "offline"
      },
      { 
        name: "Mike Chen", 
        project: "E-commerce Platform", 
        telegram: "mikechen", 
        email: "mike@example.com",
        status: "online"
      }
    ]);
  }, []);

  return (
    <div style={{ background: '#F8F9F9', padding: '15px', borderRadius: '10px' }}>
      <h3 style={{ marginTop: 0, color: '#2C3E50' }}>Client Chat</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {clients.map((client, index) => (
          <li key={index} style={{ 
            background: 'white', 
            margin: '10px 0', 
            padding: '10px', 
            borderRadius: '5px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <strong>{client.name}</strong>
              <br />
              <small style={{ color: '#7F8C8D' }}>{client.project}</small>
              <br />
              <span style={{ 
                color: client.status === 'online' ? '#27AE60' : '#E74C3C',
                fontSize: '12px'
              }}>
                ● {client.status}
              </span>
            </div>
            <div>
              <button 
                onClick={() => window.open(`https://t.me/${client.telegram}`, "_blank")}
                style={{ 
                  margin: '2px', 
                  padding: '5px 10px', 
                  background: '#3498DB', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Telegram
              </button>
              <button 
                onClick={() => window.location.href=`mailto:${client.email}`}
                style={{ 
                  margin: '2px', 
                  padding: '5px 10px', 
                  background: '#E74C3C', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Email
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}