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
import { STAGES, COLORS } from "../components/profile-component/constants";

export default function CustomerProfile() {
  const { id } = useParams();
  
  // Initialize state with data from JSON
  const [activities, setActivities] = useState([
    { type: "Gmail", time: "2025-01-20 10:00", description: "Sent introduction email" },
    { type: "Call", time: "2025-01-20 14:00", description: "Initial consultation call completed" },
    ...customerData.activities
  ]);
  
  const [reminders, setReminders] = useState([
    "[10:00 AM] Follow up on proposal",
    "[2:00 PM] Send contract details",
    ...customerData.reminders
  ]);
  
  const [files] = useState(customerData.files);
  const [currentStage, setCurrentStage] = useState("Working");
  const [stageData, setStageData] = useState({
    Working: { 
      notes: "Initial contact established. Client interested in our services.", 
      tasks: [
        { name: "Send proposal", done: true },
        { name: "Schedule follow-up call", done: false }
      ]
    },
    Qualified: { 
      notes: "", 
      tasks: [] 
    },
    Converted: { 
      notes: "", 
      tasks: [] 
    },
  });

  const handleAddActivity = (activity) => {
    setActivities([activity, ...activities]);
  };

  const handleAddReminder = (reminder) => {
    const timestamp = new Date().toLocaleTimeString();
    setReminders([`[${timestamp}] ${reminder}`, ...reminders]);
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
        gap: "20px", 
        padding: "20px",
        maxWidth: "1400px",
        margin: "0 auto"
      }}>
        
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <CustomerInfo data={customerData.customerProfile} />
          <CompanyInfo data={customerData.companyProfile} />
          <CompanyReputation data={customerData.reputation} />
        </div>

        {/* Middle Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <StatusPanel
            stages={STAGES}
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
          />
        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <Reminders 
            reminders={reminders}
            onAddReminder={handleAddReminder}
          />
          
          <AttachedFiles files={files} />
        </div>

      </div>
    </div>
  );
}
