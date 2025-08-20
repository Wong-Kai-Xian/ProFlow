// src/pages/Project.js
import React, { useState } from "react";
import TopBar from "../components/TopBar";
import ConfirmModal from "../components/project-component/ConfirmModal"; // import ConfirmModal

// Get initials from project name
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

export default function Project() {
  const [projects, setProjects] = useState([
    { name: "Website Redesign", status: "In Progress", team: ["Alice", "Bob"], tasks: 12, completedTasks: 8 },
    { name: "Mobile App", status: "Planned", team: ["Charlie", "David"], tasks: 8, completedTasks: 0 },
    { name: "Marketing Campaign", status: "Completed", team: ["Eve", "Frank"], tasks: 15, completedTasks: 15 }
  ]);

  const [newProjectName, setNewProjectName] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const getProgress = (project) =>
    project.tasks === 0 ? 0 : Math.round((project.completedTasks / project.tasks) * 100);

  // Show modal instead of adding directly
  const handleCreateClick = () => {
    if (!newProjectName) return;
    setShowConfirm(true);
  };

  // Called when user confirms in modal
  const handleConfirm = () => {
    const newProj = {
      name: newProjectName,
      status: "Pending Approval",
      team: [],
      tasks: 0,
      completedTasks: 0,
      pending: true
    };
    setProjects([...projects, newProj]);
    setNewProjectName("");   // clear input
    setShowConfirm(false);   // close modal
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  return (
    <div style={{ fontFamily: "Arial, sans-serif" }}>
      <TopBar />

      <div style={{ padding: "20px" }}>
        <h2>Projects</h2>

        {/* Create Project Section */}
        <div style={{ marginBottom: "20px", display: "flex", gap: "10px" }}>
          <input
            type="text"
            placeholder="New Project Name"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            style={{ flex: 1, padding: "8px", fontSize: "14px" }}
          />
          <button
            onClick={handleCreateClick}
            style={{
              padding: "8px 15px",
              backgroundColor: "#28a745",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            Create Project
          </button>
        </div>

        {/* Project Cards */}
        <div
          style={{
            display: "flex",
            overflowX: "auto",
            gap: "15px",
            padding: "10px 0",
            whiteSpace: "nowrap"
          }}
        >
          {projects.map((project) => {
            const bgColor = stringToColor(project.name);
            const isPending = project.status === "Pending Approval";

            return (
              <div
                key={project.name}
                style={{
                  display: "inline-flex",
                  flexDirection: "column",
                  width: "220px",
                  border: "1px solid #ccc",
                  borderRadius: "10px",
                  padding: "10px",
                  backgroundColor: isPending ? "#f0f0f0" : "#fff",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                  opacity: isPending ? 0.6 : 1,
                  cursor: "pointer"
                }}
              >
                {/* Project Logo */}
                <div
                  style={{
                    width: "100%",
                    height: "100px",
                    borderRadius: "8px",
                    backgroundColor: bgColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "36px",
                    color: "#fff",
                    fontWeight: "bold"
                  }}
                >
                  {getInitials(project.name)}
                </div>

                <h3 style={{ margin: "10px 0 5px" }}>{project.name}</h3>

                {/* Team Members */}
                <div style={{ display: "flex", gap: "5px", marginBottom: "10px" }}>
                  {project.team.length > 0 ? (
                    project.team.map((member, index) => (
                      <div
                        key={index}
                        title={member}
                        style={{
                          width: "30px",
                          height: "30px",
                          borderRadius: "50%",
                          backgroundColor: bgColor,
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "14px"
                        }}
                      >
                        {member[0]}
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: "12px", color: "#888" }}>No members assigned</div>
                  )}
                </div>

                {/* Progress Bar */}
                <div style={{ marginBottom: "5px" }}>
                  <div
                    style={{
                      height: "10px",
                      width: "100%",
                      backgroundColor: "#eee",
                      borderRadius: "5px",
                      overflow: "hidden"
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${getProgress(project)}%`,
                        backgroundColor: "#28a745"
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    textAlign: "right",
                    fontSize: "12px",
                    color: isPending ? "#ff8800" : "#555"
                  }}
                >
                  {project.status}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirm && (
        <ConfirmModal
          title="Create Project"
          message={`Are you sure you want to create "${newProjectName}"?`}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
