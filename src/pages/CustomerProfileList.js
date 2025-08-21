import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import { COLORS, BUTTON_STYLES, INPUT_STYLES } from "../components/profile-component/constants";

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

export default function CustomerProfileList() {
  const [customers, setCustomers] = useState([
    {
      id: 1,
      name: "John Smith",
      company: "Tech Solutions Inc",
      email: "john.smith@techsolutions.com",
      phone: "+1 (555) 123-4567",
      status: "Active",
      projects: 3,
      lastContact: "2024-01-20"
    },
    {
      id: 2,
      name: "Sarah Johnson",
      company: "Digital Marketing Pro",
      email: "sarah.j@digitalmarketing.com",
      phone: "+1 (555) 234-5678",
      status: "Active",
      projects: 1,
      lastContact: "2024-01-18"
    },
    {
      id: 3,
      name: "Michael Chen",
      company: "Innovation Labs",
      email: "m.chen@innovationlabs.com",
      phone: "+1 (555) 345-6789",
      status: "Inactive",
      projects: 2,
      lastContact: "2024-01-15"
    },
    {
      id: 4,
      name: "Emily Davis",
      company: "Creative Studios",
      email: "emily.davis@creativestudios.com",
      phone: "+1 (555) 456-7890",
      status: "Active",
      projects: 4,
      lastContact: "2024-01-22"
    },
    {
      id: 5,
      name: "David Wilson",
      company: "Global Enterprises",
      email: "d.wilson@globalent.com",
      phone: "+1 (555) 567-8901",
      status: "Active",
      projects: 2,
      lastContact: "2024-01-19"
    }
  ]);

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
                    position: "relative"
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
                  {/* Status Badge */}
                  <div style={{
                    position: "absolute",
                    top: "16px",
                    right: "16px",
                    padding: "4px 10px",
                    borderRadius: "12px",
                    backgroundColor: `${getStatusColor(customer.status)}20`,
                    color: getStatusColor(customer.status),
                    fontSize: "12px",
                    fontWeight: "600"
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
                    marginBottom: "20px"
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
