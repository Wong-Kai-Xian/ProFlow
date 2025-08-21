import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import { COLORS, BUTTON_STYLES, INPUT_STYLES } from "../components/profile-component/constants";
import customerDataArray from "../components/profile-component/customerData.js";

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
  const [customers, setCustomers] = useState(customerDataArray.map(customer => ({
    id: customer.id,
    name: customer.customerProfile.name,
    company: customer.companyProfile.company,
    email: customer.customerProfile.email,
    phone: customer.customerProfile.phone,
    status: customer.status || "Active", // Default to "Active" if not specified
    projects: customer.projects ? customer.projects.length : 0, // Use length of projects array
    lastContact: customer.lastContact || "N/A", // Default to "N/A" if not specified
    currentStage: customer.currentStage || "Working",
    stageData: customer.stageData || {} // Default to empty object if not specified
  })));

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const navigate = useNavigate();

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "All" || customer.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return COLORS.success;
      case 'Inactive': return COLORS.lightText;
      default: return COLORS.lightText;
    }
  };

  const handleCustomerClick = (customer) => {
    navigate(`/customer/${customer.id}`);
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
          <button
            onClick={() => navigate('/customer/new')}
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
        </div>

        {/* Filters */}
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

        {/* Customer Grid */}
        {filteredCustomers.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "60px 20px",
            color: COLORS.lightText,
            fontSize: "18px"
          }}>
            {searchTerm ? `No customers found matching "${searchTerm}"` : "No customers yet. Add your first customer!"}
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
            gap: "24px",
            marginBottom: "30px"
          }}>
            {filteredCustomers.map((customer) => {
              const bgColor = stringToColor(customer.name);
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
                    left: "24px",
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

                  {/* Status Badge - moved to top right */}
                  <div style={{
                    position: "absolute",
                    top: "16px",
                    right: "16px",
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
                    {getInitials(customer.name)}
                  </div>

                  {/* Customer Info */}
                  <h3 style={{ 
                    margin: "0 0 8px 0", 
                    color: COLORS.dark, 
                    fontSize: "20px", 
                    fontWeight: "700",
                    lineHeight: "1.3"
                  }}>
                    {customer.name}
                  </h3>

                  <p style={{
                    margin: "0 0 12px 0",
                    color: COLORS.lightText,
                    fontSize: "16px",
                    fontWeight: "500"
                  }}>
                    {customer.company}
                  </p>

                  <div style={{ marginBottom: "16px" }}>
                    <div style={{
                      fontSize: "14px",
                      color: COLORS.lightText,
                      marginBottom: "4px"
                    }}>
                      📧 {customer.email}
                    </div>
                    <div style={{
                      fontSize: "14px",
                      color: COLORS.lightText,
                      marginBottom: "4px"
                    }}>
                      📞 {customer.phone}
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
                        {customer.projects}
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
                        {new Date(customer.lastContact).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
