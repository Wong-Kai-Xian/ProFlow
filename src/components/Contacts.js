// src/components/Contacts.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import AddOrganization from "./AddOrganization";
import DelOrganization from "./DelOrganization";
import Card from "./profile-component/Card"; // Corrected import path
import { COLORS, LAYOUT, BUTTON_STYLES } from "./profile-component/constants"; // Import constants

export default function Contacts() {
  const navigate = useNavigate();
  const [view, setView] = useState("clients");
  const [showAddOrg, setShowAddOrg] = useState(false);
  const [showDelOrg, setShowDelOrg] = useState(false);

  const [organizations, setOrganizations] = useState([
    {
      name: "Acme Corp",
      clients: [
        { id: "johnsmith", name: "John Smith", email: "john@example.com", whatsapp: "+60123456789" },
        { id: "sarahjohnson", name: "Sarah Johnson", email: "sarah@gmail.com", whatsapp: "+60198765432" },
      ],
      collapsed: false,
    },
    {
      name: "Beta Ltd",
      clients: [
        { id: "mikechen", name: "Mike Chen", email: "mike@gmail.com", whatsapp: "+60111222333" }
      ],
      collapsed: true,
    },
  ]);

  const [team, setTeam] = useState([
    { name: "Alice Wong", email: "alice@company.com", whatsapp: "+60112233445" },
    { name: "Bob Lee", email: "bob@company.com", whatsapp: "+60115566778" },
  ]);

  const openWhatsApp = (number) => window.open(`https://wa.me/${number.replace(/\D/g, "")}`, "_blank");
  const openEmail = (email) => window.open(`mailto:${email}`, "_blank");

  const toggleCollapse = (index) => {
    const newOrgs = [...organizations];
    newOrgs[index].collapsed = !newOrgs[index].collapsed;
    setOrganizations(newOrgs);
  };

  const handleAddOrganization = (name) => {
    if (name) setOrganizations([...organizations, { name, clients: [], collapsed: false }]);
  };

  const handleDeleteOrganization = (orgName) => {
    setOrganizations(organizations.filter(o => o.name !== orgName));
  };

  const addClient = (orgIndex) => {
    const name = prompt("Client Name:");
    const email = prompt("Client Email:");
    const whatsapp = prompt("Client WhatsApp:");
    if (name && email && whatsapp) {
      const newOrgs = [...organizations];
      const id = name.toLowerCase().replace(/\s+/g, "");
      newOrgs[orgIndex].clients.push({ id, name, email, whatsapp });
      setOrganizations(newOrgs);
    }
  };

  const removeClient = (orgIndex) => {
    const org = organizations[orgIndex];
    const profileNames = org.clients.map(c => c.name);
    const toDelete = prompt(`Select profile to delete:\n${profileNames.join("\n")}`);
    if (toDelete) {
      const clientIndex = org.clients.findIndex(c => c.name === toDelete);
      if (clientIndex > -1) {
        const newOrgs = [...organizations];
        newOrgs[orgIndex].clients.splice(clientIndex, 1);
        setOrganizations(newOrgs);
      }
    }
  };

  const addTeamMember = () => {
    const name = prompt("Team Member Name:");
    const email = prompt("Email:");
    const whatsapp = prompt("WhatsApp:");
    if (name && email && whatsapp) setTeam([...team, { name, email, whatsapp }]);
  };

  const goToCustomerProfile = (id) => {
    navigate(`/customer/${id}`);
  };

  return (
    <Card style={{
      height: "100%",
      overflowY: "auto"
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: LAYOUT.smallGap }}>
        <h3 style={{ margin: 0, color: COLORS.text }}>Contacts</h3>
        <div style={{ display: "flex", gap: LAYOUT.smallGap }}>
          {view === "clients" && (
            <>
              <button onClick={() => setShowAddOrg(true)} style={{ ...BUTTON_STYLES.primary, padding: "4px 8px", fontSize: "10px" }}>+ Org</button>
              <button onClick={() => setShowDelOrg(true)} style={{ ...BUTTON_STYLES.primary, background: COLORS.danger, padding: "4px 8px", fontSize: "10px" }}>- Org</button>
            </>
          )}
          {view === "team" && (
            <button onClick={addTeamMember} style={{ ...BUTTON_STYLES.primary, padding: "4px 8px", fontSize: "10px" }}>+ Team Contact</button>
          )}
        </div>
      </div>

      {/* View Switch */}
      <div style={{ display: "flex", gap: LAYOUT.smallGap, marginBottom: LAYOUT.smallGap }}>
        <button
          onClick={() => setView("clients")}
          style={{ 
            ...(view === "clients" ? BUTTON_STYLES.primary : BUTTON_STYLES.secondary),
            flex: 1
          }}
        >
          Clients
        </button>
        <button
          onClick={() => setView("team")}
          style={{
            ...(view === "team" ? BUTTON_STYLES.primary : BUTTON_STYLES.secondary),
            flex: 1
          }}
        >
          Team
        </button>
      </div>

      {/* List */}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {view === "clients"
          ? organizations.map((org, idx) => (
              <li key={idx} style={{ marginBottom: LAYOUT.smallGap }}>
                <div style={{
                  background: COLORS.light,
                  padding: LAYOUT.smallGap,
                  borderRadius: LAYOUT.smallBorderRadius,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontWeight: "bold",
                  color: COLORS.text
                }}>
                  <span onClick={() => toggleCollapse(idx)} style={{ cursor: "pointer" }}>
                    {org.name} {org.collapsed ? "+" : "-"}
                  </span>
                  <div style={{ display: "flex", gap: LAYOUT.smallGap }}>
                    <button onClick={() => addClient(idx)} style={{ ...BUTTON_STYLES.primary, padding: "2px 5px", fontSize: "9px" }}>+</button>
                    <button onClick={() => removeClient(idx)} style={{ ...BUTTON_STYLES.primary, background: COLORS.danger, padding: "2px 5px", fontSize: "9px" }}>-</button>
                  </div>
                </div>
                {!org.collapsed && org.clients.map((c, i) => (
                  <div
                    key={i}
                    onClick={() => goToCustomerProfile(c.id)}
                    style={{
                      background: COLORS.cardBackground,
                      padding: LAYOUT.smallGap,
                      margin: LAYOUT.smallGap + " 0",
                      borderRadius: LAYOUT.smallBorderRadius,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                      cursor: "pointer"
                    }}
                  >
                    <div>
                      <strong style={{ color: COLORS.text }}>{c.name}</strong><br/>
                      <span style={{ fontSize: "12px", color: COLORS.lightText }}>{c.email}</span>
                    </div>
                    <div style={{ display: "flex", gap: LAYOUT.smallGap }}>
                      <button onClick={(e) => { e.stopPropagation(); openWhatsApp(c.whatsapp); }} style={{ ...BUTTON_STYLES.primary, background: COLORS.success, padding: "4px 8px", fontSize: "10px" }}>WhatsApp</button>
                      <button onClick={(e) => { e.stopPropagation(); openEmail(c.email); }} style={{ ...BUTTON_STYLES.primary, background: COLORS.secondary, padding: "4px 8px", fontSize: "10px" }}>Email</button>
                    </div>
                  </div>
                ))}
              </li>
            ))
          : team.map((t, i) => (
              <li key={i} style={{
                background: COLORS.cardBackground,
                padding: LAYOUT.smallGap,
                marginBottom: LAYOUT.smallGap,
                borderRadius: LAYOUT.smallBorderRadius,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
              }}>
                <div>
                  <strong style={{ color: COLORS.text }}>{t.name}</strong><br/>
                  <span style={{ fontSize: "12px", color: COLORS.lightText }}>{t.email}</span>
                </div>
                <div style={{ display: "flex", gap: LAYOUT.smallGap }}>
                  <button onClick={() => openWhatsApp(t.whatsapp)} style={{ ...BUTTON_STYLES.primary, background: COLORS.success, padding: "4px 8px", fontSize: "10px" }}>WhatsApp</button>
                  <button onClick={() => openEmail(t.email)} style={{ ...BUTTON_STYLES.primary, background: COLORS.secondary, padding: "4px 8px", fontSize: "10px" }}>Email</button>
                </div>
              </li>
            ))}
      </ul>

      {/* Modals */}
      {showAddOrg && <AddOrganization onClose={() => setShowAddOrg(false)} onSave={handleAddOrganization} />}
      {showDelOrg && <DelOrganization organizations={organizations} onDelete={handleDeleteOrganization} onClose={() => setShowDelOrg(false)} />}
    </Card>
  );
}
