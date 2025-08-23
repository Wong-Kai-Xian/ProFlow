import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import { DESIGN_SYSTEM, getPageContainerStyle, getCardStyle, getContentContainerStyle, getButtonStyle } from '../styles/designSystem';
// import customerDataArray from "../components/profile-component/customerData.js"; // Remove mock data import
import { db } from "../firebase"; // Import db
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, query, where, getDocs, serverTimestamp } from "firebase/firestore"; // Import Firestore functions
import AddProfileModal from "../components/profile-component/AddProfileModal"; // Import AddProfileModal
import { useAuth } from '../contexts/AuthContext'; // Import useAuth
import { FaTrash } from 'react-icons/fa'; // Import FaTrash icon
import DeleteProfileModal from '../components/profile-component/DeleteProfileModal'; // Import DeleteProfileModal

// Get initials from customer name
const getInitials = (name) =>
  name
    .split(" ")
    .map((w) => w[0].toUpperCase())
    .join("");

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
  const [customers, setCustomers] = useState([]); // Initialize with empty array
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false); // New state for modal
  const [showDeleteCustomerModal, setShowDeleteCustomerModal] = useState(false); // State for delete confirmation modal
  const [customerToDelete, setCustomerToDelete] = useState(null); // State to hold the customer to be deleted
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false); // Loading state for customer creation
  const { currentUser } = useAuth(); // Get currentUser from AuthContext

  useEffect(() => {
    if (!currentUser) {
      setCustomers([]);
      return;
    }

    const customerProfilesCollectionRef = collection(db, "customerProfiles");
    const userCustomerProfilesQuery = query(customerProfilesCollectionRef, where("userId", "==", currentUser.uid));

    const unsubscribe = onSnapshot(userCustomerProfilesQuery, (snapshot) => {
      const customerList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Ensure nested objects are handled and default values are set
        customerProfile: doc.data().customerProfile || {},
        companyProfile: doc.data().companyProfile || {},
        reputation: doc.data().reputation || {},
        activities: doc.data().activities || [],
        reminders: doc.data().reminders || [],
        files: doc.data().files || [],
        stageData: doc.data().stageData || {},
        projects: doc.data().projects || [], // Ensure projects is an array
        lastContact: doc.data().lastContact || "N/A",
        stages: doc.data().stages || STAGES, // Ensure stages are loaded
      }));
      setCustomers(customerList);
    });

    return () => unsubscribe();
  }, [currentUser]); // Add currentUser to dependency array

  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = (
      customer.customerProfile?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.companyProfile?.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.customerProfile?.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return matchesSearch;
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
        userId: currentUser.uid, // Associate customer profile with the current user
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
      // 1. Delete the customer profile document
      await deleteDoc(doc(db, "customerProfiles", customerToDelete.id));
      console.log("Customer profile deleted with ID:", customerToDelete.id);

      // 2. Remove the reference from the associated organization's clients array
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
              const bgColor = stringToColor(customer.customerProfile.name || ""); // Handle potentially undefined name
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
                      {getInitials(customer.customerProfile.name || customer.companyProfile.company || "N/A")}
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
    </div>
  );
}
