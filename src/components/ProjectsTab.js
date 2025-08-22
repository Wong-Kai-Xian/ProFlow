// src/pages/ProjectsTab.js
import React, { useEffect, useState } from "react";
import Card from "./profile-component/Card"; // Corrected import path
import { COLORS, LAYOUT, BUTTON_STYLES } from "./profile-component/constants"; // Import constants
import Switch from "./Switch"; // Import Switch component
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import { db } from "../firebase"; // Import db
import { collection, onSnapshot, query, orderBy, where } from "firebase/firestore"; // Import Firestore functions
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

export default function ProjectsTab() {
  const [projects, setProjects] = useState([]);
  const [collapseOngoing, setCollapseOngoing] = useState(false);
  const [collapseCompleted, setCollapseCompleted] = useState(true); // collapsed by default
  const [filter, setFilter] = useState("deadline"); // default sort
  const navigate = useNavigate(); // Initialize useNavigate
  const { currentUser } = useAuth(); // Get currentUser from AuthContext

  useEffect(() => {
    if (!currentUser) {
      setProjects([]);
      return;
    }

    const q = query(collection(db, "projects"), where("userId", "==", currentUser.uid), orderBy('name', 'asc')); // Order by name and filter by userId

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      console.log("ProjectsTab: Projects data received:", projectsData); // Add this line for debugging
      setProjects(projectsData);
    });

    return () => unsubscribe();
  }, [currentUser]); // Add currentUser to dependency array

  const getStageProgress = (stage) => {
    const stageOrder = ['Proposal', 'Negotiation', 'Complete'];
    const currentIndex = stageOrder.indexOf(stage);
    return ((currentIndex + 1) / stageOrder.length) * 100;
  };

  const sortProjects = (list) => {
    if (filter === "notifications") {
      return [...list].sort((a, b) => b.notifications - a.notifications);
    } else if (filter === "deadline") {
      return [...list].sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    }
    return list;
  };

  const ongoingProjects = sortProjects(projects.filter(p => getStageProgress(p.stage) < 100));
  const completedProjects = sortProjects(projects.filter(p => getStageProgress(p.stage) === 100));

  const ProjectCard = ({ project, completed }) => (
    <li key={project.id} style={{ 
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
      <div onClick={() => navigate(`/project/${project.id}`)} style={{ cursor: "pointer" }}>
        <strong>{project.name}</strong>
        <br />
        <span style={{ fontSize: '12px', color: completed ? '#7F8C8D' : '#27AE60' }}>
          {project.stage}
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
      minHeight: 0,
      maxHeight: "100%",
    }}>
      {/* Title + Filter */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: LAYOUT.smallGap }}>
        <h3 style={{ margin: 0, color: COLORS.text, fontSize: "18px" }}>Projects</h3>
        <Switch
          isOn={filter === "notifications"}
          handleToggle={() => setFilter(filter === "deadline" ? "notifications" : "deadline")}
          onColor={COLORS.primary}
          offColor={COLORS.lightText}
          labelText={filter === "deadline" ? "Sort by Deadline" : "Sort by Notifications"}
        />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflowY: "auto" }}>
        {/* Ongoing Section */}
        <div>
          <button 
            style={{ ...BUTTON_STYLES.secondary, width: "100%", justifyContent: "flex-start", textAlign: "left", marginBottom: LAYOUT.smallGap, color: COLORS.text, background: COLORS.light, border: `1px solid ${COLORS.border}` }}
            onClick={() => setCollapseOngoing(!collapseOngoing)}
          >
            {collapseOngoing ? "▶ Ongoing Projects" : "▼ Ongoing Projects"}
          </button>
          {!collapseOngoing && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {ongoingProjects.map((p) => <ProjectCard key={p.id} project={p} completed={getStageProgress(p.stage) === 100} />)}
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
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {completedProjects.map((p) => <ProjectCard key={p.id} project={p} completed={getStageProgress(p.stage) === 100} />)}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
