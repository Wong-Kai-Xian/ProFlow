// src/components/Contacts.js
import React, { useState, useEffect } from "react";
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
import { db } from "../firebase"; // Import db from firebase.js
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, getDoc, query, where, onSnapshot } from "firebase/firestore";
import { useAuth } from '../contexts/AuthContext'; // Import useAuth
import { Link } from 'react-router-dom'; // Import Link

export default function Contacts() {
  const navigate = useNavigate();
  const [view, setView] = useState("clients");
  const [showAddOrg, setShowAddOrg] = useState(false);
  const [showDelOrg, setShowDelOrg] = useState(false);
  const [organizations, setOrganizations] = useState([]); // Re-initialize with empty array
  const [showAddClientModal, setShowAddClientModal] = useState(false); // New state for add client modal
  const [currentOrgIndex, setCurrentOrgIndex] = useState(null); // To keep track of which org to add client to
  const [showDeleteClientModal, setShowDeleteClientModal] = useState(false); // New state for delete client modal
  const [clientToDelete, setClientToDelete] = useState(null); // To store client to delete
  const [teamMembersList, setTeamMembersList] = useState([]); // Unified state for team members
  const { currentUser } = useAuth(); // Get currentUser from AuthContext

  useEffect(() => {
    if (!currentUser) {
      setOrganizations([]);
      setTeamMembersList([]);
      return; // Exit if no current user
    }

    const orgCollectionRef = collection(db, "organizations");
    const orgQuery = query(orgCollectionRef, where("userId", "==", currentUser.uid)); // Filter by userId
    const unsubscribeOrganizations = onSnapshot(orgQuery, async (snapshot) => {
      const orgList = [];
      for (const orgDoc of snapshot.docs) {
        const orgData = { id: orgDoc.id, ...orgDoc.data() };
        const clientsWithFullData = [];
        const clientPromises = (orgData.clients || []).map(async (clientRefData) => {
          console.log(`Processing clientRefData: ${JSON.stringify(clientRefData)} for organization ${orgDoc.id}`);
          try {
            const customerProfileDocRef = doc(db, "customerProfiles", clientRefData.id);
            const customerProfileDocSnap = await getDoc(customerProfileDocRef);
            console.log(`Customer profile snapshot exists for ID ${clientRefData.id}: ${customerProfileDocSnap.exists()}`);
            if (customerProfileDocSnap.exists()) {
              const customerProfileData = customerProfileDocSnap.data();
              return {
                id: customerProfileDocSnap.id,
                name: customerProfileData.customerProfile?.name || clientRefData.name,
                email: customerProfileData.customerProfile?.email || clientRefData.email,
                phone: customerProfileData.customerProfile?.phone || clientRefData.phone,
                company: customerProfileData.companyProfile?.company || clientRefData.company,
              };
            } else {
              console.warn(`Customer profile not found for ID: ${clientRefData.id}`);
              return clientRefData; // Fallback to basic data if profile not found
            }
          } catch (error) {
            console.error(`Error fetching customer profile for ID ${clientRefData.id}:`, error);
            return clientRefData; // Push existing data on error
          }
        });
        clientsWithFullData.push(...(await Promise.all(clientPromises)));
        orgList.push({ ...orgData, clients: clientsWithFullData });
      }
      setOrganizations(orgList);
    });

    // Fetch team members by looking at all projects the current user is part of
    const fetchTeamMembers = async () => {
      try {
        const projectQuery = query(
          collection(db, "projects"),
          where("team", "array-contains", currentUser.email)
        );
        const projectSnapshot = await getDocs(projectQuery);
        
        const uniqueMemberEmails = new Set();
        projectSnapshot.forEach(doc => {
          const projectData = doc.data();
          (projectData.team || []).forEach(memberEmail => {
            // Exclude the current user from the displayed team list if they are in the project team
            if (memberEmail !== currentUser.email) {
              uniqueMemberEmails.add(memberEmail);
            }
          });
        });

        // Optionally, fetch user details for these emails if needed for display
        const membersDetails = await Promise.all(Array.from(uniqueMemberEmails).map(async (email) => {
          const usersQuery = query(collection(db, "users"), where("email", "==", email));
          const userSnapshot = await getDocs(usersQuery);
          if (!userSnapshot.empty) {
            const userData = userSnapshot.docs[0].data();
            return { 
              uid: userSnapshot.docs[0].id, // Get the UID from the user document
              email: email,
              displayName: userData.name || email.split('@')[0] // Use stored name or derive from email
            };
          } else {
            console.warn(`User document not found for email: ${email}`);
            return { email: email, displayName: email.split('@')[0] }; // Fallback
          }
        }));
        setTeamMembersList(membersDetails);

      } catch (error) {
        console.error("Error fetching team members for Contacts page: ", error);
      }
    };

    fetchTeamMembers();
    // Note: This approach for team members is not real-time like onSnapshot, 
    // but provides a consistent view with TeamPage.js for initial sync.
    // If real-time updates for team members are critical here, a more complex setup 
    // involving multiple onSnapshot listeners or a single collection for all users' teams 
    // would be needed, which is out of scope for this task.

    return () => {
      unsubscribeOrganizations();
    };
  }, [currentUser]); // Add currentUser to dependency array

  const openWhatsApp = (number) => {
    if (number) {
      console.log("WhatsApp number:", number); // Debugging: log the number
      window.open(`https://wa.me/${String(number).replace(/\D/g, "")}`, "_blank");
    } else {
      console.warn("WhatsApp number is undefined or null.", number);
    }
  };

  const openEmail = (email) => {
    if (email) {
      console.log("Email address:", email); // Debugging: log the email
      window.open(`mailto:${email}`, "_blank");
    } else {
      console.warn("Email address is undefined or null.", email);
    }
  };

  const toggleCollapse = async (index) => {
    const orgToUpdate = organizations[index];
    const orgRef = doc(db, "organizations", orgToUpdate.id);
    await updateDoc(orgRef, { collapsed: !orgToUpdate.collapsed });

    const newOrgs = [...organizations];
    newOrgs[index].collapsed = !newOrgs[index].collapsed;
    setOrganizations(newOrgs);
  };

  const handleAddOrganization = async (name) => {
    if (name && currentUser) {
      try {
        await addDoc(collection(db, "organizations"), { name: name, clients: [], collapsed: false, userId: currentUser.uid }); // Add userId
        // Re-fetch or update state locally after adding
        // Given the complex client data fetching, it's safer to re-fetch all organizations
        const orgCollectionRef = collection(db, "organizations");
        const orgQuery = query(orgCollectionRef, where("userId", "==", currentUser.uid));
        const orgSnapshot = await getDocs(orgQuery);
        const orgList = [];
        for (const orgDoc of orgSnapshot.docs) {
          const orgData = { id: orgDoc.id, ...orgDoc.data() };
          const clientsWithFullData = [];
          for (const clientRefData of (orgData.clients || [])) {
            try {
              const customerProfileDocRef = doc(db, "customerProfiles", clientRefData.id);
              const customerProfileDocSnap = await getDoc(customerProfileDocRef);
              if (customerProfileDocSnap.exists()) {
                const customerProfileData = customerProfileDocSnap.data();
                clientsWithFullData.push({
                  id: customerProfileDocSnap.id,
                  name: customerProfileData.customerProfile?.name || clientRefData.name,
                  email: customerProfileData.customerProfile?.email || clientRefData.email,
                  phone: customerProfileData.customerProfile?.phone || clientRefData.phone,
                  company: customerProfileData.companyProfile?.company || clientRefData.company,
                });
              } else {
                console.warn(`Customer profile not found for ID: ${clientRefData.id}`);
                clientsWithFullData.push(clientRefData);
              }
            } catch (error) {
              console.error(`Error fetching customer profile for ID ${clientRefData.id}:`, error);
              clientsWithFullData.push(clientRefData);
            }
          }
          orgList.push({ ...orgData, clients: clientsWithFullData });
        }
        setOrganizations(orgList);
      } catch (error) {
        console.error("Error adding organization to Firestore:", error);
      }
    }
  };

  const handleDeleteOrganization = async (orgName) => {
    const orgToDelete = organizations.find(o => o.name === orgName);
    if (orgToDelete) {
      // Before deleting the organization, consider if its clients (customerProfiles) should also be deleted or unlinked.
      // For now, we'll just delete the organization document.
      await deleteDoc(doc(db, "organizations", orgToDelete.id));
    setOrganizations(organizations.filter(o => o.name !== orgName));
    }
  };

  const handleAddClient = async (clientData) => {
    if (!currentOrgIndex === null || !currentUser) return; // Should not happen if modal is opened correctly

    const currentOrgId = organizations[currentOrgIndex].id;
    const orgRef = doc(db, "organizations", currentOrgId);

    try {
      // 1. Create a new Customer Profile document
      const newCustomerProfileData = {
        customerProfile: {
          name: clientData.name,
          email: clientData.email,
          phone: clientData.phone,
        },
        companyProfile: {
          company: clientData.company || "",
          industry: "", // Default
          location: "", // Default
        },
        reputation: { rating: 0, summary: "" }, // Default
        activities: [],
        reminders: [],
        files: [],
        currentStage: "Working", // Default
        stageData: {
          "Working": { notes: [], tasks: [], completed: false },
          "Qualified": { notes: [], tasks: [], completed: false },
          "Converted": { notes: [], tasks: [], completed: false },
        },
        projects: [],
        status: "Active", // Default
        lastContact: new Date().toISOString(), // Use current timestamp for new contact
        userId: currentUser.uid, // Assign to current user
      };
      const newCustomerDocRef = await addDoc(collection(db, "customerProfiles"), newCustomerProfileData);
      const newCustomerProfileId = newCustomerDocRef.id;
      console.log("New customer profile created with ID:", newCustomerProfileId);

      // 2. Add a reference to this new customer profile in the organization's clients array
      const newClientEntry = {
        id: newCustomerProfileId, // Use the ID from the new customer profile
        name: clientData.name,
        email: clientData.email,
        phone: clientData.phone,
        company: clientData.company, // Store company name for direct display in Contacts
      };

      const currentClients = organizations[currentOrgIndex].clients || [];
      const updatedClients = [...currentClients, newClientEntry];

      await updateDoc(orgRef, { clients: updatedClients });
      console.log("Client added to organization and linked to customer profile.");

      // Refresh organizations to reflect the changes, especially the full data fetch
      // It's better to re-fetch the entire organizations list after a critical update like this
      const orgCollectionRef = collection(db, "organizations");
      const orgQuery = query(orgCollectionRef, where("userId", "==", currentUser.uid));
      const orgSnapshot = await getDocs(orgQuery);
      const orgList = [];
      for (const orgDoc of orgSnapshot.docs) {
        const orgData = { id: orgDoc.id, ...orgDoc.data() };
        const clientsWithFullData = [];
        for (const clientRefData of (orgData.clients || [])) {
          try {
            const customerProfileDocRef = doc(db, "customerProfiles", clientRefData.id);
            const customerProfileDocSnap = await getDoc(customerProfileDocRef);
            if (customerProfileDocSnap.exists()) {
              const customerProfileData = customerProfileDocSnap.data();
              clientsWithFullData.push({
                id: customerProfileDocSnap.id,
                name: customerProfileData.customerProfile?.name || clientRefData.name,
                email: customerProfileData.customerProfile?.email || clientRefData.email,
                phone: customerProfileData.customerProfile?.phone || clientRefData.phone,
                company: customerProfileData.companyProfile?.company || clientRefData.company,
                organizationId: orgData.id, // Include organization ID
              });
            } else {
              console.warn(`Customer profile not found for ID: ${clientRefData.id}`);
              clientsWithFullData.push(clientRefData);
            }
          } catch (error) {
            console.error(`Error fetching customer profile for ID ${clientRefData.id}:`, error);
            clientsWithFullData.push(clientRefData);
          }
        }
        orgList.push({ ...orgData, clients: clientsWithFullData });
      }
      setOrganizations(orgList);

    setShowAddClientModal(false);
    setCurrentOrgIndex(null);
    } catch (error) {
      console.error("Error adding client and customer profile: ", error);
    }
  };

  const handleRemoveClient = async (orgIndex, clientIdToRemove) => {
    const orgRef = doc(db, "organizations", organizations[orgIndex].id);
    const newClients = organizations[orgIndex].clients.filter(client => client.id !== clientIdToRemove);
    await updateDoc(orgRef, { clients: newClients });

    // Also delete the corresponding customer profile
    try {
      await deleteDoc(doc(db, "customerProfiles", clientIdToRemove));
      console.log("Corresponding customer profile deleted for ID:", clientIdToRemove);
    } catch (error) {
      console.error("Error deleting customer profile:", error);
    }

    // Optimistically update UI
    const newOrgs = [...organizations];
    newOrgs[orgIndex].clients = newClients;
    setOrganizations(newOrgs);
    setShowDeleteClientModal(false);
    setClientToDelete(null);
  };

  const addClient = (orgIndex) => {
    setCurrentOrgIndex(orgIndex);
    setShowAddClientModal(true);
  };

  const removeClient = (orgIndex, clientToRemove) => {
      setCurrentOrgIndex(orgIndex);
    setClientToDelete(clientToRemove);
      setShowDeleteClientModal(true);
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: LAYOUT.gap }}>
        <h3 style={{ margin: "0 auto 0 0", color: COLORS.text, fontSize: "18px" }}>Contacts</h3> {/* Adjusted margin for spacing */}
        <div style={{ display: "flex", gap: LAYOUT.smallGap }}>
          {view === "clients" && currentUser && (
            <>
              <button onClick={() => setShowAddOrg(true)} style={{ ...BUTTON_STYLES.primary, padding: "4px 8px", fontSize: "10px" }}>+</button>
              <button onClick={() => setShowDelOrg(true)} style={{ ...BUTTON_STYLES.primary, background: COLORS.danger, padding: "4px 8px", fontSize: "10px" }}>-</button>
            </>
          )}
        </div>
      </div>

      {/* View Switch */}
      {currentUser && (
        <div style={{ display: "flex", gap: LAYOUT.gap, marginBottom: LAYOUT.smallGap, border: `1px solid ${COLORS.lightBorder}`, borderRadius: LAYOUT.borderRadius }}>
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
      )}

      {currentUser ? (
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
                      <button 
                        onClick={() => toggleCollapse(idx)} 
                        style={{
                          ...BUTTON_STYLES.secondary,
                          padding: "4px 8px",
                          fontSize: "10px",
                          borderRadius: "3px",
                          background: COLORS.gray,
                          color: COLORS.white,
                        }}
                      >
                        {org.collapsed ? <FaChevronDown /> : <FaChevronUp />}
                      </button>
                    </div>
                  </div>
                  {!org.collapsed && org.clients?.map((c, i) => (
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
                        <strong style={{ color: COLORS.text, wordBreak: "break-word", fontSize: "13px" }}>{c.name}</strong><br/>
                        <span style={{ fontSize: "11px", color: COLORS.lightText, wordBreak: "break-word" }}>{c.email}</span>
                      </div>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-start", width: "100%", marginTop: "8px" }}> {/* Changed to flex-start, increased gap, added margin-top */}
                        <button onClick={(e) => { e.stopPropagation(); openWhatsApp(c.phone); }} style={{ ...BUTTON_STYLES.primary, background: COLORS.success, padding: "6px 12px", fontSize: "16px", display: "flex", justifyContent: "center", alignItems: "center" }}><FaWhatsapp /></button> {/* Increased size */}
                        <button onClick={(e) => { e.stopPropagation(); openEmail(c.email); }} style={{ ...BUTTON_STYLES.primary, background: COLORS.secondary, padding: "6px 12px", fontSize: "16px", display: "flex", justifyContent: "center", alignItems: "center" }}><MdEmail /></button> {/* Increased size */}
                        <button onClick={(e) => { e.stopPropagation(); removeClient(idx, c); }} style={{ ...BUTTON_STYLES.primary, background: COLORS.danger, padding: "6px 12px", fontSize: "16px", borderRadius: "3px", display: "flex", justifyContent: "center", alignItems: "center" }}><FaTrash /></button> {/* Increased size */}
                      </div>
                    </div>
                  ))}
                </li>
              ))
            : teamMembersList.map((member, i) => (
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
                    {member.uid ? (
                      <Link to={`/profile/${member.uid}`} style={{ textDecoration: 'none' }}>
                        <strong style={{ color: COLORS.primary, wordBreak: "break-word", cursor: "pointer" }}>{member.displayName}</strong><br/>
                        <span style={{ fontSize: "12px", color: COLORS.lightText, wordBreak: "break-word", cursor: "pointer" }}>{member.email}</span>
                      </Link>
                    ) : (
                      <>
                        <strong style={{ color: COLORS.text, wordBreak: "break-word" }}>{member.displayName}</strong><br/>
                        <span style={{ fontSize: "12px", color: COLORS.lightText, wordBreak: "break-word" }}>{member.email}</span>
                      </>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-start", width: "100%", marginTop: "8px" }}>
                    {/* WhatsApp and Email buttons for team members, assuming phone and email are available */}
                    {member.phone && <button onClick={(e) => { e.stopPropagation(); openWhatsApp(member.phone); }} style={{ ...BUTTON_STYLES.primary, background: COLORS.success, padding: "6px 12px", fontSize: "16px", display: "flex", justifyContent: "center", alignItems: "center" }}><FaWhatsapp /></button>}
                    {member.email && <button onClick={(e) => { e.stopPropagation(); openEmail(member.email); }} style={{ ...BUTTON_STYLES.primary, background: COLORS.secondary, padding: "6px 12px", fontSize: "16px", display: "flex", justifyContent: "center", alignItems: "center" }}><MdEmail /></button>}
                    {/* Removed delete button for team members as management is moved to TeamPage */}
                  </div>
                </li>
              ))
          }
        </ul>
      ) : (
        <p style={{ color: COLORS.danger, textAlign: 'center', padding: '20px' }}>Please log in to view and manage contacts.</p>
      )}

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
      {showDeleteClientModal && (clientToDelete) && (
        <DeleteProfileModal
          isOpen={showDeleteClientModal}
          onClose={() => {
            setShowDeleteClientModal(false);
            setClientToDelete(null);
            // setTeamMemberToDelete(null); // No longer needed
          }}
          onDeleteConfirm={() => {
            if (clientToDelete && currentOrgIndex !== null) { 
              handleRemoveClient(currentOrgIndex, clientToDelete.id);
            } // Removed team member deletion logic
          }}
          contactName={clientToDelete?.name || ""} // Only pass client name for deletion
        />
      )}
    </Card>
  );
}
