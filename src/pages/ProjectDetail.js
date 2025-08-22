import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import TopBar from '../components/TopBar';
import ProjectDetails from '../components/project-component/ProjectDetails'; // Import ProjectDetails
import Reminders from '../components/project-component/Reminders'; // Import Reminders
import ProjectTaskPanel from '../components/project-component/ProjectTaskPanel'; // Import ProjectTaskPanel
import ProjectGroupForum from '../components/ProjectGroupForum'; // Use ProjectGroupForum
import { COLORS, LAYOUT, STAGES, INPUT_STYLES, BUTTON_STYLES } from '../components/profile-component/constants';
import StageIndicator from '../components/project-component/StageIndicator'; // Import StageIndicator
import ApprovalModal from '../components/project-component/ApprovalModal'; // Import ApprovalModal
import SendApprovalModal from '../components/project-component/SendApprovalModal'; // Import SendApprovalModal
import AddTeamMemberModal from '../components/project-component/AddTeamMemberModal'; // Import AddTeamMemberModal
import TeamMembersPanel from '../components/project-component/TeamMembersPanel'; // Import TeamMembersPanel
import { db } from "../firebase";
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot, getDocs } from "firebase/firestore"; // Import collection, query, where, onSnapshot
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

export default function ProjectDetail() {
  const { projectId } = useParams(); // Changed from projectName to projectId
  const [projectData, setProjectData] = useState(null);
  const [currentStage, setCurrentStage] = useState(STAGES[0]);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showSendApprovalModal, setShowSendApprovalModal] = useState(false);
  const [projectForums, setProjectForums] = useState([]); // State to hold project-specific forums
  const { currentUser } = useAuth(); // Get current user from AuthContext
  const [currentApproval, setCurrentApproval] = useState(null); // State to hold the current approval request
  const [showAddTeamMemberModal, setShowAddTeamMemberModal] = useState(false); // New state for add team member modal
  const [allProjectNames, setAllProjectNames] = useState([]); // New state to store all project names
  const [projectTeamMembersDetails, setProjectTeamMembersDetails] = useState([]); // State for enriched team member details

  useEffect(() => {
    const fetchProject = async () => {
      console.log("Fetching project with projectId:", projectId); // Added console.log
      if (projectId) {
        const docRef = doc(db, "projects", projectId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() };
          setProjectData(data);
          setCurrentStage(data.stage || STAGES[0]);
        } else {
          console.log("No such project document!");
          setProjectData(null);
        }
      }
    };

    fetchProject();
  }, [projectId]);

  // Fetch project-specific forums in real-time
  useEffect(() => {
    if (projectId && currentUser) {
      const forumsCollectionRef = collection(db, "forums");
      // Fetch forums where projectId matches AND currentUser.uid is in the members array
      const q = query(forumsCollectionRef, where("projectId", "==", projectId), where("members", "array-contains", currentUser.uid));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const forumsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProjectForums(forumsData);
      });

      return () => unsubscribe();
    }
  }, [projectId, currentUser]);

  // Fetch all project names for the dropdown in ProjectDetails
  useEffect(() => {
    if (!currentUser) {
      setAllProjectNames([]);
      return;
    }
    const projectsRef = collection(db, "projects");
    const q = query(projectsRef, where("userId", "==", currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const names = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
      setAllProjectNames(names);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Effect to fetch team member details
  useEffect(() => {
    const fetchProjectTeamMembersDetails = async () => {
      if (!projectData?.team || projectData.team.length === 0) {
        setProjectTeamMembersDetails([]);
        return;
      }

      try {
        const memberUids = projectData.team;
        const fetchedDetails = [];
        const chunkSize = 10; // Firestore 'in' query limit

        for (let i = 0; i < memberUids.length; i += chunkSize) {
          const chunk = memberUids.slice(i, i + chunkSize);
          const usersQuery = query(collection(db, "users"), where("uid", "in", chunk));
          const usersSnapshot = await getDocs(usersQuery);
          usersSnapshot.forEach(doc => {
            const userData = doc.data();
            fetchedDetails.push({
              uid: doc.id,
              name: userData.name || userData.email || 'Team Member',
              email: userData.email || 'No email provided',
            });
          });
        }
        setProjectTeamMembersDetails(fetchedDetails);
      } catch (error) {
        console.error("Error fetching project team member details:", error);
        setProjectTeamMembersDetails([]);
      }
    };

    fetchProjectTeamMembersDetails();
  }, [projectData?.team]); // Re-run when projectData.team changes

  // Fetch approval requests for the current project and stage in real-time
  useEffect(() => {
    if (projectId && currentStage) {
      const approvalsCollectionRef = collection(db, "approvalRequests");
      const q = query(
        approvalsCollectionRef,
        where("projectId", "==", projectId),
        where("status", "==", "pending") // Only interested in pending approvals for the current stage
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const pendingApprovals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Assuming only one pending approval at a time for simplicity of stage advancement
        setCurrentApproval(pendingApprovals.length > 0 ? pendingApprovals[0] : null);
      });

      return () => unsubscribe();
    }
  }, [projectId, currentStage]);

  useEffect(() => {
    if (projectData) {
    // Filter tasks based on the current stage
    const filteredTasks = (projectData.tasks || []).filter(section => section.stage === currentStage);
    setProjectTasks(filteredTasks);
      setProjectReminders(projectData.reminders || []);
      setProjectDetails(projectData); // This will be the main projectData from Firestore
    }
  }, [projectData, currentStage]);

  // Initialize states with projectData or empty arrays if projectData is null
  const [projectTasks, setProjectTasks] = useState([]);
  const [projectReminders, setProjectReminders] = useState([]);
  const [projectDetails, setProjectDetails] = useState(null);

  const handleAdvanceStage = async () => {
    const currentStageIndex = STAGES.indexOf(currentStage);
    if (currentStageIndex < STAGES.length - 1) {
      const allTasksCompleteInCurrentStage = projectTasks.every(section => 
        section.tasks.every(task => task.status === 'complete')
      );

      if (allTasksCompleteInCurrentStage) {
        // Check if approval is required for the next stage (e.g., if current stage is 'Review')
        // For simplicity, let's assume approval is always required to advance to the next stage after 'Development'
        const nextStage = STAGES[currentStageIndex + 1];
        const isApprovalRequired = nextStage === "Review" || nextStage === "Completion"; // Example: require approval for Review and Completion stages

        if (isApprovalRequired) {
          if (currentApproval && currentApproval.status === 'pending') {
            alert("Cannot advance stage. Awaiting admin approval.");
            return;
          } else if (currentApproval && currentApproval.status === 'rejected') {
            alert("Cannot advance stage. Previous approval request was rejected. Please resubmit.");
            return;
          } else if (!currentApproval) {
            alert("Approval required to advance to the next stage. Please send an approval request.");
            return;
          }
        }
        setShowApprovalModal(true);
      } else {
        alert("All tasks in the current stage must be marked as 'Complete' before advancing.");
      }
    }
  };

  const handleConfirmAdvanceStage = async () => {
    const currentStageIndex = STAGES.indexOf(currentStage);
    const nextStage = STAGES[currentStageIndex + 1];
    if (projectData && projectData.id) {
      const projectRef = doc(db, "projects", projectData.id);
      await updateDoc(projectRef, { stage: nextStage });
      setCurrentStage(nextStage);
    setShowApprovalModal(false);
      // alert(`Advancing to next stage: ${nextStage}`);
    }
  };

  const handleStageSelect = async (stage) => {
    if (projectData && projectData.id) {
      const projectRef = doc(db, "projects", projectData.id);
      await updateDoc(projectRef, { stage: stage });
    setCurrentStage(stage);
    }
  };

  const handleGoBackStage = async () => {
    const currentStageIndex = STAGES.indexOf(currentStage);
    if (currentStageIndex > 0) {
      const prevStage = STAGES[currentStageIndex - 1];
      if (projectData && projectData.id) {
        const projectRef = doc(db, "projects", projectData.id);
        await updateDoc(projectRef, { stage: prevStage });
        setCurrentStage(prevStage);
      }
    }
  };

  const isCurrentStageTasksComplete = projectTasks.every(section => 
    section.tasks.every(task => task.status === 'complete')
  );

  // Determine if the 'Advance Stage' button should be enabled
  const canAdvanceStage = 
    isCurrentStageTasksComplete && 
    STAGES.indexOf(currentStage) < STAGES.length - 1 &&
    (!currentApproval || currentApproval.status === 'approved'); // Only if there is no pending approval or it's approved

  const handleSaveEditedProjectDetails = async (updatedDetails) => {
    if (projectData && projectData.id) {
      const projectRef = doc(db, "projects", projectData.id);
      // Ensure that only fields expected by Firestore are passed
      const { id, ...dataToUpdate } = updatedDetails; // Exclude 'id' if it's already part of the doc reference
      await updateDoc(projectRef, dataToUpdate);
      setProjectData(prevData => ({ ...prevData, ...updatedDetails })); // Update local state with merged data
    }
  };

  const handleTeamMemberAdded = (newMemberUid) => {
    setProjectData(prevProjectData => {
      if (prevProjectData && !prevProjectData.team.includes(newMemberUid)) {
        return { ...prevProjectData, team: [...prevProjectData.team, newMemberUid] };
      }
      return prevProjectData; // No change if prevProjectData is null or member already exists
    });
  };

  const handleRemoveTeamMember = async (memberUid) => {
    if (!projectData || !currentUser || !projectData.id || projectData.userId !== currentUser.uid) {
      alert("You don't have permission to remove team members from this project.");
      return;
    }

    if (window.confirm(`Are you sure you want to remove this member?`)) {
      try {
        const projectRef = doc(db, "projects", projectData.id);
        await updateDoc(projectRef, {
          team: projectData.team.filter(uid => uid !== memberUid)
        });
        setProjectData(prevData => ({ 
          ...prevData, 
          team: prevData.team.filter(uid => uid !== memberUid) 
        }));
        alert("Team member removed successfully!");
      } catch (error) {
        console.error("Error removing team member:", error);
        alert("Failed to remove team member.");
      }
    }
  };

  if (!projectData) {
    return <div style={{ textAlign: "center", padding: "50px", color: COLORS.lightText }}>Loading project details...</div>; // Loading state
  }

  return (
    <div style={{ fontFamily: "Arial, sans-serif", background: COLORS.background, minHeight: "100vh" }}>
      <TopBar />
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 3fr", // Left column narrower, right column wider
        gridTemplateRows: "1fr", // Single row
        gap: LAYOUT.gap,
        padding: LAYOUT.gap,
        minHeight: "90vh",
      }}>
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: LAYOUT.gap, gridColumn: 1, gridRow: 1 }}>
          {/* Project Details Card with Edit button */}
          <ProjectDetails 
            project={projectDetails} 
            onSave={handleSaveEditedProjectDetails}
            allProjectNames={allProjectNames} // Pass all project names
            readOnly={false} // Explicitly set to editable mode
          />
          <div style={{ flexGrow: 0 }}>
            <Reminders projectId={projectId} /> 
          </div>
          <div style={{ flexGrow: 2, minHeight: "200px" }}>
            <ProjectGroupForum 
              projectId={projectId} 
              forums={projectForums} // Pass project-specific forums to GroupForum
            />
          </div>
          <div style={{ flexGrow: 1, minHeight: "200px" }}>
            <TeamMembersPanel 
              projectId={projectId}
              teamMembers={projectData.team}
              onAddMemberClick={() => setShowAddTeamMemberModal(true)}
              onRemoveMember={handleRemoveTeamMember}
              projectCreatorId={projectData.userId}
              currentUserUid={currentUser?.uid}
              currentUser={currentUser}
            />
          </div>
        </div>

        {/* Right Column (spanning middle and right) */}
        <div style={{ display: "flex", flexDirection: "column", gap: LAYOUT.gap, gridColumn: 2, gridRow: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <h4 style={{ margin: "0", color: COLORS.text }}>Project Stages</h4>
            <button
              onClick={() => setShowSendApprovalModal(true)}
              style={{
                ...BUTTON_STYLES.primary,
                padding: "8px 16px",
                fontSize: "14px",
              }}
            >
              Send Approval
            </button>
          </div>
          <StageIndicator 
            currentStage={currentStage} 
            allStages={STAGES} 
            onAdvanceStage={handleAdvanceStage} 
            onGoBackStage={handleGoBackStage} 
            isCurrentStageTasksComplete={isCurrentStageTasksComplete}
            onStageSelect={handleStageSelect} // New prop for direct stage selection
            canAdvance={canAdvanceStage} // Pass the new prop
          />
          {/* Removed redundant team member buttons - they're already in the left panel */}
          <ProjectTaskPanel 
            projectTasks={projectTasks}
            setProjectTasks={setProjectTasks}
            currentStage={currentStage} 
            projectId={projectId}
            setProjectData={setProjectData} // Pass setProjectData down
          />
        </div>
      </div>
      {showApprovalModal && (
        <ApprovalModal
          isOpen={showApprovalModal}
          onClose={() => setShowApprovalModal(false)}
          onConfirm={handleConfirmAdvanceStage}
        />
      )}
      <SendApprovalModal
        isOpen={showSendApprovalModal}
        onClose={() => setShowSendApprovalModal(false)}
        onSendApproval={(data) => console.log("Approval data sent:", data)}
        defaultProject={projectDetails} // Pass current project details
        defaultStatus={currentStage} // Pass current stage as default status
        currentUser={currentUser} // Pass currentUser to the modal
        teamMembers={projectTeamMembersDetails} // Pass enriched team members details
      />
      {/* Add Team Member Modal */}
      <AddTeamMemberModal
        isOpen={showAddTeamMemberModal}
        onClose={() => setShowAddTeamMemberModal(false)}
        projectId={projectId}
        onTeamMemberAdded={handleTeamMemberAdded}
      />
    </div>
  );
}
