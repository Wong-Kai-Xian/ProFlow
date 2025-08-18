import React, { useEffect, useState } from "react";

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [collapseOngoing, setCollapseOngoing] = useState(false);
  const [collapseCompleted, setCollapseCompleted] = useState(false);
  const [filter, setFilter] = useState("deadline"); // default sort

  useEffect(() => {
    setProjects([
      { name: "Website Redesign", status: "Ongoing", deadline: "2025-09-15", notifications: 3 },
      { name: "Mobile App Development", status: "Ongoing", deadline: "2025-08-30", notifications: 1 },
      { name: "E-commerce Platform", status: "Completed", deadline: "2025-07-10", notifications: 0 },
      { name: "Marketing Campaign", status: "Ongoing", deadline: "2025-09-05", notifications: 2 },
      { name: "Social Media Ads", status: "Completed", deadline: "2025-06-20", notifications: 0 }
    ]);
  }, []);

  const sortProjects = (list) => {
    if (filter === "notifications") {
      return [...list].sort((a, b) => b.notifications - a.notifications);
    } else if (filter === "deadline") {
      return [...list].sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    }
    return list;
  };

  const ongoingProjects = sortProjects(projects.filter(p => p.status === "Ongoing"));
  const completedProjects = sortProjects(projects.filter(p => p.status === "Completed"));

  const ProjectCard = ({ project, completed }) => (
    <li style={{ 
      position: "relative",
      background: completed ? '#BDC3C7' : 'white', 
      margin: '10px 0', 
      padding: '10px', 
      borderRadius: '5px',
      display: "flex",
      justifyContent: "space-between",
      flexDirection: "column",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
    }}>
      {project.notifications > 0 && (
        <div style={{
          position: "absolute",
          top: "5px",
          right: "5px",
          fontSize: "12px",
          color: "white",
          background: "#E74C3C",
          borderRadius: "50%",
          width: "20px",
          height: "20px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center"
        }}>
          {project.notifications}
        </div>
      )}
      <div>
        <strong>{project.name}</strong>
        <br />
        <span style={{ fontSize: '12px', color: completed ? '#7F8C8D' : '#27AE60' }}>
          {project.status}
        </span>
      </div>
      <div style={{ textAlign: "right", fontSize: "12px", color: "#555", marginTop: "5px" }}>
        Deadline: {project.deadline}
      </div>
    </li>
  );

  return (
    <div style={{ 
      background: '#F8F9F9', 
      padding: '15px', 
      borderRadius: '10px', 
      display: "flex", 
      flexDirection: "column", 
      height: "100%", 
      overflowY: "auto"
    }}>
      {/* Title + Filter */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <h3 style={{ margin: 0, color: '#2C3E50' }}>Projects</h3>
        <div style={{ display: "flex", gap: "5px" }}>
          <button 
            style={{ ...filterButtonStyle, background: filter === "deadline" ? "#3498DB" : "#E0E0E0", color: filter === "deadline" ? "#fff" : "#000" }}
            onClick={() => setFilter("deadline")}
          >
            Closest Deadline
          </button>
          <button 
            style={{ ...filterButtonStyle, background: filter === "notifications" ? "#3498DB" : "#E0E0E0", color: filter === "notifications" ? "#fff" : "#000" }}
            onClick={() => setFilter("notifications")}
          >
            Most Notifications
          </button>
        </div>
      </div>

      {/* Ongoing Section */}
      <div>
        <div 
          style={{ cursor: "pointer", fontWeight: "bold", marginBottom: "5px" }} 
          onClick={() => setCollapseOngoing(!collapseOngoing)}
        >
          {collapseOngoing ? "▶ Ongoing Projects" : "▼ Ongoing Projects"}
        </div>
        {!collapseOngoing && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {ongoingProjects.map((p, idx) => <ProjectCard key={idx} project={p} completed={false} />)}
          </ul>
        )}
      </div>

      {/* Completed Section */}
      <div style={{ marginTop: "10px" }}>
        <div 
          style={{ cursor: "pointer", fontWeight: "bold", marginBottom: "5px" }} 
          onClick={() => setCollapseCompleted(!collapseCompleted)}
        >
          {collapseCompleted ? "▶ Completed Projects" : "▼ Completed Projects"}
        </div>
        {!collapseCompleted && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {completedProjects.map((p, idx) => <ProjectCard key={idx} project={p} completed={true} />)}
          </ul>
        )}
      </div>
    </div>
  );
}

// Button styles
const filterButtonStyle = {
  padding: "5px 10px",
  border: "none",
  borderRadius: "5px",
  cursor: "pointer",
  fontSize: "12px"
};
