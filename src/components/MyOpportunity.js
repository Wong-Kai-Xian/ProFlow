import React, { useEffect, useState } from "react";

export default function ClientProgress() {
  const [projects, setProjects] = useState([]);
  const [collapsed, setCollapsed] = useState({ ongoing: false, completed: false });

  useEffect(() => {
    // Mock project data
    setProjects([
      { 
        client: "John Smith", 
        project: "Website Redesign", 
        whatsapp: "60123456789", 
        email: "jientan02@gmail.com",
        status: "Ongoing"
      },
      { 
        client: "Sarah Johnson", 
        project: "Mobile App", 
        whatsapp: "60198765432", 
        email: "sarah@gmail.com",
        status: "Completed"
      },
      { 
        client: "Mike Chen", 
        project: "E-commerce Platform", 
        whatsapp: "60111222333", 
        email: "mike@gmail.com",
        status: "Ongoing"
      }
    ]);
  }, []);

  const toggleCollapse = (section) => {
    setCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const openWhatsApp = (project) => {
    const message = encodeURIComponent(`Hello ${project.client}, here is the latest update on ${project.project}.`);
    window.open(`https://wa.me/${project.whatsapp}?text=${message}`, "_blank");
  };

  const openEmailPopup = (project) => {
    const subject = encodeURIComponent(`Project Update: ${project.project}`);
    const body = encodeURIComponent(`Hello ${project.client},\n\nHere is the latest update on ${project.project}...`);
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&to=${project.email}&su=${subject}&body=${body}`,
      "GmailCompose",
      "width=600,height=700,left=200,top=100"
    );
  };

  const renderSection = (status) => {
    const filtered = projects.filter(p => p.status === status);
    return (
      <div style={{ marginBottom: "15px" }}>
        <h4
          style={{ cursor: "pointer", userSelect: "none" }}
          onClick={() => toggleCollapse(status.toLowerCase())}
        >
          {status} ({filtered.length}) {collapsed[status.toLowerCase()] ? "+" : "-"}
        </h4>
        {!collapsed[status.toLowerCase()] && (
          <ul style={{ listStyle: "none", paddingLeft: 0 }}>
            {filtered.map((p, idx) => (
              <li
                key={idx}
                style={{
                  background: status === "Completed" ? "#ECF0F1" : "#fff",
                  margin: "8px 0",
                  padding: "10px",
                  borderRadius: "5px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  opacity: status === "Completed" ? 0.6 : 1
                }}
              >
                <div>
                  <strong>{p.client}</strong>
                  <br />
                  <small>{p.project}</small>
                </div>
                <div>
                  <button 
                    onClick={() => openWhatsApp(p)}
                    style={{ 
                      margin: '2px', 
                      padding: '5px 10px', 
                      background: '#25D366', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    WhatsApp
                  </button>
                  <button 
                    onClick={() => openEmailPopup(p)}
                    style={{ 
                      margin: '2px', 
                      padding: '5px 10px', 
                      background: '#E74C3C', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Email
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div style={{ background: '#F8F9F9', padding: '15px', borderRadius: '10px' }}>
      <h3 style={{ marginTop: 0, color: '#2C3E50' }}>My Opportunity</h3>
      {renderSection("Ongoing")}
      {renderSection("Completed")}
    </div>
  );
}
