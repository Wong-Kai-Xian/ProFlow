import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import { COLORS, BUTTON_STYLES, INPUT_STYLES } from "../components/profile-component/constants";
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
const STAGES = ["Proposal", "Working", "Qualified", "Converted"];

// Calculate progress based on current stage and tasks completed within stages
const getProgress = (customer) => {
  const currentStageIndex = STAGES.indexOf(customer.currentStage);
  if (currentStageIndex === -1) return 0; // Should not happen

  let completedStages = 0;
  let totalStages = STAGES.length;
  let stageProgress = 0;

  for (let i = 0; i < STAGES.length; i++) {
    const stageName = STAGES[i];
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
        status: doc.data().status || "Active",
        lastContact: doc.data().lastContact || "N/A",
      }));
      setCustomers(customerList);
    });

    return () => unsubscribe();
  }, [currentUser]); // Add currentUser to dependency array

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const navigate = useNavigate();

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = (
      customer.customerProfile?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.companyProfile?.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.customerProfile?.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const matchesStatus = statusFilter === "All" || customer.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return COLORS.success;
      case 'Proposal': return COLORS.primary;
      case 'Inactive': return COLORS.lightText;
      default: return COLORS.lightText;
    }
  };

  const handleCreateNewCustomerFromModal = async (clientData) => {
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
          "Proposal": { notes: [], tasks: [], completed: false }, // New initial stage
          "Working": { notes: [], tasks: [], completed: false },
          "Qualified": { notes: [], tasks: [], completed: false },
          "Converted": { notes: [], tasks: [], completed: false },
        },
        projects: [],
        status: STAGES[0], // Default status now follows initial stage
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
      navigate(`/customer/${newCustomerDocRef.id}`); // Navigate to the new customer's full profile
    } catch (error) {
      console.error("Error creating new customer from modal: ", error);
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
    <div style={{ fontFamily: "Arial, sans-serif", minHeight: "100vh", backgroundColor: COLORS.background }}>
      <TopBar />

      <div style={{ padding: "30px" }}>
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          marginBottom: "30px" 
        }}>
          <h1 style={{ 
            margin: 0, 
            color: COLORS.dark, 
            fontSize: "28px", 
            fontWeight: "700" 
          }}>
            Customer Profiles
          </h1>
          {currentUser && (
            <button
              onClick={() => setShowAddCustomerModal(true)}
              style={{
                ...BUTTON_STYLES.primary,
                padding: "12px 24px",
                fontSize: "16px",
                fontWeight: "600",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(52, 152, 219, 0.3)",
                transition: "all 0.3s ease"
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 6px 16px rgba(52, 152, 219, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 4px 12px rgba(52, 152, 219, 0.3)";
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
                ...INPUT_STYLES.base,
                width: "100%",
                maxWidth: "400px",
                padding: "12px 16px",
                fontSize: "16px",
                borderRadius: "8px",
                border: `2px solid ${COLORS.border}`,
                transition: "border-color 0.3s ease"
              }}
              onFocus={(e) => {
                e.target.style.borderColor = COLORS.primary;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = COLORS.border;
              }}
            />

            {/* Status Filter */}
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
          </div>
        )}

        {/* Customer Grid */}
        {filteredCustomers.length === 0 && currentUser ? (
          <div style={{
            textAlign: "center",
            padding: "60px 20px",
            color: COLORS.lightText,
            fontSize: "18px"
          }}>
            {searchTerm ? `No customers found matching "${searchTerm}"` : "No customers yet. Add your first customer!"}
          </div>
        ) : filteredCustomers.length === 0 && !currentUser ? (
          <div style={{
            textAlign: "center",
            padding: "60px 20px",
            color: COLORS.danger,
            fontSize: "18px"
          }}>
            Please log in to view and manage customer profiles.
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
            gap: "24px",
            marginBottom: "30px"
          }}>
            {filteredCustomers.map((customer) => {
              const bgColor = stringToColor(customer.customerProfile.name || ""); // Handle potentially undefined name
              const progress = getProgress(customer);
              const currentStageName = customer.currentStage;
              const currentStageColor = getStatusColor(customer.status); // Reusing status color for the stage

              return (
                <div
                  key={customer.id}
                  style={{
                    backgroundColor: COLORS.white,
                    borderRadius: "12px",
                    padding: "24px",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                    border: `1px solid ${COLORS.border}`,
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    position: "relative",
                    overflow: "hidden" // To contain the progress bar animation
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow = "0 8px 25px rgba(0, 0, 0, 0.12)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.08)";
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
                        top: "16px",
                        right: "24px", // Position on the right
                        background: "none",
                        border: "none",
                        color: COLORS.danger,
                        fontSize: "18px",
                        cursor: "pointer",
                        zIndex: 2, // Ensure it's above other elements
                        padding: "5px",
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
                    borderRadius: "12px 12px 0 0",
                    transition: "width 0.5s ease-in-out"
                  }} />

                  {/* Current Stage Indicator */}
                  <div style={{
                    position: "absolute",
                    top: "16px",
                    left: "16px", // Position on the left
                    padding: "4px 10px",
                    borderRadius: "12px",
                    backgroundColor: `${currentStageColor}20`,
                    color: currentStageColor,
                    fontSize: "12px",
                    fontWeight: "600",
                    zIndex: 1 // Ensure it's above the progress bar
                  }}>
                    {currentStageName}
                  </div>

                  {/* Status Badge - moved to top left */}
                  <div style={{
                    position: "absolute",
                    top: "16px",
                    left: "100px", // Position on the left, after the current stage
                    padding: "4px 10px",
                    borderRadius: "12px",
                    backgroundColor: `${getStatusColor(customer.status)}20`,
                    color: getStatusColor(customer.status),
                    fontSize: "12px",
                    fontWeight: "600",
                    zIndex: 1 // Ensure it's above the progress bar
                  }}>
                    {customer.status}
                  </div>

                  {/* Customer Avatar */}
                  <div style={{
                    width: "80px",
                    height: "80px",
                    borderRadius: "50%",
                    backgroundColor: bgColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "32px",
                    color: COLORS.white,
                    fontWeight: "700",
                    marginBottom: "20px",
                    marginTop: "30px" // Adjusted to give space for new elements
                  }}>
                    {getInitials(customer.customerProfile.name || "")}
                  </div>

                  {/* Customer Info */}
                  <h3 style={{ 
                    margin: "0 0 8px 0", 
                    color: COLORS.dark, 
                    fontSize: "20px", 
                    fontWeight: "700",
                    lineHeight: "1.3"
                  }}>
                    {customer.customerProfile.name}
                  </h3>

                  <p style={{
                    margin: "0 0 12px 0",
                    color: COLORS.lightText,
                    fontSize: "16px",
                    fontWeight: "500"
                  }}>
                    {customer.companyProfile.company}
                  </p>

                  <div style={{ marginBottom: "16px" }}>
                    <div style={{
                      fontSize: "14px",
                      color: COLORS.lightText,
                      marginBottom: "4px"
                    }}>
                      📧 {customer.customerProfile.email}
                    </div>
                    <div style={{
                      fontSize: "14px",
                      color: COLORS.lightText,
                      marginBottom: "4px"
                    }}>
                      📞 {customer.customerProfile.phone}
                    </div>
                  </div>

                  {/* Project Stats */}
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    backgroundColor: COLORS.light,
                    borderRadius: "8px",
                    marginTop: "16px"
                  }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{
                        fontSize: "18px",
                        fontWeight: "700",
                        color: COLORS.primary
                      }}>
                        {customer.projects?.length || 0}
                      </div>
                      <div style={{
                        fontSize: "12px",
                        color: COLORS.lightText,
                        fontWeight: "500"
                      }}>
                        Projects
                      </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{
                        fontSize: "14px",
                        fontWeight: "600",
                        color: COLORS.dark
                      }}>
                        Last Contact
                      </div>
                      <div style={{
                        fontSize: "13px",
                        color: COLORS.lightText
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
