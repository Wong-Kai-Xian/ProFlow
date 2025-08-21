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
import customerDataArray from "../components/profile-component/customerData.js";
import { STAGES, COLORS, LAYOUT } from "../components/profile-component/constants";

export default function CustomerProfile() {
  const { id } = useParams();

  // Find the customer data based on the ID from the URL
  const customerData = customerDataArray.find(cust => cust.id === parseInt(id));

  // Initialize state variables with default values or from customerData if available
  const [activities, setActivities] = useState(
    customerData 
      ? customerData.activities.map(activity => ({...activity, time: new Date(activity.time)}))
      : []
  );
  
  const [reminders, setReminders] = useState(
    customerData 
      ? customerData.reminders.map(r => ({ text: r, deadline: "", description: "", link: "" }))
      : []
  );
  
  const [files, setFiles] = useState(
    customerData 
      ? customerData.files.map(file => ({ name: file, type: 'document', description: '', url: '', size: 0, uploadTime: '' }))
      : []
  );
  const [currentStage, setCurrentStage] = useState(STAGES[0]); // Set to first stage initially
  const [stageData, setStageData] = useState({
    Proposal: { 
      notes: ["Initial contact established. Client interested in our services."], 
      tasks: [
        { name: "Send proposal", done: true },
        { name: "Schedule follow-up call", done: false }
      ],
      completed: false
    },
    Negotiation: { 
      notes: [], 
      tasks: [],
      completed: false
    },
    Complete: { 
      notes: [], 
      tasks: [],
      completed: false
    },
  });
  const [stages, setStages] = useState(STAGES);

  const [customerProfile, setCustomerProfile] = useState(customerData?.customerProfile || {});

  const [companyProfile, setCompanyProfile] = useState(customerData?.companyProfile || {});

  // If customerData is not found, you might want to redirect or show an error AFTER hooks are called
  if (!customerData) {
    return <div>Customer not found!</div>; // Or navigate to a 404 page
  }

  const handleAddActivity = (activity) => {
    setActivities([activity, ...activities]);
  };

  const handleDeleteActivity = (indexToDelete) => {
    setActivities(activities.filter((_, index) => index !== indexToDelete));
  };

  const handleAddReminder = (reminder) => {
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
        maxWidth: "1200px",
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
            stages={stages}
            setStages={setStages}
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
            onDeleteActivity={handleDeleteActivity}
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
