import React, { useState } from "react";
import { useParams } from "react-router-dom";
import TopBar from "../components/TopBar";
import CustomerInfo from "../components/profile-component/CustomerInfo";
import CompanyInfo from "../components/profile-component/CompanyInfo";
import CompanyReputation from "../components/profile-component/CompanyReputation";
import StatusPanel from "../components/profile-component/StatusPanel";
import ActivityRecord from "../components/profile-component/ActivityRecord";
import Reminders from "../components/profile-component/Reminders";
import AttachedFiles from "../components/profile-component/AttachedFiles";
import TaskManager from "../components/profile-component/TaskManager";
import customerData from "../components/profile-component/customerData.json";
import { STAGES, COLORS, LAYOUT } from "../components/profile-component/constants";

export default function CustomerProfile() {
  const { id } = useParams();
  
  // Initialize state with data from JSON
  const [activities, setActivities] = useState([
    { type: "Gmail", time: "2025-01-20 10:00", description: "Sent introduction email" },
    { type: "Call", time: "2025-01-20 14:00", description: "Initial consultation call completed" },
    ...customerData.activities
  ]);
  
  const [reminders, setReminders] = useState(
    customerData.reminders.map(r => ({ text: r, deadline: "", description: "", link: "" })) // Initialize existing reminders with empty deadline, description, and link
  );
  
  const [files, setFiles] = useState(
    customerData.files.map(file => ({ name: file, type: 'document', description: '', url: '', size: 0, uploadTime: '' }))
  );
  const [currentStage, setCurrentStage] = useState("Working");
  const [stageData, setStageData] = useState({
    Working: { 
      notes: ["Initial contact established. Client interested in our services."], 
      tasks: [
        { name: "Send proposal", done: true },
        { name: "Schedule follow-up call", done: false }
      ],
      completed: false // Added completion status
    },
    Qualified: { 
      notes: [], 
      tasks: [],
      completed: false // Added completion status
    },
    Converted: { 
      notes: [], 
      tasks: [],
      completed: false // Added completion status
    },
  });
  const [stages, setStages] = useState(STAGES); // Added state for stages

  const [customerProfile, setCustomerProfile] = useState(customerData.customerProfile); // Added state for customer profile

  const [companyProfile, setCompanyProfile] = useState(customerData.companyProfile); // Added state for company profile

  const handleAddActivity = (activity) => {
    setActivities([activity, ...activities]);
  };

  const handleDeleteActivity = (indexToDelete) => {
    setActivities(activities.filter((_, index) => index !== indexToDelete));
  };

  const handleAddReminder = (reminder) => {
    // reminder is now an object { text, deadline, description, link }
    setReminders([reminder, ...reminders]);
  };

  const handleReminderRemove = (indexToRemove) => {
    setReminders(reminders.filter((_, index) => index !== indexToRemove));
  };

  const handleFileAdd = (file) => {
    setFiles([...files, file]);
  };

  const handleFileRemove = (indexToRemove) => {
    setFiles(files.filter((_, index) => index !== indexToRemove));
  };

  const handleFileRename = (indexToRename, newName) => {
    setFiles(files.map((file, index) => 
      index === indexToRename ? { ...file, name: newName } : file
    ));
  };

  return (
    <div style={{ 
      fontFamily: "Arial, sans-serif", 
      background: COLORS.background, 
      minHeight: "100vh" 
    }}>
      <TopBar />
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "1fr 2fr 1fr", 
        gap: LAYOUT.gap, 
        padding: "20px",
        maxWidth: "1200px", // Adjusted max-width for a slightly tighter layout
        margin: "0 auto"
      }}>
        
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: LAYOUT.gap }}>
          <CustomerInfo data={customerProfile} setCustomerProfile={setCustomerProfile} />
          <CompanyInfo data={companyProfile} setCompanyProfile={setCompanyProfile} />
          <CompanyReputation data={customerData.reputation} />
        </div>

        {/* Middle Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: LAYOUT.gap }}>
          <StatusPanel
            stages={stages} // Pass stages from state
            setStages={setStages} // Pass setStages function
            currentStage={currentStage}
            setCurrentStage={setCurrentStage}
            stageData={stageData}
            setStageData={setStageData}
            renderStageContent={(stage, stageData, setStageData) => (
              <TaskManager 
                stage={stage}
                stageData={stageData}
                setStageData={setStageData}
              />
            )}
          />
          
          <ActivityRecord 
            activities={activities}
            onAddActivity={handleAddActivity}
            onDeleteActivity={handleDeleteActivity} // Pass the new delete handler
          />
        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: LAYOUT.gap }}>
          <Reminders 
            reminders={reminders}
            onAddReminder={handleAddReminder}
            onReminderRemove={handleReminderRemove}
          />
          
          <AttachedFiles files={files} onFileAdd={handleFileAdd} onFileRemove={handleFileRemove} onFileRename={handleFileRename} />
        </div>

      </div>
    </div>
  );
}
