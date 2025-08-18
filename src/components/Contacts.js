// src/components/Contacts.js
import React, { useState } from "react";

export default function Contacts() {
  const [view, setView] = useState("clients"); // "clients" or "team"
  const [organizations, setOrganizations] = useState([
    {
      name: "Acme Corp",
      clients: [
        { name: "John Smith", email: "john@example.com", whatsapp: "+60123456789" },
        { name: "Sarah Johnson", email: "sarah@gmail.com", whatsapp: "+60198765432" },
      ],
      collapsed: false
    },
    {
      name: "Beta Ltd",
      clients: [
        { name: "Mike Chen", email: "mike@gmail.com", whatsapp: "+60111222333" },
      ],
      collapsed: true
    }
  ]);

  const [team, setTeam] = useState([
    { name: "Alice Wong", email: "alice@company.com", whatsapp: "+60112233445" },
    { name: "Bob Lee", email: "bob@company.com", whatsapp: "+60115566778" },
  ]);

  const openWhatsApp = (number) => {
    window.open(`https://wa.me/${number.replace(/\D/g,'')}`, "_blank");
  };

  const openEmail = (email) => {
    window.open(`mailto:${email}`, "_blank");
  };

  const toggleCollapse = (index) => {
    const newOrgs = [...organizations];
    newOrgs[index].collapsed = !newOrgs[index].collapsed;
    setOrganizations(newOrgs);
  };

  const addOrganization = () => {
    const name = prompt("Enter new organization name:");
    if (name) {
      setOrganizations([...organizations, { name, clients: [], collapsed: false }]);
    }
  };

  const addClient = (orgIndex) => {
    const name = prompt("Client Name:");
    const email = prompt("Client Email:");
    const whatsapp = prompt("Client WhatsApp:");
    if (name && email && whatsapp) {
      const newOrgs = [...organizations];
      newOrgs[orgIndex].clients.push({ name, email, whatsapp });
      setOrganizations(newOrgs);
    }
  };

  const addTeamMember = () => {
    const name = prompt("Team Member Name:");
    const email = prompt("Email:");
    const whatsapp = prompt("WhatsApp:");
    if (name && email && whatsapp) {
      setTeam([...team, { name, email, whatsapp }]);
    }
  };

  return (
    <div style={{
      background: "#F8F9F9",
      padding: "15px",
      borderRadius: "10px",
      display: "flex",
      flexDirection: "column",
      height: "100%",
      overflowY: "auto"
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <h3 style={{ margin: 0, color: "#2C3E50" }}>Contacts</h3>
        <div>
          {view === "clients" ? (
            <button onClick={addOrganization} style={btnStyle}>+ Organization</button>
          ) : (
            <button onClick={addTeamMember} style={btnStyle}>+ Team Contact</button>
          )}
        </div>
      </div>

      {/* View Switch */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
        <button 
          onClick={() => setView("clients")}
          style={{ ...switchBtnStyle, background: view === "clients" ? "#3498DB" : "#E0E0E0", color: view === "clients" ? "#fff" : "#000", flex: 1 }}
        >
          Clients
        </button>
        <button 
          onClick={() => setView("team")}
          style={{ ...switchBtnStyle, background: view === "team" ? "#3498DB" : "#E0E0E0", color: view === "team" ? "#fff" : "#000", flex: 1 }}
        >
          Team
        </button>
      </div>

      {/* List */}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {view === "clients" ? (
          organizations.map((org, idx) => (
            <li key={idx} style={{ marginBottom: "10px" }}>
              {/* Organization Header */}
              <div 
                style={{
                  background: "#BDC3C7",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  fontWeight: "bold"
                }}
                onClick={() => toggleCollapse(idx)}
              >
                <span>{org.name} {org.collapsed ? "+" : "-"}</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); addClient(idx); }} 
                  style={btnStyleSmall}
                >
                  + Profile
                </button>
              </div>
              
              {/* Clients */}
              {!org.collapsed && org.clients.map((c, i) => (
                <div key={i} style={{
                  background: "#ffffff",
                  padding: "10px",
                  margin: "5px 0",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                }}>
                  <div>
                    <strong>{c.name}</strong><br/>
                    <span style={{ fontSize: "12px", color: "#555" }}>{c.email}</span>
                  </div>
                  <div style={{ display: "flex", gap: "5px" }}>
                    <button onClick={() => openWhatsApp(c.whatsapp)} style={btnWhatsApp}>WhatsApp</button>
                    <button onClick={() => openEmail(c.email)} style={btnEmail}>Email</button>
                  </div>
                </div>
              ))}
            </li>
          ))
        ) : (
          team.map((t, i) => (
            <li key={i} style={{
              background: "#ffffff",
              padding: "10px",
              marginBottom: "10px",
              borderRadius: "8px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
            }}>
              <div>
                <strong>{t.name}</strong><br/>
                <span style={{ fontSize: "12px", color: "#555" }}>{t.email}</span>
              </div>
              <div style={{ display: "flex", gap: "5px" }}>
                <button onClick={() => openWhatsApp(t.whatsapp)} style={btnWhatsApp}>WhatsApp</button>
                <button onClick={() => openEmail(t.email)} style={btnEmail}>Email</button>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

// Styles
const btnStyle = {
  marginLeft: "5px",
  padding: "5px 10px",
  background: "#3498DB",
  color: "#fff",
  border: "none",
  borderRadius: "5px",
  cursor: "pointer",
  fontSize: "12px"
};

const btnStyleSmall = {
  padding: "2px 6px",
  background: "#27AE60",
  color: "#fff",
  border: "none",
  borderRadius: "5px",
  cursor: "pointer",
  fontSize: "10px"
};

const btnWhatsApp = {
  padding: "5px 8px",
  background: "#25D366",
  color: "white",
  border: "none",
  borderRadius: "5px",
  cursor: "pointer",
  fontSize: "12px"
};

const btnEmail = {
  padding: "5px 8px",
  background: "#E74C3C",
  color: "white",
  border: "none",
  borderRadius: "5px",
  cursor: "pointer",
  fontSize: "12px"
};

const switchBtnStyle = {
  marginRight: "5px",
  padding: "5px 10px",
  border: "none",
  borderRadius: "5px",
  cursor: "pointer",
};
