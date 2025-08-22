// src/pages/ProjectList.js
import React, { useState, useEffect } from "react";
import TopBar from "../components/TopBar";
import CreateProjectModal from "../components/project-component/CreateProjectModal";
import { useNavigate } from "react-router-dom";
import { COLORS, BUTTON_STYLES, INPUT_STYLES } from "../components/profile-component/constants";
import { db } from "../firebase";
import { collection, getDocs, addDoc, updateDoc, doc, getDoc } from "firebase/firestore";
import { onSnapshot, query, orderBy, where } from "firebase/firestore"; // Import onSnapshot, query, orderBy
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

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
  const [projects, setProjects] = useState([]);
  const { currentUser } = useAuth(); // Get currentUser from AuthContext

  useEffect(() => {
    if (!currentUser) {
      setProjects([]);
      return;
    }

    const q = query(collection(db, "projects"), orderBy('name', 'asc'), where("userId", "==", currentUser.uid)); // Filter by userId

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProjects(projectList);
    });

    return () => unsubscribe();
  }, [currentUser]); // Add currentUser to dependency array

  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [joinProjectId, setJoinProjectId] = useState(''); // New state for join project ID
  const [joinProjectError, setJoinProjectError] = useState(null); // New state for join project error
  const navigate = useNavigate();

  const getProgress = (project) => {
    let totalTasks = 0;
    let completedTasks = 0;

    if (project.tasks && Array.isArray(project.tasks)) {
      project.tasks.forEach(section => {
        if (section.tasks && Array.isArray(section.tasks)) {
          totalTasks += section.tasks.length;
          completedTasks += section.tasks.filter(task => task.status === 'complete').length;
        }
      });
    }

    if (totalTasks === 0) return 0;
    return Math.round((completedTasks / totalTasks) * 100);
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateProject = async (newProject) => {
    if (!currentUser) return; // Ensure user is logged in to create projects
    await addDoc(collection(db, "projects"), {
      name: newProject.name,
      stage: newProject.stage || "Proposal",
      status: determineProjectStatus(newProject.stage || "Proposal"), // Set status based on stage progress
      team: newProject.team || [],
      tasks: newProject.tasks || 0,
      completedTasks: newProject.completedTasks || 0,
      userId: currentUser.uid, // Assign project to current user
    });
    // setProjects will be handled by the onSnapshot listener, no need to refetch
    setShowCreateModal(false);
  };

  const handleEditProject = (project) => {
    navigate(`/project/${project.id}`);
  };

  const handleJoinProject = async () => {
    if (!joinProjectId.trim() || !currentUser) {
      setJoinProjectError('Please enter a valid Project ID and ensure you are logged in.');
      return;
    }

    setJoinProjectError(null);
    try {
      const projectRef = doc(db, 'projects', joinProjectId);
      const projectSnap = await getDoc(projectRef);

      if (projectSnap.exists()) {
        const projectData = projectSnap.data();
        const currentTeam = projectData.team || [];

        if (currentTeam.includes(currentUser.uid)) {
          setJoinProjectError('You are already a member of this project.');
          return;
        }

        await updateDoc(projectRef, {
          team: [...currentTeam, currentUser.uid]
        });
        alert('Successfully joined project!');
        setJoinProjectId('');
        navigate(`/project/${joinProjectId}`); // Navigate to the joined project
      } else {
        setJoinProjectError('Project not found.');
      }
    } catch (err) {
      console.error("Error joining project:", err);
      setJoinProjectError('Failed to join project: ' + err.message);
    }
  };

  // handleUpdateProject will no longer be needed here as editing happens on ProjectDetail page
  // const handleUpdateProject = async (updatedProject) => {
  //   const projectRef = doc(db, "projects", updatedProject.id);
  //   await updateDoc(projectRef, {
  //     name: updatedProject.name,
  //     stage: updatedProject.stage,
  //     team: updatedProject.team,
  //     tasks: updatedProject.tasks,
  //     completedTasks: updatedProject.completedTasks,
  //   });
  //   setProjects(projects.map(p => 
  //     p.id === updatedProject.id 
  //       ? { ...p, ...updatedProject }
  //       : p
  //   ));
  //   setEditingProject(null);
  //   setShowCreateModal(false);
  // };

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

  const determineProjectStatus = (stage) => {
    return getStageProgress(stage) === 100 ? "Complete" : "Ongoing";
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
          {currentUser && (
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
          )}
        </div>

        {/* Join Project Section */}
        {currentUser && (
          <div style={{ marginBottom: "30px", display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Enter Project ID to join"
              value={joinProjectId}
              onChange={(e) => setJoinProjectId(e.target.value)}
              style={{
                ...INPUT_STYLES.base,
                flex: 1,
                maxWidth: "300px",
                padding: "12px 16px",
                fontSize: "16px",
                borderRadius: "8px",
                border: `2px solid ${COLORS.border}`,
              }}
            />
            <button 
              onClick={handleJoinProject}
              style={{
                ...BUTTON_STYLES.secondary,
                padding: "12px 24px",
                fontSize: "16px",
                fontWeight: "600",
                borderRadius: "8px",
              }}
            >
              Join Project
            </button>
            {joinProjectError && <p style={{ color: COLORS.danger, marginLeft: "10px" }}>{joinProjectError}</p>}
          </div>
        )}

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
        {filteredProjects.length === 0 && currentUser ? (
          <div style={{
            textAlign: "center",
            padding: "60px 20px",
            color: COLORS.lightText,
            fontSize: "18px"
          }}>
            {searchTerm ? `No projects found matching "${searchTerm}"` : "No projects yet. Create your first project or join one!"}
          </div>
        ) : filteredProjects.length === 0 && !currentUser ? (
          <div style={{
            textAlign: "center",
            padding: "60px 20px",
            color: COLORS.danger,
            fontSize: "18px"
          }}>
            Please log in to view and manage projects.
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
                        project.team.map((member) => (
                          <div
                            key={member}
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
                      {project.completedTasks} of {project.tasks?.length || 0} tasks completed
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
        onConfirm={handleCreateProject}
        // Removed editingProject prop as editing is now handled on ProjectDetail page
      />
    </div>
  );
}
