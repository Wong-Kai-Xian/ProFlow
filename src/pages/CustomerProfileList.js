import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import { DESIGN_SYSTEM, getPageContainerStyle, getCardStyle, getContentContainerStyle, getButtonStyle } from '../styles/designSystem';
// import customerDataArray from "../components/profile-component/customerData.js"; // Remove mock data import
import { db } from "../firebase"; // Import db
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, query, where, getDocs, serverTimestamp, arrayRemove, getDoc } from "firebase/firestore"; // Import Firestore functions
import { getLeadScoringSettings, saveLeadScoringSettings } from '../services/leadScoreService';
import IncomingCustomerSharesModal from "../components/profile-component/IncomingCustomerSharesModal";
import AddProfileModal from "../components/profile-component/AddProfileModal"; // Import AddProfileModal
import { useAuth } from '../contexts/AuthContext'; // Import useAuth
import { FaTrash, FaInbox } from 'react-icons/fa'; // Import icons
import DeleteProfileModal from '../components/profile-component/DeleteProfileModal'; // Import DeleteProfileModal
// SOP templates removed - now handled in CustomerProfile page

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
  const [showLeadSettings, setShowLeadSettings] = useState(false);
  const [leadSettings, setLeadSettings] = useState(null);
  const [industryOpen, setIndustryOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const INDUSTRY_OPTIONS = [
    'Construction','Manufacturing','Technology','Healthcare','Retail','Real Estate','Education','Finance','Logistics','Hospitality','Energy','Consulting'
  ];
  const COUNTRY_OPTIONS = [
    { code: 'MY', name: 'Malaysia' },
    { code: 'SG', name: 'Singapore' },
    { code: 'ID', name: 'Indonesia' },
    { code: 'TH', name: 'Thailand' },
    { code: 'VN', name: 'Vietnam' },
    { code: 'PH', name: 'Philippines' },
    { code: 'CN', name: 'China' },
    { code: 'HK', name: 'Hong Kong' },
    { code: 'TW', name: 'Taiwan' },
    { code: 'JP', name: 'Japan' },
    { code: 'KR', name: 'South Korea' },
    { code: 'IN', name: 'India' },
    { code: 'AU', name: 'Australia' },
    { code: 'NZ', name: 'New Zealand' },
    { code: 'US', name: 'United States' },
    { code: 'GB', name: 'United Kingdom' }
  ];

  // SOP removed - now handled in CustomerProfile page

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

  // Load lead score settings at list page
  useEffect(() => {
    (async () => {
      try {
        if (!currentUser?.uid) { setLeadSettings(null); return; }
        const s = await getLeadScoringSettings(currentUser.uid);
        setLeadSettings(s);
      } catch { setLeadSettings(null); }
    })();
  }, [currentUser?.uid]);

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

  const [sortMode, setSortMode] = useState('alpha'); // 'alpha' | 'score_desc' | 'score_asc'

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

  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    if (sortMode === 'score_desc') {
      const sa = a?.leadScores?.noProject?.score ?? a?.leadScore?.score ?? -1;
      const sb = b?.leadScores?.noProject?.score ?? b?.leadScore?.score ?? -1;
      return (sb - sa);
    }
    if (sortMode === 'score_asc') {
      const sa = a?.leadScores?.noProject?.score ?? a?.leadScore?.score ?? -1;
      const sb = b?.leadScores?.noProject?.score ?? b?.leadScore?.score ?? -1;
      return (sa - sb);
    }
    // alpha by name / company
    const aName = (a?.customerProfile?.name || a?.companyProfile?.company || '').toLowerCase();
    const bName = (b?.customerProfile?.name || b?.companyProfile?.company || '').toLowerCase();
    return aName.localeCompare(bName);
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
    // Create the base customer first, then open SOP on the profile page to ensure identical UI
    try {
      setIsCreatingCustomer(true);
      const companyName = clientData.company || "Uncategorized Company";
      const payload = {
        customerProfile: {
          name: clientData.name,
          role: clientData.role || '',
          email: clientData.email || '',
          phone: clientData.phone || '',
        },
        companyProfile: {
          company: companyName,
          industry: '',
          location: ''
        },
        reputation: { rating: 0, summary: '' },
        activities: [],
        reminders: [],
        files: [],
        currentStage: STAGES[0],
        stageData: {
          Working: { notes: [], tasks: [], completed: false },
          Qualified: { notes: [], tasks: [], completed: false },
          Converted: { notes: [], tasks: [], completed: false }
        },
        projects: [],
        lastContact: serverTimestamp(),
        createdAt: serverTimestamp(),
        userId: currentUser.uid,
        ownerId: currentUser.uid,
        access: [currentUser.uid]
      };
      const newCustomerDocRef = await addDoc(collection(db, 'customerProfiles'), payload);
      const newCustomerId = newCustomerDocRef.id;

      // Link to organization
      try {
        const organizationsRef = collection(db, 'organizations');
        const qOrg = query(organizationsRef, where('name', '==', companyName), where('userId', '==', currentUser.uid));
        const snap = await getDocs(qOrg);
        const clientToAdd = {
          id: newCustomerId,
          name: clientData.name,
          role: clientData.role || '',
          email: clientData.email || '',
          phone: clientData.phone || '',
          company: companyName
        };
        if (!snap.empty) {
          const target = snap.docs[0];
          const currentClients = target.data().clients || [];
          await updateDoc(doc(db, 'organizations', target.id), { clients: [...currentClients, clientToAdd] });
        } else {
          await addDoc(organizationsRef, { name: companyName, clients: [clientToAdd], collapsed: false, userId: currentUser.uid });
        }
      } catch {}

      // Close modal and navigate to profile with SOP picker open
      setShowAddCustomerModal(false);
      navigate(`/customer/${newCustomerId}?openSop=1`);
    } catch (e) {
      console.error('Error creating customer before SOP:', e);
      alert('Failed to create customer. Please try again.');
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
              {/* Removed settings button from hero panel as requested */}
            </div>
          )}
        </div>

        {/* Filters */}
        {currentUser && (
          <div style={{ 
            display: "flex", 
            gap: "12px", 
            marginBottom: "20px",
            alignItems: "center",
            justifyContent: 'flex-start'
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
                maxWidth: "420px",
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

            {/* Sort control */}
            <div>
              <select value={sortMode} onChange={(e) => setSortMode(e.target.value)} style={{
                padding: '8px 10px',
                border: `2px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                borderRadius: DESIGN_SYSTEM.borderRadius.base,
                background: DESIGN_SYSTEM.colors.background.primary,
                color: DESIGN_SYSTEM.colors.text.primary,
                fontSize: DESIGN_SYSTEM.typography.fontSize.sm
              }}>
                <option value="alpha">Alphabetical</option>
                <option value="score_desc">Score High → Low</option>
                <option value="score_asc">Score Low → High</option>
              </select>
            </div>
            <button
              onClick={() => setShowLeadSettings(true)}
              style={{
                ...getButtonStyle('secondary', 'customers'),
                padding: '6px 10px',
                fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold,
                borderRadius: DESIGN_SYSTEM.borderRadius.base,
                marginLeft: 'auto'
              }}
            >
              Lead Score Settings
            </button>
          </div>
        )}

        {/* Customer Grid */}
        {sortedCustomers.length === 0 && currentUser ? (
          <div style={{
            textAlign: "center",
            padding: "60px 20px",
            color: DESIGN_SYSTEM.colors.text.secondary,
            fontSize: "18px"
          }}>
            {searchTerm ? `No customers found matching "${searchTerm}"` : "No customers yet. Add your first customer!"}
          </div>
        ) : sortedCustomers.length === 0 && !currentUser ? (
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
            {sortedCustomers.map((customer) => {
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
                      {(() => {
                        const name = customer.customerProfile.name || customer.companyProfile.company;
                        const role = customer.customerProfile.role;
                        return role ? `${name} (${role})` : name;
                      })()}
                    </h3>
                    <p style={{
                      margin: 0,
                      color: DESIGN_SYSTEM.colors.text.secondary,
                      fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                      textAlign: 'center'
                    }}>
                      {customer.companyProfile.company || customer.customerProfile.email || customer.companyProfile.industry}
                    </p>
                    <div style={{ marginTop: 6 }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: 9999,
                        border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                        background: '#fff',
                        color: '#111827',
                        fontSize: 12,
                        fontWeight: 700
                      }} title={(customer?.leadScores?.noProject?.band || customer?.leadScore?.band) ? (customer?.leadScores?.noProject?.band || customer.leadScore.band) : 'No score yet'}>
                        {typeof (customer?.leadScores?.noProject?.score ?? customer?.leadScore?.score) === 'number' ? `${(customer.leadScores?.noProject?.score ?? customer.leadScore.score)} (${(customer.leadScores?.noProject?.band ?? customer.leadScore.band) || ''})` : 'Score —'}
                      </span>
                    </div>
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
                        {(() => {
                          try {
                            const ts = customer.lastContact;
                            if (!ts) return 'N/A';
                            const d = ts?.toDate ? ts.toDate() : (typeof ts === 'number' ? new Date(ts) : (typeof ts === 'string' ? new Date(ts) : null));
                            return d ? d.toLocaleDateString() : 'N/A';
                          } catch { return 'N/A'; }
                        })()}
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
      {/* SOP picker removed - now handled in CustomerProfile page */}
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
      {showLeadSettings && leadSettings && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setShowLeadSettings(false)}>
          <div onClick={(e)=>e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 720, maxWidth: '92vw', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>Lead Score Settings</div>
              <button onClick={() => setShowLeadSettings(false)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Close</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Industries dropdown */}
              <div style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#374151', position: 'relative' }}>
                <label style={{ marginBottom: 4 }}>Target industries</label>
                <div onClick={() => setIndustryOpen(v => !v)} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, cursor: 'pointer', background: '#fff' }}>
                  {(leadSettings.fit.targetIndustries || []).length === 0 ? (
                    <div style={{ color: '#9ca3af' }}>Select industries…</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(leadSettings.fit.targetIndustries || []).map(val => (
                        <span key={val} style={{ background: '#eef2ff', color: '#1f2937', padding: '2px 6px', borderRadius: 9999, fontSize: 11 }}>{val}</span>
                      ))}
                    </div>
                  )}
                </div>
                {industryOpen && (
                  <div style={{ position: 'absolute', zIndex: 10, top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, marginTop: 4, maxHeight: 220, overflow: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
                    {['Construction','Manufacturing','Technology','Healthcare','Retail','Real Estate','Education','Finance','Logistics','Hospitality','Energy','Consulting'].map(opt => {
                      const checked = (leadSettings.fit.targetIndustries || []).includes(opt);
                      return (
                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, cursor: 'pointer' }}>
                          <input type="checkbox" checked={checked} onChange={(e) => {
                            setLeadSettings(s => {
                              const cur = new Set(s.fit.targetIndustries || []);
                              if (e.target.checked) cur.add(opt); else cur.delete(opt);
                              return { ...s, fit: { ...s.fit, targetIndustries: Array.from(cur) } };
                            });
                          }} />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Countries dropdown (full name) */}
              <div style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#374151', position: 'relative' }}>
                <label style={{ marginBottom: 4 }}>Target countries</label>
                <div onClick={() => { if (!leadSettings.fit.worldwide) setCountryOpen(v => !v); }} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, cursor: leadSettings.fit.worldwide ? 'not-allowed' : 'pointer', background: leadSettings.fit.worldwide ? '#f3f4f6' : '#fff' }}>
                  {(leadSettings.fit.targetCountries || []).length === 0 ? (
                    <div style={{ color: '#9ca3af' }}>{leadSettings.fit.worldwide ? 'Worldwide enabled' : 'Select countries…'}</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {[
                        { code: 'MY', name: 'Malaysia' },{ code: 'SG', name: 'Singapore' },{ code: 'ID', name: 'Indonesia' },{ code: 'TH', name: 'Thailand' },{ code: 'VN', name: 'Vietnam' },{ code: 'PH', name: 'Philippines' },{ code: 'CN', name: 'China' },{ code: 'HK', name: 'Hong Kong' },{ code: 'TW', name: 'Taiwan' },{ code: 'JP', name: 'Japan' },{ code: 'KR', name: 'South Korea' },{ code: 'IN', name: 'India' },{ code: 'AU', name: 'Australia' },{ code: 'NZ', name: 'New Zealand' },{ code: 'US', name: 'United States' },{ code: 'GB', name: 'United Kingdom' }
                      ].filter(c => (leadSettings.fit.targetCountries || []).includes(c.code)).map(item => (
                        <span key={item.code} style={{ background: '#eef2ff', color: '#1f2937', padding: '2px 6px', borderRadius: 9999, fontSize: 11 }}>{item.name}</span>
                      ))}
                    </div>
                  )}
                </div>
                {countryOpen && !leadSettings.fit.worldwide && (
                  <div style={{ position: 'absolute', zIndex: 10, top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, marginTop: 4, maxHeight: 240, overflow: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
                    {[
                      { code: 'MY', name: 'Malaysia' },{ code: 'SG', name: 'Singapore' },{ code: 'ID', name: 'Indonesia' },{ code: 'TH', name: 'Thailand' },{ code: 'VN', name: 'Vietnam' },{ code: 'PH', name: 'Philippines' },{ code: 'CN', name: 'China' },{ code: 'HK', name: 'Hong Kong' },{ code: 'TW', name: 'Taiwan' },{ code: 'JP', name: 'Japan' },{ code: 'KR', name: 'South Korea' },{ code: 'IN', name: 'India' },{ code: 'AU', name: 'Australia' },{ code: 'NZ', name: 'New Zealand' },{ code: 'US', name: 'United States' },{ code: 'GB', name: 'United Kingdom' }
                    ].map(opt => {
                      const checked = (leadSettings.fit.targetCountries || []).includes(opt.code);
                      return (
                        <label key={opt.code} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, cursor: 'pointer' }}>
                          <input type="checkbox" checked={checked} onChange={(e) => {
                            setLeadSettings(s => {
                              const cur = new Set(s.fit.targetCountries || []);
                              if (e.target.checked) cur.add(opt.code); else cur.delete(opt.code);
                              return { ...s, fit: { ...s.fit, targetCountries: Array.from(cur) } };
                            });
                          }} />
                          <span>{opt.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <label style={{ gridColumn: '1 / span 2', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#374151' }}><input type="checkbox" checked={!!leadSettings.fit.worldwide} onChange={(e)=> setLeadSettings(s => ({ ...s, fit: { ...s.fit, worldwide: e.target.checked } }))} /> Worldwide</label>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#374151' }}>Fit %<input type="number" value={leadSettings.distribution.fitPercent} onChange={(e)=> setLeadSettings(s => ({ ...s, distribution: { ...s.distribution, fitPercent: Number(e.target.value||0), intentPercent: Math.max(0, 100 - Number(e.target.value||0)) } }))} /></label>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#374151' }}>Intent %<input type="number" value={leadSettings.distribution.intentPercent} onChange={(e)=> setLeadSettings(s => ({ ...s, distribution: { ...s.distribution, intentPercent: Number(e.target.value||0), fitPercent: Math.max(0, 100 - Number(e.target.value||0)) } }))} /></label>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#374151' }}>Stage advanced +<input type="number" value={leadSettings.intent.stageAdvancedPoints} onChange={(e)=> setLeadSettings(s => ({ ...s, intent: { ...s.intent, stageAdvancedPoints: Number(e.target.value||0) } }))} /></label>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#374151' }}>Stage cap/day<input type="number" value={leadSettings.intent.stageAdvanceCapPerDay} onChange={(e)=> setLeadSettings(s => ({ ...s, intent: { ...s.intent, stageAdvanceCapPerDay: Number(e.target.value||0) } }))} /></label>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#374151' }}>Task points<input type="number" value={leadSettings.intent.taskCompletedPoints} onChange={(e)=> setLeadSettings(s => ({ ...s, intent: { ...s.intent, taskCompletedPoints: Number(e.target.value||0) } }))} /></label>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#374151' }}>Task cap /14d<input type="number" value={leadSettings.intent.taskCapPer14d} onChange={(e)=> setLeadSettings(s => ({ ...s, intent: { ...s.intent, taskCapPer14d: Number(e.target.value||0) } }))} /></label>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#374151' }}>Quote first +<input type="number" value={leadSettings.intent.quoteCreatedPoints} onChange={(e)=> setLeadSettings(s => ({ ...s, intent: { ...s.intent, quoteCreatedPoints: Number(e.target.value||0) } }))} /></label>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#374151' }}>No reply 7d penalty<input type="number" value={leadSettings.penalties.noReply7d} onChange={(e)=> setLeadSettings(s => ({ ...s, penalties: { ...s.penalties, noReply7d: Number(e.target.value||0) } }))} /></label>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#374151' }}>Stuck penalty<input type="number" value={leadSettings.penalties.stuckPenalty} onChange={(e)=> setLeadSettings(s => ({ ...s, penalties: { ...s.penalties, stuckPenalty: Number(e.target.value||0) } }))} /></label>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#374151' }}>Inactivity penalty<input type="number" value={leadSettings.penalties.inactivityPenalty} onChange={(e)=> setLeadSettings(s => ({ ...s, penalties: { ...s.penalties, inactivityPenalty: Number(e.target.value||0) } }))} /></label>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#374151' }}>Email reply window (h)<input type="number" value={leadSettings.thresholds.emailReplyWindowHours} onChange={(e)=> setLeadSettings(s => ({ ...s, thresholds: { ...s.thresholds, emailReplyWindowHours: Number(e.target.value||0) } }))} /></label>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#374151' }}>Stuck days<input type="number" value={leadSettings.thresholds.stuckDays} onChange={(e)=> setLeadSettings(s => ({ ...s, thresholds: { ...s.thresholds, stuckDays: Number(e.target.value||0) } }))} /></label>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#374151' }}>Quote window days<input type="number" value={leadSettings.thresholds.quoteWindowDays} onChange={(e)=> setLeadSettings(s => ({ ...s, thresholds: { ...s.thresholds, quoteWindowDays: Number(e.target.value||0) } }))} /></label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button onClick={async () => { try { if (!currentUser?.uid) return; const saved = await saveLeadScoringSettings(currentUser.uid, leadSettings); setLeadSettings(saved); setShowLeadSettings(false); } catch {} }} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
