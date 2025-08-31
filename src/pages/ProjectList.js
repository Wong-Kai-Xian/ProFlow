// src/pages/ProjectList.js
import React, { useState, useEffect } from "react";
import TopBar from "../components/TopBar";
import CreateProjectModal from "../components/project-component/CreateProjectModal";
import JoinProjectModal from "../components/project-component/JoinProjectModal";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { collection, getDocs, addDoc, updateDoc, doc, getDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { onSnapshot, query, orderBy, where } from "firebase/firestore";
import { useAuth } from '../contexts/AuthContext';
import { FaTrash } from 'react-icons/fa';
import { DESIGN_SYSTEM, getPageContainerStyle, getCardStyle, getContentContainerStyle, getButtonStyle } from '../styles/designSystem';
import DeleteConfirmationModal from '../components/common/DeleteConfirmationModal'; // Import the new modal

// Get initials from project name
const getInitials = (name) => {
  if (!name || typeof name !== 'string') return 'NA';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'NA';
  return parts.map((w) => (w && w[0] ? w[0].toUpperCase() : '')).join('') || 'NA';
};

// Generate a consistent color based on string
const stringToColor = (str) => {
  const input = typeof str === 'string' && str.length > 0 ? str : 'Project';
  let hash = 0;
  for (let i = 0; i < input.length; i++) hash = input.charCodeAt(i) + ((hash << 5) - hash);
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

    // Get projects where user is either the creator OR a team member
    const projectsRef = collection(db, "projects");
    
    // Query 1: Projects created by the user (legacy field)
    const createdProjectsQuery = query(projectsRef, where("userId", "==", currentUser.uid));
    
    // Query 2: Projects created by the user (new field)
    const createdByProjectsQuery = query(projectsRef, where("createdBy", "==", currentUser.uid));
    
    // Query 3: Projects where user is a team member
    const teamProjectsQuery = query(projectsRef, where("team", "array-contains", currentUser.uid));
    
    let allProjects = new Map(); // Use Map to avoid duplicates
    
    const updateProjectsList = async () => {
      const baseList = Array.from(allProjects.values());
      // Enrich with teamDetails (names/emails) for avatars
      const enriched = await Promise.all(baseList.map(async (p) => {
        const team = p.team || [];
        if (team.length === 0) return { ...p, teamDetails: [] };
        try {
          const chunkSize = 10;
          let details = [];
          for (let i = 0; i < team.length; i += chunkSize) {
            const chunk = team.slice(i, i + chunkSize);
            const usersRef = collection(db, 'users');
            const qUsers = query(usersRef, where('uid', 'in', chunk));
            const snap = await getDocs(qUsers);
            snap.forEach(docSnap => {
              const d = docSnap.data();
              details.push({ uid: docSnap.id, name: d.name || d.email || 'User', email: d.email || '' });
            });
          }
          return { ...p, teamDetails: details };
        } catch (e) {
          console.warn('Failed to load team details', e);
          return { ...p, teamDetails: [] };
        }
      }));
      enriched.sort((a, b) => a.name.localeCompare(b.name));
      setProjects(enriched);
    };
    
    const unsubscribeCreated = onSnapshot(createdProjectsQuery, (snapshot) => {
      // Handle document changes properly
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          allProjects.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
        } else if (change.type === 'removed') {
          allProjects.delete(change.doc.id);
        }
      });
      updateProjectsList();
    });
    
    const unsubscribeCreatedBy = onSnapshot(createdByProjectsQuery, (snapshot) => {
      // Handle document changes properly
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          allProjects.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
        } else if (change.type === 'removed') {
          allProjects.delete(change.doc.id);
        }
      });
      updateProjectsList();
    });
    
    const unsubscribeTeam = onSnapshot(teamProjectsQuery, (snapshot) => {
      // Handle document changes properly
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          allProjects.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
        } else if (change.type === 'removed') {
          allProjects.delete(change.doc.id);
        }
      });
      updateProjectsList();
    });

    return () => {
      unsubscribeCreated();
      unsubscribeCreatedBy();
      unsubscribeTeam();
    };
  }, [currentUser]); // Add currentUser to dependency array

  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [joinProjectError, setJoinProjectError] = useState(null); // New state for join project error
  const [showEditProjectModal, setShowEditProjectModal] = useState(false); // State for edit modal
  const [projectToEdit, setProjectToEdit] = useState(null); // State to hold project being edited
  const [showDeleteConfirmationModal, setShowDeleteConfirmationModal] = useState(false); // State for delete confirmation modal
  const [projectToDelete, setProjectToDelete] = useState(null); // State to hold the project to be deleted
  const [isDeleting, setIsDeleting] = useState(false); // Add loading state for deletion
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

  const filteredProjects = projects.filter((project) => {
    const name = project?.name || '';
    const term = (searchTerm || '').toLowerCase();
    return name.toLowerCase().includes(term);
  });

  const handleCreateProject = async (newProject) => {
    if (!currentUser) return; // Ensure user is logged in to create projects
    const ref = await addDoc(collection(db, "projects"), {
      name: newProject.name,
      stage: "Planning",
      status: determineProjectStatus("Planning"), // Set status based on stage
      team: newProject.team || [],
      tasks: newProject.tasks || [], // Initialize tasks as an empty array
      completedTasks: newProject.completedTasks || 0,
      userId: currentUser.uid, // Assign project to current user
      createdBy: currentUser.uid, // normalized creator field
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      description: newProject.description || '', // Include description
      allowJoinById: newProject.allowJoinById !== undefined ? newProject.allowJoinById : true, // Include allowJoinById
      deadline: newProject.deadline || null,
      // Customer/company fields for ProjectDetails sync
      company: newProject.company || newProject.companyName || '',
      contactEmail: newProject.contactEmail || newProject.customerEmail || '',
      customerName: newProject.customerName || '',
      companyInfo: {
        companyName: (newProject.company || newProject.companyName || ''),
        customerEmail: (newProject.contactEmail || newProject.customerEmail || ''),
        customerName: (newProject.customerName || '')
      }
    });
    try {
      // open SOP picker on the newly created project
      navigate(`/project/${ref.id}?openSop=1`);
    } catch {}
    setShowCreateModal(false);
  };

  const handleEditProject = (project) => {
    setProjectToEdit(project);
    setShowCreateModal(true); // Open the CreateProjectModal for editing
  };

  const handleDeleteProject = async (projectId) => {
    if (!currentUser) return; // Ensure user is logged in
    
    // Open the confirmation modal instead of using window.confirm
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setProjectToDelete(project);
      setShowDeleteConfirmationModal(true);
    }
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete || !currentUser || isDeleting) return; // Ensure project is selected and user is logged in

    setIsDeleting(true);
    try {
      // Delete related forums first
      const forumsQuery = query(
        collection(db, "forums"), 
        where("linkedProjectId", "==", projectToDelete.id)
      );
      const forumsSnapshot = await getDocs(forumsQuery);
      
      // Delete forums and their posts
      const forumDeletionPromises = forumsSnapshot.docs.map(async (forumDoc) => {
        const forumId = forumDoc.id;
        
        // Delete all posts in this forum
        const postsQuery = collection(db, "forums", forumId, "posts");
        const postsSnapshot = await getDocs(postsQuery);
        const postDeletionPromises = postsSnapshot.docs.map(postDoc => 
          deleteDoc(postDoc.ref)
        );
        await Promise.all(postDeletionPromises);
        
        // Delete the forum
        await deleteDoc(forumDoc.ref);
      });
      
      await Promise.all(forumDeletionPromises);
      
      // Delete the project
      await deleteDoc(doc(db, "projects", projectToDelete.id));
      console.log("Project and related data deleted with ID:", projectToDelete.id);
      
      // The onSnapshot listener will handle updating the projects state
      setShowDeleteConfirmationModal(false); // Close the modal
      setProjectToDelete(null); // Clear the project to delete
    } catch (error) {
      console.error("Error deleting project:", error);
      alert("Failed to delete project. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };
  
  const handleJoinProject = async (projectId) => {
    if (!projectId || !currentUser) {
      setJoinProjectError('Please enter a valid Project ID and ensure you are logged in.');
      return;
    }

    setJoinProjectError(null);
    try {
      const projectRef = doc(db, 'projects', projectId);
      const projectSnap = await getDoc(projectRef);

      if (projectSnap.exists()) {
        const projectData = projectSnap.data();
        const currentTeam = projectData.team || [];

        // Check if joining by ID is allowed for this project
        if (projectData.allowJoinById === false) {
          setJoinProjectError('This project cannot be joined by ID.');
          return;
        }

        if (currentTeam.includes(currentUser.uid)) {
          setJoinProjectError('You are already a member of this project.');
          return;
        }

        await updateDoc(projectRef, {
          team: [...currentTeam, currentUser.uid]
        });
        alert('Successfully joined project!');
        setShowJoinModal(false);
        navigate(`/project/${projectId}`); // Navigate to the joined project
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

  const handleUpdateProjectFromModal = async (updatedProject) => {
    try {
      const projectRef = doc(db, "projects", updatedProject.id);
      await updateDoc(projectRef, {
        name: updatedProject.name,
        description: updatedProject.description,
        team: updatedProject.team,
        // Stage is controlled by workflow; do not change here
        allowJoinById: updatedProject.allowJoinById,
        deadline: updatedProject.deadline || null,
        // Keep customer/company info in sync
        company: updatedProject.company || updatedProject.companyName || updatedProject.companyInfo?.companyName || '',
        contactEmail: updatedProject.contactEmail || updatedProject.customerEmail || updatedProject.companyInfo?.customerEmail || '',
        customerName: updatedProject.customerName || updatedProject.companyInfo?.customerName || '',
        companyInfo: {
          companyName: (updatedProject.company || updatedProject.companyName || updatedProject.companyInfo?.companyName || ''),
          customerEmail: (updatedProject.contactEmail || updatedProject.customerEmail || updatedProject.companyInfo?.customerEmail || ''),
          customerName: (updatedProject.customerName || updatedProject.companyInfo?.customerName || '')
        }
      });
      // The onSnapshot listener will handle updating the projects state
      setShowCreateModal(false); // Close CreateProjectModal
      setProjectToEdit(null);
    } catch (error) {
      console.error("Error updating project:", error);
      alert("Failed to update project.");
    }
  };

  const getStageColor = (stage) => {
    switch (stage) {
      case 'Proposal': return '#9B59B6'; // Purple
      case 'Negotiation': return '#3498DB'; // Blue
      case 'Complete': return '#27AE60'; // Green
      default: return DESIGN_SYSTEM.colors.text.secondary;
    }
  };

  const DEFAULT_STAGE_ORDER = ['Planning', 'Development', 'Testing', 'Completed'];
  const getStageProgressForProject = (project) => {
    try {
      const stageOrder = Array.isArray(project.stages) && project.stages.length > 0
        ? project.stages
        : DEFAULT_STAGE_ORDER;
      const currentStageName = project.stage || stageOrder[0];
      const currentIndex = Math.max(0, stageOrder.indexOf(currentStageName));
      const denom = Math.max(1, stageOrder.length);
      return ((currentIndex + 1) / denom) * 100;
    } catch {
      return 0;
    }
  };

  const determineProjectStatus = (stage, project) => {
    const progress = getStageProgressForProject(project || { stage });
    return Math.round(progress) === 100 ? "Complete" : "Ongoing";
  };

  return (
    <div style={getPageContainerStyle()}>
      <TopBar />

      <div style={{
        ...getContentContainerStyle(),
        paddingTop: DESIGN_SYSTEM.spacing['2xl']
      }}>
        {/* Enhanced Projects Header */}
        <div style={{
          background: DESIGN_SYSTEM.pageThemes.projects.gradient,
          borderRadius: DESIGN_SYSTEM.borderRadius.xl,
          padding: DESIGN_SYSTEM.spacing.xl,
          marginBottom: DESIGN_SYSTEM.spacing.lg,
          boxShadow: DESIGN_SYSTEM.shadows.lg,
          color: DESIGN_SYSTEM.colors.text.inverse
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div>
              <h1 style={{
                margin: `0 0 ${DESIGN_SYSTEM.spacing.xs} 0`,
                fontSize: DESIGN_SYSTEM.typography.fontSize['3xl'],
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.bold
              }}>
                Projects
              </h1>
              <p style={{
                margin: 0,
                fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
                opacity: 0.9
              }}>
                Create, manage, and collaborate on your projects • {filteredProjects.length} projects available
              </p>
            </div>
            {currentUser && (
              <div style={{ display: "flex", gap: DESIGN_SYSTEM.spacing.base }}>
                <button
                  onClick={() => setShowJoinModal(true)}
                  style={{
                    ...getButtonStyle('secondary', 'projects'),
                    backgroundColor: "rgba(255, 255, 255, 0.15)",
                    backdropFilter: "blur(10px)",
                    border: "1px solid rgba(255, 255, 255, 0.3)",
                    padding: `${DESIGN_SYSTEM.spacing.base} ${DESIGN_SYSTEM.spacing.lg}`,
                    fontSize: DESIGN_SYSTEM.typography.fontSize.base,
                    fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold,
                    borderRadius: DESIGN_SYSTEM.borderRadius.lg,
                    color: DESIGN_SYSTEM.colors.text.inverse
                  }}
                >
                  Join Project
                </button>
                <button
                  onClick={() => setShowCreateModal(true)}
                  style={{
                    ...getButtonStyle('primary', 'projects'),
                    backgroundColor: "rgba(255, 255, 255, 0.2)",
                    backdropFilter: "blur(10px)",
                    border: "1px solid rgba(255, 255, 255, 0.3)",
                    padding: `${DESIGN_SYSTEM.spacing.base} ${DESIGN_SYSTEM.spacing.lg}`,
                    fontSize: DESIGN_SYSTEM.typography.fontSize.base,
                    fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold,
                    borderRadius: DESIGN_SYSTEM.borderRadius.lg,
                    color: DESIGN_SYSTEM.colors.text.inverse,
                    boxShadow: "0 4px 15px rgba(255, 255, 255, 0.2)"
                  }}
                >
                  Create Project
                </button>
              </div>
            )}
          </div>
        </div>



        {/* Search Bar */}
        <div style={{ marginBottom: "30px" }}>
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              fontFamily: DESIGN_SYSTEM.typography.fontFamily.primary,
              width: "100%",
              maxWidth: "400px",
              padding: `${DESIGN_SYSTEM.spacing.base} ${DESIGN_SYSTEM.spacing.base}`,
              fontSize: DESIGN_SYSTEM.typography.fontSize.base,
              borderRadius: DESIGN_SYSTEM.borderRadius.base,
              border: `2px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
              backgroundColor: DESIGN_SYSTEM.colors.background.primary,
              color: DESIGN_SYSTEM.colors.text.primary,
              transition: "border-color 0.3s ease"
            }}
            onFocus={(e) => {
              e.target.style.borderColor = DESIGN_SYSTEM.colors.primary[500];
            }}
            onBlur={(e) => {
              e.target.style.borderColor = DESIGN_SYSTEM.colors.secondary[300];
            }}
          />
        </div>

        {/* Project Grid */}
        {filteredProjects.length === 0 && currentUser ? (
          <div style={{
            textAlign: "center",
            padding: "60px 20px",
            color: DESIGN_SYSTEM.colors.text.secondary,
            fontSize: "18px"
          }}>
            {searchTerm ? `No projects found matching "${searchTerm}"` : "No projects yet. Create your first project or join one!"}
          </div>
        ) : filteredProjects.length === 0 && !currentUser ? (
          <div style={{
            textAlign: "center",
            padding: "60px 20px",
            color: DESIGN_SYSTEM.colors.error,
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
              const displayName = project?.name || 'Project';
              const bgColor = stringToColor(displayName);
              const progress = getProgress(project);
              const stageProgress = getStageProgressForProject(project);

              return (
                <div
                  key={project.id}
                  style={{
                    backgroundColor: DESIGN_SYSTEM.colors.background.primary,
                    borderRadius: "12px",
                    padding: "24px",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                    border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
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
                      right: "16px", // Keep Edit button on the right
                      background: DESIGN_SYSTEM.colors.background.secondary,
                      border: "none",
                      borderRadius: "6px",
                      padding: "6px 8px",
                      cursor: "pointer",
                      fontSize: "12px",
                      color: DESIGN_SYSTEM.colors.text.primary,
                      transition: "all 0.2s ease",
                      zIndex: 1
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = DESIGN_SYSTEM.colors.primary[500];
                      e.target.style.color = DESIGN_SYSTEM.colors.text.inverse;
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = DESIGN_SYSTEM.colors.background.secondary;
                      e.target.style.color = DESIGN_SYSTEM.colors.text.primary;
                    }}
                  >
                    Edit
                  </button>

                  {/* Delete Button */}
                  {currentUser && currentUser.uid === project.userId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project.id);
                      }}
                      style={{
                        position: "absolute",
                        top: "16px",
                        right: "60px", // Position Delete button next to Edit
                        background: DESIGN_SYSTEM.colors.error,
                        border: "none",
                        borderRadius: "6px",
                        padding: "6px 8px",
                        cursor: "pointer",
                        fontSize: "12px",
                        color: DESIGN_SYSTEM.colors.text.inverse,
                        transition: "all 0.2s ease",
                        zIndex: 1
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = "#c0392b";
                        e.target.style.transform = "scale(1.05)";
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = DESIGN_SYSTEM.colors.error;
                        e.target.style.transform = "scale(1)";
                      }}
                    >
                      <FaTrash />
                    </button>
                  )}

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
                    color: DESIGN_SYSTEM.colors.text.inverse,
                    fontWeight: "700",
                    marginBottom: "20px"
                  }}>
                    {getInitials(displayName)}
                  </div>

                  <h3 style={{ 
                    margin: "0 0 4px 0", 
                    color: DESIGN_SYSTEM.colors.text.primary, 
                    fontSize: "20px", 
                    fontWeight: "700",
                    lineHeight: "1.3"
                  }}>
                    {project.name}
                  </h3>
                  <div style={{
                    margin: "0 0 12px 0",
                    color: DESIGN_SYSTEM.colors.text.secondary,
                    fontSize: "12px"
                  }}>
                    {(() => {
                      try {
                        const ts = project.createdAt;
                        if (!ts) return 'Created: N/A';
                        const d = ts?.toDate ? ts.toDate() : (typeof ts === 'number' ? new Date(ts) : (typeof ts === 'string' ? new Date(ts) : null));
                        return d ? `Created: ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Created: N/A';
                      } catch {
                        return 'Created: N/A';
                      }
                    })()}
                  </div>

                  {/* Stage + Deadline Badges */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                  <div style={{
                    display: "inline-block",
                    padding: "6px 14px",
                    borderRadius: "20px",
                    backgroundColor: `${getStageColor(project.stage)}20`,
                    color: getStageColor(project.stage),
                    fontSize: "13px",
                    fontWeight: "600",
                    border: `1px solid ${getStageColor(project.stage)}40`
                  }}>
                    {project.stage}
                    </div>
                    <div style={{
                      display: "inline-block",
                      padding: "6px 14px",
                      borderRadius: "20px",
                      backgroundColor: `rgba(107,114,128,0.15)`,
                      color: `#4B5563`,
                      fontSize: "13px",
                      fontWeight: "600",
                      border: `1px solid rgba(107,114,128,0.3)`
                    }}>
                      {project.deadline ? `Deadline: ${project.deadline}` : 'No deadline'}
                    </div>
                  </div>

                  {/* Team Members */}
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ 
                      fontSize: "14px", 
                      fontWeight: "600", 
                      color: DESIGN_SYSTEM.colors.text.primary, 
                      marginBottom: "8px" 
                    }}>
                      Team ({project.team.length})
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {project.teamDetails && project.teamDetails.length > 0 ? (
                        project.teamDetails.map((member) => (
                          <div key={member.uid} title={member.name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "50%",
                                backgroundColor: stringToColor(member.name || member.email || 'U'),
                              color: DESIGN_SYSTEM.colors.text.inverse,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "14px",
                              fontWeight: "600"
                            }}
                          >
                              {(member.name || member.email || 'U')[0].toUpperCase()}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ 
                          fontSize: "14px", 
                          color: DESIGN_SYSTEM.colors.text.secondary,
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
                        color: DESIGN_SYSTEM.colors.text.primary 
                      }}>
                        Stage Progress
                      </span>
                      <span style={{ fontSize: "14px", fontWeight: "600", color: getStageColor(project.stage) }}>
                        {Math.round(stageProgress)}%
                      </span>
                    </div>
                    <div style={{
                      height: "8px",
                      width: "100%",
                      backgroundColor: DESIGN_SYSTEM.colors.background.secondary,
                      borderRadius: "4px",
                      overflow: "hidden"
                    }}>
                      <div style={{ height: "100%", width: `${stageProgress}%`, backgroundColor: getStageColor(project.stage), borderRadius: "4px", transition: "width 0.3s ease" }} />
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
                        color: DESIGN_SYSTEM.colors.text.primary 
                      }}>
                        Tasks
                      </span>
                      <span style={{ 
                        fontSize: "14px", 
                        fontWeight: "600", 
                        color: DESIGN_SYSTEM.colors.primary[500] 
                      }}>
                        {progress}%
                      </span>
                    </div>
                    <div style={{
                      height: "6px",
                      width: "100%",
                      backgroundColor: DESIGN_SYSTEM.colors.background.secondary,
                      borderRadius: "3px",
                      overflow: "hidden"
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${progress}%`,
                        backgroundColor: DESIGN_SYSTEM.colors.primary[500],
                        borderRadius: "3px",
                        transition: "width 0.3s ease"
                      }} />
                    </div>
                    <div style={{
                      fontSize: "12px",
                      color: DESIGN_SYSTEM.colors.text.secondary,
                      marginTop: "6px"
                    }}>
                      {project.completedTasks} of {project.tasks?.length || 0} tasks completed
                    </div>
                  </div>

                  {/* Project ID */}
                  <div style={{ marginBottom: DESIGN_SYSTEM.spacing.sm, marginTop: DESIGN_SYSTEM.spacing.lg }}> {/* Increased margin top again */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(project.id).then(() => {
                          const tooltip = document.createElement('div');
                          tooltip.textContent = 'Project ID Copied!';
                          tooltip.style.cssText = `
                            position: fixed;
                            background: ${DESIGN_SYSTEM.colors.success};
                            color: white;
                            padding: 8px 12px;
                            border-radius: 6px;
                            font-size: 12px;
                            font-weight: 500;
                            z-index: 9999;
                            top: ${e.clientY - 50}px;
                            left: ${e.clientX - 50}px;
                            pointer-events: none;
                            box-shadow: 0 4px 12px ${DESIGN_SYSTEM.colors.success}40;
                          `;
                          document.body.appendChild(tooltip);
                          setTimeout(() => document.body.removeChild(tooltip), 2000);
                        }).catch(() => {
                          alert('Failed to copy Project ID');
                        });
                      }}
                      style={{
                        fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                        color: DESIGN_SYSTEM.colors.success,
                        wordBreak: "break-all",
                        cursor: "pointer",
                        padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.sm}`,
                        borderRadius: DESIGN_SYSTEM.borderRadius.sm,
                        border: `1px solid ${DESIGN_SYSTEM.colors.success}30`,
                        backgroundColor: `${DESIGN_SYSTEM.colors.success}10`,
                        transition: "all 0.2s ease",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = `${DESIGN_SYSTEM.colors.success}20`;
                        e.target.style.borderColor = `${DESIGN_SYSTEM.colors.success}50`;
                        e.target.style.transform = "translateY(-1px)";
                        e.target.style.boxShadow = `0 4px 12px ${DESIGN_SYSTEM.colors.success}20`;
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = `${DESIGN_SYSTEM.colors.success}10`;
                        e.target.style.borderColor = `${DESIGN_SYSTEM.colors.success}30`;
                        e.target.style.transform = "translateY(0)";
                        e.target.style.boxShadow = "none";
                      }}
                    >
                      <span style={{ fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold }}>Click to copy Project ID</span>
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
          setProjectToEdit(null); // Clear project to edit when closing
        }}
        onConfirm={projectToEdit ? handleUpdateProjectFromModal : handleCreateProject}
        editingProject={projectToEdit} // Pass the project to edit
      />

      {/* Join Project Modal */}
      <JoinProjectModal
        isOpen={showJoinModal}
        onClose={() => {
          setShowJoinModal(false);
          setJoinProjectError(null);
        }}
        onJoin={handleJoinProject}
        joinProjectError={joinProjectError}
      />
      {/* Removed EditProjectDetailsModal as CreateProjectModal is now used for both */}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteConfirmationModal}
        onClose={() => {
          setShowDeleteConfirmationModal(false);
          setProjectToDelete(null);
        }}
        onConfirm={confirmDeleteProject}
        itemName={projectToDelete?.name || ''}
        itemType="project"
        isLoading={isDeleting}
      />
    </div>
  );
}
