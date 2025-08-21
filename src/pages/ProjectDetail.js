import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import TopBar from '../components/TopBar';
import ProjectDetails from '../components/project-component/ProjectDetails'; // Import ProjectDetails
import Reminders from '../components/project-component/Reminders'; // Import Reminders
import ProjectTaskPanel from '../components/project-component/ProjectTaskPanel'; // Import ProjectTaskPanel
import GroupForum from '../components/GroupForum';
import { COLORS, LAYOUT, STAGES, INPUT_STYLES, BUTTON_STYLES } from '../components/profile-component/constants';
import StageIndicator from '../components/project-component/StageIndicator'; // Import StageIndicator
import ApprovalModal from '../components/project-component/ApprovalModal'; // Import ApprovalModal
import SendApprovalModal from '../components/project-component/SendApprovalModal'; // Import SendApprovalModal


export default function ProjectDetail() {
  const { projectName } = useParams();
  const [currentStage, setCurrentStage] = useState(STAGES[0]); // New state for current project stage
  const [showApprovalModal, setShowApprovalModal] = useState(false); // New state for approval modal
  const [showSendApprovalModal, setShowSendApprovalModal] = useState(false); // New state for SendApprovalModal


  // Mock data for now - will need to fetch actual project data later
  const mockProjectData = {
    "Website Redesign": {
      id: "website-redesign",
      companyInfo: { name: "Acme Corp", industry: "Tech", contact: "Jane Doe" },
      reminders: [{ id: 1, text: "Follow up with Jane Doe on design", timestamp: "2024-03-09, 10:00 AM" }], // Changed from events to reminders
      description: "A comprehensive redesign of the company website to improve user experience and visual appeal.", // New description field
      tasks: [
        {
          subtitle: "Phase 1: Planning",
          stage: "Proposal", // Assign stage to subtitle/section
          tasks: [
            { id: 1, name: "Define Scope", assignedTo: "Alice", priority: "High", deadline: "2024-03-05", comment: "" , done: true, status: "complete"},
            { id: 2, name: "Client Kick-off", assignedTo: "Bob", priority: "High", deadline: "2024-03-08", comment: "Prepare agenda", done: false, status: "working on" },
          ],
        },
        {
          subtitle: "Phase 2: Design",
          stage: "Negotiation", // Assign stage to subtitle/section
          tasks: [
            { id: 3, name: "Create Wireframes", assignedTo: "Charlie", priority: "Medium", deadline: "2024-03-15", comment: "Use Figma", done: false, status: "stuck" },
            { id: 4, name: "Design Mockups", assignedTo: "Alice", priority: "High", deadline: "2024-03-20", comment: "Get client approval", done: false, status: "working on" },
          ],
        },
      ],
      forums: [{ title: "Website Design Feedback", posts: 5, lastActivity: "1 hour ago", notifications: 2 }],
    },
    "Mobile App Development": {
      id: "mobile-app-development",
      companyInfo: { name: "Beta Ltd", industry: "Software", contact: "John Smith" },
      reminders: [{ id: 2, text: "Review backend API docs", timestamp: "2024-03-14, 02:00 PM" }], // Changed from events to reminders
      description: "Development of a new mobile application for iOS and Android platforms.", // New description field
      tasks: [
        {
          subtitle: "Sprint 1",
          stage: "Negotiation", // Assign stage to subtitle/section
          tasks: [
            { id: 5, name: "Set up Backend", assignedTo: "David", priority: "High", deadline: "2024-03-10", comment: "Node.js", done: false, status: "working on" },
            { id: 6, name: "Implement User Auth", assignedTo: "Eve", priority: "High", deadline: "2024-03-18", comment: "OAuth 2.0", done: false, status: "working on" },
          ],
        },
      ],
      forums: [{ title: "Mobile App Bug Reports", posts: 10, lastActivity: "30 mins ago", notifications: 5 }],
    },
    "Marketing Campaign": {
      id: "marketing-campaign",
      companyInfo: { name: "Marketing Pro", industry: "Marketing", contact: "Sarah Lee" },
      reminders: [{ id: 3, text: "Prepare Q2 marketing report", timestamp: "2024-03-18, 09:00 AM" }], // Changed from events to reminders
      description: "Planning and execution of a new digital marketing campaign.", // New description field
      tasks: [
        {
          subtitle: "Campaign Setup",
          stage: "Proposal", // Assign stage to subtitle/section
          tasks: [
            { id: 7, name: "Audience Research", assignedTo: "Frank", priority: "Medium", deadline: "2024-03-07", comment: "Identify target demographics", done: false, status: "working on" },
            { id: 8, name: "Ad Copywriting", assignedTo: "Grace", priority: "High", deadline: "2024-03-12", comment: "" , done: false, status: "stuck"},
          ],
        },
      ],
      forums: [{ title: "Campaign Performance Discussion", posts: 8, lastActivity: "1 day ago", notifications: 1 }],
    },
  };

  const projectData = React.useMemo(() => mockProjectData[projectName] || {}, [projectName]);

  const [projectTasks, setProjectTasks] = useState([]); // Initialize empty, will filter in useEffect
  const [projectReminders, setProjectReminders] = useState(projectData.reminders || []); // Changed from projectEvents to projectReminders
  const [projectForums, setProjectForums] = useState(projectData.forums || []);
  const [projectDetails, setProjectDetails] = useState(projectData);

  useEffect(() => {
    // Filter tasks based on the current stage
    const filteredTasks = (projectData.tasks || []).filter(section => section.stage === currentStage);
    setProjectTasks(filteredTasks);
    setProjectReminders(projectData.reminders || []); // Changed from setProjectEvents to setProjectReminders
    setProjectForums(projectData.forums || []);
    setProjectDetails(projectData); // Update project details when project or stage changes
  }, [projectName, projectData, currentStage]); // Add currentStage to dependencies

  const handleAdvanceStage = () => {
    const currentStageIndex = STAGES.indexOf(currentStage);
    if (currentStageIndex < STAGES.length - 1) {
      const allTasksCompleteInCurrentStage = projectTasks.every(section => 
        section.tasks.every(task => task.status === 'complete')
      );
      if (allTasksCompleteInCurrentStage) {
        setShowApprovalModal(true); // Open approval modal
      } else {
        alert("All tasks in the current stage must be marked as 'Complete' before advancing.");
      }
    }
  };

  const handleConfirmAdvanceStage = () => {
    const currentStageIndex = STAGES.indexOf(currentStage);
    setCurrentStage(STAGES[currentStageIndex + 1]);
    setShowApprovalModal(false);
    alert(`Advancing to next stage: ${STAGES[currentStageIndex + 1]}`); // Optional: confirm advance
  };

  const handleStageSelect = (stage) => {
    setCurrentStage(stage);
  };

  const handleGoBackStage = () => {
    const currentStageIndex = STAGES.indexOf(currentStage);
    if (currentStageIndex > 0) {
      setCurrentStage(STAGES[currentStageIndex - 1]);
    }
  };

  const isCurrentStageTasksComplete = projectTasks.every(section => 
    section.tasks.every(task => task.status === 'complete')
  );

  const handleSaveEditedProjectDetails = (updatedProject) => {
    mockProjectData[projectName] = { ...mockProjectData[projectName], ...updatedProject };
    setProjectDetails(updatedProject);
    alert("Project details saved!");
  };



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
          <ProjectDetails 
            project={projectDetails} 
            onSave={handleSaveEditedProjectDetails}
          />
          <div style={{ flexGrow: 2 }}>
            <Reminders reminders={projectReminders} setReminders={setProjectReminders} /> 
          </div>
          <div style={{ flexGrow: 1 }}>
            <GroupForum 
              forumsData={projectForums} 
              projectName={projectName} 
              onForumsUpdate={setProjectForums}
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
          />
          <ProjectTaskPanel 
            projectTasks={projectTasks}
            setProjectTasks={setProjectTasks}
            currentStage={currentStage} 
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
      />
    </div>
  );
}
