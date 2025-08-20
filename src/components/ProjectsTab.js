// src/pages/ProjectsTab.js
import React, { useEffect, useState } from "react";
import Card from "./profile-component/Card"; // Corrected import path
import { COLORS, LAYOUT, BUTTON_STYLES } from "./profile-component/constants"; // Import constants
import Switch from "./Switch"; // Import Switch component

export default function ProjectsTab() {
  const [projects, setProjects] = useState([]);
  const [collapseOngoing, setCollapseOngoing] = useState(false);
  const [collapseCompleted, setCollapseCompleted] = useState(true); // collapsed by default
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
    <Card style={{
      height: "100%",
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      minHeight: 0, // Crucial for flex items
    }}>
      {/* Title + Filter */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: LAYOUT.smallGap }}>
        <h3 style={{ margin: 0, color: COLORS.text }}>Projects</h3>
        <Switch
          isOn={filter === "notifications"}
          handleToggle={() => setFilter(filter === "deadline" ? "notifications" : "deadline")}
          onColor={COLORS.primary}
          offColor={COLORS.lightText}
          labelText={filter === "deadline" ? "Sort by Deadline" : "Sort by Notifications"}
        />
      </div>

      {/* Ongoing Section */}
      <div>
        <button 
          style={{ ...BUTTON_STYLES.secondary, width: "100%", justifyContent: "flex-start", textAlign: "left", marginBottom: LAYOUT.smallGap, color: COLORS.text, background: COLORS.light, border: `1px solid ${COLORS.border}` }}
          onClick={() => setCollapseOngoing(!collapseOngoing)}
        >
          {collapseOngoing ? "▶ Ongoing Projects" : "▼ Ongoing Projects"}
        </button>
        {!collapseOngoing && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: "200px", overflowY: "auto", flexGrow: 1 }}>
            {ongoingProjects.map((p, idx) => <ProjectCard key={idx} project={p} completed={false} />)}
          </ul>
        )}
      </div>

      {/* Completed Section */}
      <div style={{ marginTop: LAYOUT.gap }}>
        <button 
          style={{ ...BUTTON_STYLES.secondary, width: "100%", justifyContent: "flex-start", textAlign: "left", marginBottom: LAYOUT.smallGap, color: COLORS.text, background: COLORS.light, border: `1px solid ${COLORS.border}` }}
          onClick={() => setCollapseCompleted(!collapseCompleted)}
        >
          {collapseCompleted ? "▶ Completed Projects" : "▼ Completed Projects"}
        </button>
        {!collapseCompleted && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: "200px", overflowY: "auto", flexGrow: 1 }}>
            {completedProjects.map((p, idx) => <ProjectCard key={idx} project={p} completed={true} />)}
          </ul>
        )}
      </div>
    </Card>
  );
}
