// src/components/Contacts.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaWhatsapp } from 'react-icons/fa';
import { MdEmail } from 'react-icons/md'; // Changed from SiGmail to MdEmail
import { FaTrash } from 'react-icons/fa'; // Import FaTrash icon
import { FaChevronDown, FaChevronUp } from 'react-icons/fa'; // Import chevron icons
import AddOrganization from "./AddOrganization";
import DelOrganization from "./DelOrganization";
import Card from "./profile-component/Card"; // Corrected import path
import { COLORS, LAYOUT, BUTTON_STYLES } from "./profile-component/constants"; // Import constants
import AddProfileModal from "./profile-component/AddProfileModal"; // Import the new AddProfileModal
import DeleteProfileModal from "./profile-component/DeleteProfileModal"; // Import the new DeleteProfileModal
import customerDataArray from "./profile-component/customerData.js"; // Import customerDataArray

export default function Contacts() {
  const navigate = useNavigate();
  const [view, setView] = useState("clients");
  const [showAddOrg, setShowAddOrg] = useState(false);
  const [showDelOrg, setShowDelOrg] = useState(false);
  const [showAddClientModal, setShowAddClientModal] = useState(false); // New state for add client modal
  const [currentOrgIndex, setCurrentOrgIndex] = useState(null); // To keep track of which org to add client to
  const [showDeleteClientModal, setShowDeleteClientModal] = useState(false); // New state for delete client modal
  const [clientToDelete, setClientToDelete] = useState(null); // To store client to delete
  const [showAddTeamMemberModal, setShowAddTeamMemberModal] = useState(false); // New state for add team member modal
  const [teamMemberToDelete, setTeamMemberToDelete] = useState(null); // To store team member to delete

  const [organizations, setOrganizations] = useState(
    // Map over customerDataArray to create organizations structure
    customerDataArray.reduce((acc, customer) => {
      const companyName = customer.companyProfile.company;
      let organization = acc.find(org => org.name === companyName);

      if (!organization) {
        organization = { name: companyName, clients: [], collapsed: false };
        acc.push(organization);
      }

      organization.clients.push({
        id: customer.id, // Use the numeric ID from customerData
        name: customer.customerProfile.name,
        email: customer.customerProfile.email,
        whatsapp: customer.customerProfile.phone // Assuming phone can be used as whatsapp
      });

      return acc;
    }, [])
  );

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

  const handleAddClient = (client) => {
    const newOrgs = [...organizations];
    const id = client.name.toLowerCase().replace(/\s+/g, "");
    newOrgs[currentOrgIndex].clients.push({ id, ...client });
    setOrganizations(newOrgs);
    setShowAddClientModal(false);
    setCurrentOrgIndex(null);
  };

  const handleRemoveClient = (orgIndex, clientIndex) => {
    const newOrgs = [...organizations];
    newOrgs[orgIndex].clients.splice(clientIndex, 1);
    setOrganizations(newOrgs);
    setShowDeleteClientModal(false);
    setClientToDelete(null);
  };

  const handleAddTeamMember = (member) => {
    setTeam([...team, member]);
    setShowAddTeamMemberModal(false);
  };

  const handleDeleteTeamMember = (indexToRemove) => {
    setTeam(team.filter((_, index) => index !== indexToRemove));
    setShowDeleteClientModal(false); // Reuse delete modal for team members
    setTeamMemberToDelete(null);
  };

  const addClient = (orgIndex) => {
    setCurrentOrgIndex(orgIndex);
    setShowAddClientModal(true);
  };

  const removeClient = (orgIndex, clientName) => {
    // Find the client object to pass its name to the modal
    const org = organizations[orgIndex];
    const client = org.clients.find(c => c.name === clientName);
    if (client) {
      setCurrentOrgIndex(orgIndex);
      setClientToDelete(client);
      setShowDeleteClientModal(true);
    }
  };

  const addTeamMember = () => {
    setShowAddTeamMemberModal(true);
  };

  const removeTeamMember = (teamMemberName) => {
    const member = team.find(t => t.name === teamMemberName);
    if (member) {
      setTeamMemberToDelete(member);
      setShowDeleteClientModal(true); // Reuse delete modal for team members
    }
  };

  const goToCustomerProfile = (id) => {
    navigate(`/customer/${id}`);
  };

  return (
    <Card style={{
      height: "100%",
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: LAYOUT.smallGap }}>
        <h3 style={{ margin: "0 auto 0 0", color: COLORS.text, fontSize: "18px" }}>Contacts</h3> {/* Adjusted margin for spacing */}
        <div style={{ display: "flex", gap: LAYOUT.smallGap }}>
          {view === "clients" && (
            <>
              <button onClick={() => setShowAddOrg(true)} style={{ ...BUTTON_STYLES.primary, padding: "4px 8px", fontSize: "10px" }}>+ Org</button>
              <button onClick={() => setShowDelOrg(true)} style={{ ...BUTTON_STYLES.primary, background: COLORS.danger, padding: "4px 8px", fontSize: "10px" }}>- Org</button>
            </>
          )}
          {view === "team" && (
            <button onClick={addTeamMember} style={{ ...BUTTON_STYLES.primary, padding: "6px 12px", fontSize: "14px" }}>+ Team Contact</button>
          )}
        </div>
      </div>

      {/* View Switch */}
      <div style={{ display: "flex", gap: LAYOUT.smallGap, marginBottom: LAYOUT.smallGap, border: `1px solid ${COLORS.lightBorder}`, borderRadius: LAYOUT.borderRadius }}>
        <button
          onClick={() => setView("clients")}
          style={{ 
            ...BUTTON_STYLES.flat,
            ...(view === "clients" ? { background: COLORS.primary, color: COLORS.buttonText, boxShadow: "0 2px 4px rgba(0,0,0,0.1)" } : { background: "transparent", color: COLORS.text }),
            flex: 1,
            padding: "8px 12px",
            borderRadius: LAYOUT.borderRadius,
            border: "none",
            transition: "all 0.2s ease-in-out",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "14px"
          }}
        >
          Clients
        </button>
        <button
          onClick={() => setView("team")}
          style={{
            ...BUTTON_STYLES.flat,
            ...(view === "team" ? { background: COLORS.primary, color: COLORS.buttonText, boxShadow: "0 2px 4px rgba(0,0,0,0.1)" } : { background: "transparent", color: COLORS.text }),
            flex: 1,
            padding: "8px 12px",
            borderRadius: LAYOUT.borderRadius,
            border: "none",
            transition: "all 0.2s ease-in-out",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "14px"
          }}
        >
          Team
        </button>
      </div>

      {/* List */}
      <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: "400px", overflowY: "auto", flexGrow: 1 }}> {/* Added maxHeight and overflowY, applied class */}
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
                  <span onClick={() => toggleCollapse(idx)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                    {org.name}
                  </span>
                  <div style={{ display: "flex", gap: LAYOUT.smallGap }}>
                    <button onClick={() => addClient(idx)} style={{ ...BUTTON_STYLES.primary, padding: "4px 8px", fontSize: "10px", borderRadius: "3px" }}>+</button>
                    <button onClick={() => toggleCollapse(idx)} style={{ ...BUTTON_STYLES.secondary, padding: "4px 8px", fontSize: "10px", borderRadius: "3px", background: org.collapsed ? COLORS.primary : COLORS.danger, color: "white" }}>
                      {org.collapsed ? "+" : "-"}
                    </button>
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
                      flexDirection: "column", // Changed to column to allow content to stack vertically
                      alignItems: "flex-start", // Align content to the start
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                      cursor: "pointer",
                      width: "100%", // Ensure it takes full available width
                      boxSizing: "border-box", // Include padding in the width calculation
                    }}
                  >
                    <div style={{ marginBottom: "8px", width: "100%" }}> {/* Added margin-bottom and full width */}
                      <strong style={{ color: COLORS.text, wordBreak: "break-word" }}>{c.name}</strong><br/> {/* Added word-break */}
                      <span style={{ fontSize: "12px", color: COLORS.lightText, wordBreak: "break-word" }}>{c.email}</span> {/* Added word-break */}
                    </div>
                    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-start", width: "100%", marginTop: "8px" }}> {/* Changed to flex-start, increased gap, added margin-top */}
                      <button onClick={(e) => { e.stopPropagation(); openWhatsApp(c.whatsapp); }} style={{ ...BUTTON_STYLES.primary, background: COLORS.success, padding: "6px 12px", fontSize: "16px", display: "flex", justifyContent: "center", alignItems: "center" }}><FaWhatsapp /></button> {/* Increased size */}
                      <button onClick={(e) => { e.stopPropagation(); openEmail(c.email); }} style={{ ...BUTTON_STYLES.primary, background: COLORS.secondary, padding: "6px 12px", fontSize: "16px", display: "flex", justifyContent: "center", alignItems: "center" }}><MdEmail /></button> {/* Increased size */}
                      <button onClick={(e) => { e.stopPropagation(); removeClient(idx, c.name); }} style={{ ...BUTTON_STYLES.primary, background: COLORS.danger, padding: "6px 12px", fontSize: "16px", borderRadius: "3px", display: "flex", justifyContent: "center", alignItems: "center" }}><FaTrash /></button> {/* Increased size */}
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
                flexDirection: "column", // Changed to column
                alignItems: "flex-start", // Align to start
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
              }}>
                <div style={{ marginBottom: "8px", width: "100%" }}>
                  <strong style={{ color: COLORS.text, wordBreak: "break-word" }}>{t.name}</strong><br/>
                  <span style={{ fontSize: "12px", color: COLORS.lightText, wordBreak: "break-word" }}>{t.email}</span>
                </div>
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-start", width: "100%", marginTop: "8px" }}>
                  <button onClick={(e) => { e.stopPropagation(); openWhatsApp(t.whatsapp); }} style={{ ...BUTTON_STYLES.primary, background: COLORS.success, padding: "6px 12px", fontSize: "16px", display: "flex", justifyContent: "center", alignItems: "center" }}><FaWhatsapp /></button>
                  <button onClick={(e) => { e.stopPropagation(); openEmail(t.email); }} style={{ ...BUTTON_STYLES.primary, background: COLORS.secondary, padding: "6px 12px", fontSize: "16px", display: "flex", justifyContent: "center", alignItems: "center" }}><MdEmail /></button>
                  <button onClick={(e) => { e.stopPropagation(); removeTeamMember(t.name); }} style={{ ...BUTTON_STYLES.primary, background: COLORS.danger, padding: "6px 12px", fontSize: "16px", borderRadius: "3px", display: "flex", justifyContent: "center", alignItems: "center" }}><FaTrash /></button>
                </div>
              </li>
            ))}
      </ul>

      {/* Modals */}
      {showAddOrg && <AddOrganization onClose={() => setShowAddOrg(false)} onSave={handleAddOrganization} />}
      {showDelOrg && <DelOrganization organizations={organizations} onDelete={handleDeleteOrganization} onClose={() => setShowDelOrg(false)} />}
      {showAddClientModal && (
        <AddProfileModal
          isOpen={showAddClientModal}
          onClose={() => setShowAddClientModal(false)}
          onAddContact={handleAddClient}
        />
      )}
      {showAddTeamMemberModal && (
        <AddProfileModal
          isOpen={showAddTeamMemberModal}
          onClose={() => setShowAddTeamMemberModal(false)}
          onAddContact={handleAddTeamMember}
        />
      )}
      {showDeleteClientModal && (clientToDelete || teamMemberToDelete) && (
        <DeleteProfileModal
          isOpen={showDeleteClientModal}
          onClose={() => {
            setShowDeleteClientModal(false);
            setClientToDelete(null);
            setTeamMemberToDelete(null);
          }}
          onDeleteConfirm={() => {
            if (clientToDelete) { 
              const orgIndex = organizations.findIndex(org => 
                org.clients.some(client => client.id === clientToDelete.id)
              );
              if (orgIndex !== -1) {
                const clientIndex = organizations[orgIndex].clients.findIndex(client => 
                  client.id === clientToDelete.id
                );
                if (clientIndex !== -1) {
                  handleRemoveClient(orgIndex, clientIndex);
                }
              }
            } else if (teamMemberToDelete) {
              const memberIndex = team.findIndex(member => member.name === teamMemberToDelete.name);
              if (memberIndex !== -1) {
                handleDeleteTeamMember(memberIndex);
              }
            }
          }}
          contactName={clientToDelete?.name || teamMemberToDelete?.name || ""}
        />
      )}
    </Card>
  );
}
