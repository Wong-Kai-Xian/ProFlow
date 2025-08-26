import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import { DESIGN_SYSTEM, getPageContainerStyle, getCardStyle, getContentContainerStyle, getButtonStyle } from '../styles/designSystem';
// import customerDataArray from "../components/profile-component/customerData.js"; // Remove mock data import
import { db } from "../firebase"; // Import db
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, query, where, getDocs, serverTimestamp, arrayRemove, getDoc } from "firebase/firestore"; // Import Firestore functions
import IncomingCustomerSharesModal from "../components/profile-component/IncomingCustomerSharesModal";
import AddProfileModal from "../components/profile-component/AddProfileModal"; // Import AddProfileModal
import { useAuth } from '../contexts/AuthContext'; // Import useAuth
import { FaTrash, FaInbox } from 'react-icons/fa'; // Import icons
import DeleteProfileModal from '../components/profile-component/DeleteProfileModal'; // Import DeleteProfileModal

// Get initials from customer name
const getInitials = (name) => {
  if (!name || typeof name !== 'string') return 'NA';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'NA';
  return parts
    .map((word) => (word && word[0] ? word[0].toUpperCase() : ''))
    .join('') || 'NA';
};

// Generate a consistent color based on string
const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return "#" + "00000".substring(0, 6 - c.length) + c;
};

// Define the stages for progress tracking
const STAGES = ["Working", "Qualified", "Converted"];

// Calculate progress based on current stage and tasks completed within stages
const getProgress = (customer) => {
  // Use customer.stages for calculating progress, fallback to local STAGES if not available
  const stagesToUse = customer.stages || STAGES;
  const currentStageIndex = stagesToUse.indexOf(customer.currentStage);
  if (currentStageIndex === -1) return 0; // Should not happen

  let completedStages = 0;
  let totalStages = stagesToUse.length;
  let stageProgress = 0;

  for (let i = 0; i < stagesToUse.length; i++) {
    const stageName = stagesToUse[i];
    const stage = customer.stageData?.[stageName];

    if (stage && stage.completed) {
      completedStages++;
    } else if (stageName === customer.currentStage && stage && stage.tasks) {
      const completedTasks = stage.tasks.filter(task => task.done).length;
      const totalTasks = stage.tasks.length;
      stageProgress = totalTasks > 0 ? (completedTasks / totalTasks) : 0;
      // Add a fraction of a stage based on task completion
      return ((completedStages + stageProgress) / totalStages) * 100;
    }
  }
  return (completedStages / totalStages) * 100;
};

export default function CustomerProfileList() {
  const [customers, setCustomers] = useState([]); // Combined list (legacy + shared)
  const [legacyCustomers, setLegacyCustomers] = useState([]); // where userId == currentUser.uid (legacy)
  const [sharedCustomers, setSharedCustomers] = useState([]); // where access array-contains currentUser.uid
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false); // New state for modal
  const [showDeleteCustomerModal, setShowDeleteCustomerModal] = useState(false); // State for delete confirmation modal
  const [customerToDelete, setCustomerToDelete] = useState(null); // State to hold the customer to be deleted
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false); // Loading state for customer creation
  const { currentUser } = useAuth(); // Get currentUser from AuthContext
  const [showIncomingShares, setShowIncomingShares] = useState(false);
  const [pendingSharesCount, setPendingSharesCount] = useState(0);

  useEffect(() => {
    if (!currentUser) {
      setCustomers([]);
      setLegacyCustomers([]);
      setSharedCustomers([]);
      setPendingSharesCount(0);
      return;
    }

    const customerProfilesCollectionRef = collection(db, "customerProfiles");
    const legacyQuery = query(customerProfilesCollectionRef, where("userId", "==", currentUser.uid));
    const sharedQuery = query(customerProfilesCollectionRef, where("access", "array-contains", currentUser.uid));

    const mapDoc = (docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
      customerProfile: docSnap.data().customerProfile || {},
      companyProfile: docSnap.data().companyProfile || {},
      reputation: docSnap.data().reputation || {},
      activities: docSnap.data().activities || [],
      reminders: docSnap.data().reminders || [],
      files: docSnap.data().files || [],
      stageData: docSnap.data().stageData || {},
      projects: docSnap.data().projects || [],
      lastContact: docSnap.data().lastContact || "N/A",
      stages: docSnap.data().stages || STAGES,
    });

    const unsubLegacy = onSnapshot(legacyQuery, (snapshot) => {
      const list = snapshot.docs
        .map(mapDoc)
        .filter((d) => {
          const access = Array.isArray(d.access) ? d.access : null;
          if (!access) return true; // legacy doc without access -> still show
          return access.includes(currentUser.uid);
        });
      setLegacyCustomers(list);
    });
    const unsubShared = onSnapshot(sharedQuery, (snapshot) => {
      const list = snapshot.docs.map(mapDoc);
      setSharedCustomers(list);
    });

    return () => { unsubLegacy(); unsubShared(); };
  }, [currentUser]);

  // Live pending shares count (to highlight button)
  useEffect(() => {
    if (!currentUser) { setPendingSharesCount(0); return; }
    const base = collection(db, 'customerShares');
    const qUid = query(base, where('toUserId', '==', currentUser.uid), where('status', '==', 'pending'));
    const qEmail = currentUser.email ? query(base, where('toUserEmail', '==', currentUser.email), where('status', '==', 'pending')) : null;
    const unsubs = [];
    const updateCount = (lists) => {
      const ids = new Set();
      lists.forEach(snap => snap && snap.docs && snap.docs.forEach(d => ids.add(d.id)));
      setPendingSharesCount(ids.size);
    };
    const unsub1 = onSnapshot(qUid, (snap) => {
      if (qEmail) {
        // we'll update in combined handler via second snapshot too
        // temporarily store in localStorage to merge
        try { localStorage.setItem('pending_shares_uid', String(snap.size || 0)); } catch {}
      } else {
        updateCount([snap]);
      }
    });
    unsubs.push(unsub1);
    if (qEmail) {
      const unsub2 = onSnapshot(qEmail, (snapEmail) => {
        // Merge both counts by IDs; re-run queries; simpler approach: fetch both once here
        getDocs(qUid).then(snapUid => updateCount([snapUid, snapEmail])).catch(() => updateCount([snapEmail]));
      });
      unsubs.push(unsub2);
    }
    return () => { unsubs.forEach(u => { try { u(); } catch {} }); };
  }, [currentUser]);

  // Merge lists and de-duplicate
  useEffect(() => {
    const map = new Map();
    for (const c of legacyCustomers) map.set(c.id, c);
    for (const c of sharedCustomers) map.set(c.id, c);
    setCustomers(Array.from(map.values()));
  }, [legacyCustomers, sharedCustomers]);

  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  const filteredCustomers = customers.filter((customer) => {
    const name = customer?.customerProfile?.name || '';
    const company = customer?.companyProfile?.company || '';
    const email = customer?.customerProfile?.email || '';
    const term = (searchTerm || '').toLowerCase();
    return (
      name.toLowerCase().includes(term) ||
      company.toLowerCase().includes(term) ||
      email.toLowerCase().includes(term)
    );
  });

  const getStatusColor = (currentStage) => {
    switch (currentStage) {
      case 'Working': return DESIGN_SYSTEM.colors.primary[500]; // Blue
      case 'Qualified': return DESIGN_SYSTEM.colors.success; // Green
      case 'Converted': return DESIGN_SYSTEM.colors.accent; // A different color for converted
      default: return DESIGN_SYSTEM.colors.text.secondary; // Default color
    }
  };

  const handleCreateNewCustomerFromModal = async (clientData) => {
    setIsCreatingCustomer(true);
    try {
      const companyName = clientData.company || "Uncategorized Company"; // Default company name
      const initialCustomerData = {
        customerProfile: {
          name: clientData.name,
          email: clientData.email,
          phone: clientData.phone,
        },
        companyProfile: {
          company: companyName,
          industry: "", // Default
          location: "", // Default
        },
        reputation: { rating: 0, summary: "" },
        activities: [],
        reminders: [],
        files: [],
        currentStage: STAGES[0],
        stageData: {
          "Working": { notes: [], tasks: [], completed: false },
          "Qualified": { notes: [], tasks: [], completed: false },
          "Converted": { notes: [], tasks: [], completed: false },
        },
        projects: [],
        lastContact: serverTimestamp(), // Set timestamp on first save
        createdAt: serverTimestamp(), // Set creation timestamp
        userId: currentUser.uid, // Legacy owner field (for backward compatibility)
        ownerId: currentUser.uid, // New explicit owner field
        access: [currentUser.uid], // Access control: users who can view/manage this profile
      };
      const newCustomerDocRef = await addDoc(collection(db, "customerProfiles"), initialCustomerData);
      console.log("New customer profile created from modal with ID:", newCustomerDocRef.id);

      // Link to Contacts (Organizations)
      const newCustomerId = newCustomerDocRef.id;
      const organizationsRef = collection(db, "organizations");
      const q = query(organizationsRef, where("name", "==", clientData.company || ""), where("userId", "==", currentUser.uid)); // Filter by current user's organizations
      const querySnapshot = await getDocs(q);

      let targetOrgDoc = null;
      if (!querySnapshot.empty) {
        targetOrgDoc = querySnapshot.docs[0];
      }

      const clientToAdd = {
        id: newCustomerId,
        name: clientData.name,
        email: clientData.email,
        phone: clientData.phone,
        company: clientData.company,
      };

      if (targetOrgDoc) {
        const currentClients = targetOrgDoc.data().clients || [];
        const updatedClients = [...currentClients, clientToAdd];
        await updateDoc(doc(db, "organizations", targetOrgDoc.id), { clients: updatedClients });
        console.log("New customer from modal added to existing organization:", targetOrgDoc.id);
      } else {
        const newOrganization = {
          name: companyName, // Use the defaulted company name here
          clients: [clientToAdd],
          collapsed: false,
          userId: currentUser.uid, // Associate new organization with the current user
        };
        await addDoc(organizationsRef, newOrganization);
        console.log("New organization created from modal with new customer.");
      }

      setShowAddCustomerModal(false); // Close the modal
      
      // Show success notice
      const successNotice = document.createElement('div');
      successNotice.innerHTML = `
        <div style="
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          padding: 32px;
          border-radius: 12px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
          text-align: center;
          z-index: 10000;
          max-width: 400px;
          width: 90%;
        ">
          <div style="
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: #10b981;
            margin: 0 auto 16px auto;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            color: white;
          ">✓</div>
          <h3 style="
            margin: 0 0 8px 0;
            color: #1f2937;
            font-size: 20px;
            font-weight: 700;
          ">Customer Profile Created!</h3>
          <p style="
            margin: 0 0 16px 0;
            color: #6b7280;
            font-size: 16px;
          ">Redirecting to the customer profile...</p>
          <div style="
            width: 32px;
            height: 32px;
            border: 3px solid #e5e7eb;
            border-top: 3px solid #10b981;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto;
          "></div>
        </div>
        <div style="
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 9999;
        "></div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;
      document.body.appendChild(successNotice);
      
      // Navigate after showing notice for 2 seconds
      setTimeout(() => {
        document.body.removeChild(successNotice);
        navigate(`/customer/${newCustomerDocRef.id}`);
      }, 2000);
      
    } catch (error) {
      console.error("Error creating new customer from modal: ", error);
      alert("Failed to create customer profile. Please try again.");
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  const handleCustomerClick = (customer) => {
    navigate(`/customer/${customer.id}`);
  };

  const handleDeleteCustomer = (customer) => {
    console.log("handleDeleteCustomer called for customer:", customer);
    setCustomerToDelete(customer);
    setShowDeleteCustomerModal(true);
    console.log("showDeleteCustomerModal set to true, customerToDelete set to:", customer);
    console.log("Customer name passed to modal:", customer?.customerProfile?.name || customer?.companyProfile?.company);
  };

  const confirmDeleteCustomer = async () => {
    console.log("confirmDeleteCustomer called.");
    if (!customerToDelete || !currentUser) {
      console.log("Deletion aborted: customerToDelete or currentUser is missing.", { customerToDelete, currentUser });
      return; // Ensure customer is selected and user is logged in
    }
    console.log("Attempting to delete customer:", customerToDelete.id);

    try {
      // Load current access list
      const ref = doc(db, "customerProfiles", customerToDelete.id);
      const snap = await getDoc(ref);
      let data = snap.exists() ? snap.data() : {};
      const access = Array.isArray(data.access) ? data.access : (data.userId ? [data.userId] : []);

      if (access.length > 1) {
        // Not the last user -> remove current user from access and do NOT delete document
        await updateDoc(ref, { access: arrayRemove(currentUser.uid) });
        console.log(`Removed user ${currentUser.uid} from access of ${customerToDelete.id}`);
      } else {
        // Last user -> delete the document
        await deleteDoc(ref);
        console.log("Customer profile deleted with ID:", customerToDelete.id);
      }

      // 2. Remove the reference from the associated organization's clients array for this user
      if (customerToDelete.companyProfile?.company) {
        const organizationsRef = collection(db, "organizations");
        const q = query(organizationsRef, where("name", "==", customerToDelete.companyProfile.company), where("userId", "==", currentUser.uid));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const orgDoc = querySnapshot.docs[0];
          const currentClients = orgDoc.data().clients || [];
          const updatedClients = currentClients.filter(client => client.id !== customerToDelete.id);
          await updateDoc(doc(db, "organizations", orgDoc.id), { clients: updatedClients });
          console.log(`Customer ${customerToDelete.id} removed from organization ${orgDoc.id}.`);
          // If organization has no more clients, delete it as well
          if (updatedClients.length === 0) {
            await deleteDoc(doc(db, "organizations", orgDoc.id));
            console.log(`Deleted empty organization ${orgDoc.id} after removing last client.`);
          }
        }
      }

      // Close the modal after successful deletion
      setShowDeleteCustomerModal(false);
      setCustomerToDelete(null);
    } catch (error) {
      console.error("Error deleting customer profile:", error);
      alert("Failed to delete customer profile.");
    }
  };

  return (
    <div style={getPageContainerStyle()}>
      <TopBar />

      <div style={{
        ...getContentContainerStyle(),
        paddingTop: DESIGN_SYSTEM.spacing['2xl']
      }}>
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          marginBottom: DESIGN_SYSTEM.spacing.xl,
          padding: DESIGN_SYSTEM.spacing.xl,
          background: DESIGN_SYSTEM.pageThemes.customers.gradient,
          borderRadius: DESIGN_SYSTEM.borderRadius.xl,
          color: DESIGN_SYSTEM.colors.text.inverse,
          boxShadow: DESIGN_SYSTEM.shadows.lg
        }}>
          <div>
            <h1 style={{ 
              margin: `0 0 ${DESIGN_SYSTEM.spacing.sm} 0`, 
              fontSize: DESIGN_SYSTEM.typography.fontSize['3xl'], 
              fontWeight: DESIGN_SYSTEM.typography.fontWeight.bold
            }}>
              Customer Relationships
            </h1>
            <p style={{ 
              margin: 0, 
              fontSize: DESIGN_SYSTEM.typography.fontSize.lg, 
              opacity: 0.9 
            }}>
              Manage your customer relationships and track progress • {filteredCustomers.length} customers
            </p>
          </div>
          {currentUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: DESIGN_SYSTEM.spacing.base }}>
              <button
                onClick={() => setShowAddCustomerModal(true)}
                style={{
                  ...getButtonStyle('primary', 'customers'),
                  padding: `${DESIGN_SYSTEM.spacing.base} ${DESIGN_SYSTEM.spacing.lg}`,
                  fontSize: DESIGN_SYSTEM.typography.fontSize.base,
                  fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold,
                  borderRadius: DESIGN_SYSTEM.borderRadius.lg,
                  boxShadow: "0 4px 15px rgba(255, 255, 255, 0.3)"
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = "translateY(-2px)";
                  e.target.style.boxShadow = "0 6px 20px rgba(255, 255, 255, 0.4)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = "translateY(0)";
                  e.target.style.boxShadow = "0 4px 15px rgba(255, 255, 255, 0.3)";
                }}
              >
                Add New Customer
              </button>
              <button
                onClick={() => setShowIncomingShares(true)}
                style={{
                  ...(pendingSharesCount > 0 ? getButtonStyle('primary', 'customers') : getButtonStyle('secondary', 'customers')),
                  padding: `${DESIGN_SYSTEM.spacing.base} ${DESIGN_SYSTEM.spacing.lg}`,
                  fontSize: DESIGN_SYSTEM.typography.fontSize.base,
                  fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold,
                  borderRadius: DESIGN_SYSTEM.borderRadius.lg,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <FaInbox style={{ marginRight: 4 }} /> Incoming Shares
                {pendingSharesCount > 0 && (
                  <span style={{
                    marginLeft: 6,
                    background: '#ef4444',
                    color: '#fff',
                    borderRadius: 9999,
                    padding: '2px 8px',
                    fontSize: 12,
                    fontWeight: 700
                  }}>{pendingSharesCount}</span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        {currentUser && (
          <div style={{ 
            display: "flex", 
            gap: "20px", 
            marginBottom: "30px",
            alignItems: "center"
          }}>
            {/* Search Bar */}
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                fontFamily: DESIGN_SYSTEM.typography.fontFamily.primary,
                width: "100%",
                maxWidth: "400px",
                padding: `${DESIGN_SYSTEM.spacing.base} ${DESIGN_SYSTEM.spacing.base}`,
                fontSize: DESIGN_SYSTEM.typography.fontSize.base,
                borderRadius: DESIGN_SYSTEM.borderRadius.base,
                border: `2px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                backgroundColor: DESIGN_SYSTEM.colors.background.primary,
                color: DESIGN_SYSTEM.colors.text.primary,
                transition: "border-color 0.3s ease"
              }}
              onFocus={(e) => {
                e.target.style.borderColor = DESIGN_SYSTEM.colors.primary[500];
              }}
              onBlur={(e) => {
                e.target.style.borderColor = DESIGN_SYSTEM.colors.secondary[300];
              }}
            />

            {/* Status Filter - REMOVED */}
            {/*
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                ...INPUT_STYLES.base,
                padding: "12px 16px",
                fontSize: "16px",
                borderRadius: "8px",
                border: `2px solid ${COLORS.border}`,
                minWidth: "150px"
              }}
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            */}
          </div>
        )}

        {/* Customer Grid */}
        {filteredCustomers.length === 0 && currentUser ? (
          <div style={{
            textAlign: "center",
            padding: "60px 20px",
            color: DESIGN_SYSTEM.colors.text.secondary,
            fontSize: "18px"
          }}>
            {searchTerm ? `No customers found matching "${searchTerm}"` : "No customers yet. Add your first customer!"}
          </div>
        ) : filteredCustomers.length === 0 && !currentUser ? (
          <div style={{
            textAlign: "center",
            padding: "60px 20px",
            color: DESIGN_SYSTEM.colors.error,
            fontSize: "18px"
          }}>
            Please log in to view and manage customer profiles.
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
            gap: DESIGN_SYSTEM.spacing.lg,
            marginBottom: DESIGN_SYSTEM.spacing.xl,
            padding: `0 ${DESIGN_SYSTEM.spacing.base}`
          }}>
            {filteredCustomers.map((customer) => {
              const nameForColor = customer?.customerProfile?.name || customer?.companyProfile?.company || 'Customer';
              const bgColor = stringToColor(nameForColor);
              const progress = getProgress(customer);
              const currentStageName = customer.currentStage;
              const currentStageColor = getStatusColor(currentStageName); // Use currentStageName for color

              return (
                <div
                  key={customer.id}
                  style={{
                    ...getCardStyle('customers'),
                    cursor: "pointer",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    position: "relative",
                    overflow: "hidden",
                    padding: DESIGN_SYSTEM.spacing.lg // Ensure consistent padding inside the card
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-6px)";
                    e.currentTarget.style.boxShadow = DESIGN_SYSTEM.shadows.xl;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = DESIGN_SYSTEM.shadows.md;
                  }}
                  onClick={() => handleCustomerClick(customer)}
                >
                  {/* Delete Button */}
                  {currentUser && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent navigation to profile
                        handleDeleteCustomer(customer);
                      }}
                      style={{
                        position: "absolute",
                        top: DESIGN_SYSTEM.spacing.base,
                        right: DESIGN_SYSTEM.spacing.lg,
                        background: DESIGN_SYSTEM.colors.error,
                        border: "none",
                        borderRadius: DESIGN_SYSTEM.borderRadius.sm,
                        padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.sm}`,
                        cursor: "pointer",
                        fontSize: DESIGN_SYSTEM.typography.fontSize.base,
                        color: DESIGN_SYSTEM.colors.text.inverse,
                        transition: "all 0.2s ease",
                        zIndex: 2,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = DESIGN_SYSTEM.colors.error[700]; // Darker red on hover
                        e.currentTarget.style.transform = "scale(1.05)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = DESIGN_SYSTEM.colors.error; // Revert to original red on mouse leave
                        e.currentTarget.style.transform = "scale(1)";
                      }}
                    >
                      <FaTrash />
                    </button>
                  )}

                  {/* Creative Progress Bar at the top */}
                  <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: `${progress}%`,
                    height: "8px",
                    backgroundColor: currentStageColor,
                    borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`, // Match card borderRadius
                    transition: "width 0.5s ease-in-out"
                  }} />

                  {/* Current Stage Indicator */}
                  <div style={{
                    position: "absolute",
                    top: DESIGN_SYSTEM.spacing.base,
                    left: DESIGN_SYSTEM.spacing.lg,
                    padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.sm}`,
                    borderRadius: DESIGN_SYSTEM.borderRadius.lg,
                    backgroundColor: `${currentStageColor}20`,
                    color: currentStageColor,
                    fontSize: DESIGN_SYSTEM.typography.fontSize.xs,
                    fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold,
                    zIndex: 1
                  }}>
                    {currentStageName}
                  </div>
                  
                  <div style={{ 
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    marginBottom: DESIGN_SYSTEM.spacing.lg,
                    marginTop: DESIGN_SYSTEM.spacing.xl // Give space for the top elements
                  }}>
                    {/* Customer Avatar */}
                    <div style={{
                      width: DESIGN_SYSTEM.spacing['3xl'], 
                      height: DESIGN_SYSTEM.spacing['3xl'], 
                      borderRadius: DESIGN_SYSTEM.borderRadius.full,
                      backgroundColor: bgColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: DESIGN_SYSTEM.typography.fontSize.xl,
                      fontWeight: DESIGN_SYSTEM.typography.fontWeight.bold,
                      color: DESIGN_SYSTEM.colors.text.inverse,
                      marginBottom: DESIGN_SYSTEM.spacing.lg
                    }}>
                      {getInitials(customer?.customerProfile?.name || customer?.companyProfile?.company || 'N/A')}
                    </div>
                    
                    <h3 style={{
                      margin: `0 0 ${DESIGN_SYSTEM.spacing.xs} 0`, 
                      color: DESIGN_SYSTEM.colors.text.primary,
                      fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
                      fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold,
                      textAlign: 'center'
                    }}>
                      {customer.customerProfile.name || customer.companyProfile.company}
                    </h3>
                    <p style={{
                      margin: 0,
                      color: DESIGN_SYSTEM.colors.text.secondary,
                      fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                      textAlign: 'center'
                    }}>
                      {customer.companyProfile.company || customer.customerProfile.email || customer.companyProfile.industry}
                    </p>
                    <div style={{
                      margin: "4px 0 0 0",
                      color: DESIGN_SYSTEM.colors.text.secondary,
                      fontSize: "12px",
                      textAlign: 'center'
                    }}>
                      Created: {(() => {
                        try {
                          // Check multiple possible timestamp fields that might exist on existing customer profiles
                          const ts = customer.createdAt || customer.timestamp || customer.dateCreated || customer.creationDate || customer.created;
                          if (!ts) return 'N/A';
                          
                          let d;
                          if (ts?.toDate && typeof ts.toDate === 'function') {
                            // Firestore Timestamp
                            d = ts.toDate();
                          } else if (typeof ts === 'number') {
                            // Unix timestamp (seconds or milliseconds)
                            d = new Date(ts > 1000000000000 ? ts : ts * 1000);
                          } else if (typeof ts === 'string') {
                            // ISO string or other date string
                            d = new Date(ts);
                          } else if (ts instanceof Date) {
                            // Already a Date object
                            d = ts;
                          } else {
                            d = null;
                          }
                          
                          if (d && !isNaN(d.getTime())) {
                            return d.toLocaleDateString() + ' at ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          }
                          return 'N/A';
                        } catch (error) {
                          console.warn('Error parsing customer creation date:', error);
                          return 'N/A';
                        }
                      })()}
                    </div>
                  </div>
  
                  <div style={{ 
                    display: "flex",
                    justifyContent: "space-around",
                    width: "100%",
                    paddingTop: DESIGN_SYSTEM.spacing.lg,
                    borderTop: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`,
                    marginTop: DESIGN_SYSTEM.spacing.lg // Add margin top for separation
                  }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{
                        fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                        fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold,
                        color: DESIGN_SYSTEM.colors.text.primary
                      }}>
                        Projects
                      </div>
                      <div style={{
                        fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                        color: DESIGN_SYSTEM.colors.text.secondary
                      }}>
                        {customer.projects.length}
                      </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{
                        fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                        fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold,
                        color: DESIGN_SYSTEM.colors.text.primary
                      }}>
                        Last Contact
                      </div>
                      <div style={{
                        fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                        color: DESIGN_SYSTEM.colors.text.secondary
                      }}>
                        {customer.lastContact !== "N/A" ? new Date(customer.lastContact).toLocaleDateString() : "N/A"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* Add New Customer Modal */}
      <AddProfileModal
        isOpen={showAddCustomerModal}
        onClose={() => setShowAddCustomerModal(false)}
        onAddContact={handleCreateNewCustomerFromModal}
        isLoading={isCreatingCustomer}
      />
      {/* Delete Confirmation Modal */}
      <DeleteProfileModal
        isOpen={showDeleteCustomerModal}
        onClose={() => setShowDeleteCustomerModal(false)}
        onDeleteConfirm={confirmDeleteCustomer}
        contactName={customerToDelete?.customerProfile?.name || customerToDelete?.companyProfile?.company || "this customer"}
      />
      {/* Incoming Shares Modal */}
      <IncomingCustomerSharesModal
        isOpen={showIncomingShares}
        onClose={() => setShowIncomingShares(false)}
      />
    </div>
  );
}
