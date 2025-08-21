// src/pages/ProjectList.js
import React, { useState } from "react";
import TopBar from "../components/TopBar";
import CreateProjectModal from "../components/project-component/CreateProjectModal";
import { useNavigate } from "react-router-dom";
import { COLORS, BUTTON_STYLES, INPUT_STYLES } from "../components/profile-component/constants";

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

export default function ProjectList() {
  const [projects, setProjects] = useState([
    { id: 1, name: "Website Redesign", stage: "Negotiation", team: ["Alice", "Bob"], tasks: 12, completedTasks: 8 },
    { id: 2, name: "Mobile App", stage: "Proposal", team: ["Charlie", "David"], tasks: 8, completedTasks: 0 },
    { id: 3, name: "Marketing Campaign", stage: "Complete", team: ["Eve", "Frank"], tasks: 15, completedTasks: 15 }
  ]);

  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const navigate = useNavigate();

  const getProgress = (project) =>
    project.tasks === 0 ? 0 : Math.round((project.completedTasks / project.tasks) * 100);

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateProject = (newProject) => {
    const projectWithId = {
      ...newProject,
      id: Date.now(), // Simple ID generation
      stage: newProject.stage || "Proposal"
    };
    setProjects([...projects, projectWithId]);
    setShowCreateModal(false);
  };

  const handleEditProject = (project) => {
    setEditingProject(project);
    setShowCreateModal(true);
  };

  const handleUpdateProject = (updatedProject) => {
    setProjects(projects.map(p => 
      p.id === editingProject.id 
        ? { ...editingProject, ...updatedProject }
        : p
    ));
    setEditingProject(null);
    setShowCreateModal(false);
  };

  const getStageColor = (stage) => {
    switch (stage) {
      case 'Proposal': return '#9B59B6'; // Purple
      case 'Negotiation': return '#3498DB'; // Blue
      case 'Complete': return '#27AE60'; // Green
      default: return COLORS.lightText;
    }
  };

  const getStageProgress = (stage) => {
    const stageOrder = ['Proposal', 'Negotiation', 'Complete'];
    const currentIndex = stageOrder.indexOf(stage);
    return ((currentIndex + 1) / stageOrder.length) * 100;
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
            Projects
          </h1>
          <button
            onClick={() => setShowCreateModal(true)}
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
            Create Project
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: "30px" }}>
          <input
            type="text"
            placeholder="Search projects..."
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
        </div>

        {/* Project Grid */}
        {filteredProjects.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "60px 20px",
            color: COLORS.lightText,
            fontSize: "18px"
          }}>
            {searchTerm ? `No projects found matching "${searchTerm}"` : "No projects yet. Create your first project!"}
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "24px",
            marginBottom: "30px"
          }}>
            {filteredProjects.map((project) => {
              const bgColor = stringToColor(project.name);
              const progress = getProgress(project);

              return (
                <div
                  key={project.id}
                  style={{
                    backgroundColor: COLORS.white,
                    borderRadius: "12px",
                    padding: "24px",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                    border: `1px solid ${COLORS.border}`,
                    transition: "all 0.3s ease",
                    cursor: "pointer",
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
                  onClick={() => navigate(`/project/${project.id}`)}
                >
                  {/* Edit Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditProject(project);
                    }}
                    style={{
                      position: "absolute",
                      top: "16px",
                      right: "16px",
                      background: COLORS.light,
                      border: "none",
                      borderRadius: "6px",
                      padding: "6px 8px",
                      cursor: "pointer",
                      fontSize: "12px",
                      color: COLORS.dark,
                      transition: "all 0.2s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = COLORS.primary;
                      e.target.style.color = COLORS.white;
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = COLORS.light;
                      e.target.style.color = COLORS.dark;
                    }}
                  >
                    Edit
                  </button>

                  {/* Project Logo */}
                  <div style={{
                    width: "80px",
                    height: "80px",
                    borderRadius: "12px",
                    backgroundColor: bgColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "32px",
                    color: COLORS.white,
                    fontWeight: "700",
                    marginBottom: "20px"
                  }}>
                    {getInitials(project.name)}
                  </div>

                  <h3 style={{ 
                    margin: "0 0 8px 0", 
                    color: COLORS.dark, 
                    fontSize: "20px", 
                    fontWeight: "700",
                    lineHeight: "1.3"
                  }}>
                    {project.name}
                  </h3>

                  {/* Stage Badge */}
                  <div style={{
                    display: "inline-block",
                    padding: "6px 14px",
                    borderRadius: "20px",
                    backgroundColor: `${getStageColor(project.stage)}20`,
                    color: getStageColor(project.stage),
                    fontSize: "13px",
                    fontWeight: "600",
                    marginBottom: "16px",
                    border: `1px solid ${getStageColor(project.stage)}40`
                  }}>
                    {project.stage}
                  </div>

                  {/* Team Members */}
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ 
                      fontSize: "14px", 
                      fontWeight: "600", 
                      color: COLORS.dark, 
                      marginBottom: "8px" 
                    }}>
                      Team ({project.team.length})
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {project.team.length > 0 ? (
                        project.team.map((member, index) => (
                          <div
                            key={index}
                            title={member}
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "50%",
                              backgroundColor: bgColor,
                              color: COLORS.white,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "14px",
                              fontWeight: "600"
                            }}
                          >
                            {member[0].toUpperCase()}
                          </div>
                        ))
                      ) : (
                        <div style={{ 
                          fontSize: "14px", 
                          color: COLORS.lightText,
                          fontStyle: "italic"
                        }}>
                          No team members assigned
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stage Progress */}
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center",
                      marginBottom: "8px"
                    }}>
                      <span style={{ 
                        fontSize: "14px", 
                        fontWeight: "600", 
                        color: COLORS.dark 
                      }}>
                        Stage Progress
                      </span>
                      <span style={{ 
                        fontSize: "14px", 
                        fontWeight: "600", 
                        color: getStageColor(project.stage)
                      }}>
                        {Math.round(getStageProgress(project.stage))}%
                      </span>
                    </div>
                    <div style={{
                      height: "8px",
                      width: "100%",
                      backgroundColor: COLORS.light,
                      borderRadius: "4px",
                      overflow: "hidden"
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${getStageProgress(project.stage)}%`,
                        backgroundColor: getStageColor(project.stage),
                        borderRadius: "4px",
                        transition: "width 0.3s ease"
                      }} />
                    </div>
                  </div>

                  {/* Task Progress */}
                  <div>
                    <div style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center",
                      marginBottom: "8px"
                    }}>
                      <span style={{ 
                        fontSize: "14px", 
                        fontWeight: "600", 
                        color: COLORS.dark 
                      }}>
                        Tasks
                      </span>
                      <span style={{ 
                        fontSize: "14px", 
                        fontWeight: "600", 
                        color: COLORS.primary 
                      }}>
                        {progress}%
                      </span>
                    </div>
                    <div style={{
                      height: "6px",
                      width: "100%",
                      backgroundColor: COLORS.light,
                      borderRadius: "3px",
                      overflow: "hidden"
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${progress}%`,
                        backgroundColor: COLORS.primary,
                        borderRadius: "3px",
                        transition: "width 0.3s ease"
                      }} />
                    </div>
                    <div style={{
                      fontSize: "12px",
                      color: COLORS.lightText,
                      marginTop: "6px"
                    }}>
                      {project.completedTasks} of {project.tasks} tasks completed
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Project Modal */}
      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingProject(null);
        }}
        onConfirm={editingProject ? handleUpdateProject : handleCreateProject}
        editingProject={editingProject}
      />
    </div>
  );
}
