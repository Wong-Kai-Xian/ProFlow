import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import CustomerInfo from "../components/profile-component/CustomerInfo";
import CompanyInfo from "../components/profile-component/CompanyInfo";
import CompanyReputation from "../components/profile-component/CompanyReputation";
import StatusPanel from "../components/profile-component/StatusPanel";
import ActivityRecord from "../components/profile-component/ActivityRecord";
import Reminders from "../components/profile-component/Reminders";
import AttachedFiles from "../components/profile-component/AttachedFiles";
import TaskManager from "../components/profile-component/TaskManager";
import SendApprovalModal from "../components/project-component/SendApprovalModal"; // Import SendApprovalModal
import { COLORS, LAYOUT, BUTTON_STYLES } from "../components/profile-component/constants";
import { db } from "../firebase"; // Import db
import { doc, getDoc, updateDoc, collection, serverTimestamp } from "firebase/firestore"; // Import Firestore functions

const STAGES = ["Working", "Qualified", "Converted"];

export default function CustomerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showSendApprovalModal, setShowSendApprovalModal] = useState(false); // New state for SendApprovalModal
  const [loading, setLoading] = useState(true); // Loading state

  // Initialize state variables with default values for new customer or null for existing to be loaded
  const [customerProfile, setCustomerProfile] = useState({});
  const [companyProfile, setCompanyProfile] = useState({});
  const [reputation, setReputation] = useState({});
  const [activities, setActivities] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [files, setFiles] = useState([]);
  const [currentStage, setCurrentStage] = useState(STAGES[0]);
  const [stageData, setStageData] = useState({});
  const [stages, setStages] = useState(STAGES);
  const [projects, setProjects] = useState([]); // To store associated projects
  const [status, setStatus] = useState("Active"); // Default status
  const [lastContact, setLastContact] = useState("N/A"); // Default last contact

  const handleStagesUpdate = async (updatedStages, updatedStageData, newCurrentStageName) => {
    setStages(updatedStages);
    setStageData(updatedStageData);

    let dataToUpdate = { stages: updatedStages, stageData: updatedStageData };

    if (newCurrentStageName) {
      setCurrentStage(newCurrentStageName);
      dataToUpdate.currentStage = newCurrentStageName;
    }

    if (id && id !== 'new') {
      const customerRef = doc(db, "customerProfiles", id);
      try {
        await updateDoc(customerRef, dataToUpdate);
        console.log("Stages, stage data, and current stage updated in Firestore.");
      } catch (error) {
        console.error("Error updating stages in Firestore:", error);
      }
    }
  };

  useEffect(() => {
    const fetchCustomer = async () => {
      setLoading(true);
      if (id && id !== 'new') {
        const docRef = doc(db, "customerProfiles", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCustomerProfile(data.customerProfile || {});
          setCompanyProfile(data.companyProfile || {});
          setReputation(data.reputation || {});
          setActivities(data.activities || []);
          setReminders(data.reminders || []);
          setFiles(data.files || []);
          setCurrentStage(data.currentStage || STAGES[0]); // Ensure currentStage is set from data or defaults to first stage
          setStageData(data.stageData || {});
          setStages(data.stages || STAGES);
          setProjects(data.projects || []);
          setStatus(data.status || "Active");
          setLastContact(data.lastContact || "N/A");
        } else {
          console.log("No such customer document!");
          // If ID exists but document doesn't, navigate back to list or show error
          navigate('/customerlist', { replace: true });
        }
      } else {
        // This case should ideally not be hit directly for 'new' anymore if modal is used from CustomerProfileList.
        // However, initialize for a brand new empty customer profile if somehow accessed directly.
        setCustomerProfile({});
        setCompanyProfile({});
        setReputation({});
        setActivities([]);
        setReminders([]);
        setFiles([]);
        setCurrentStage(STAGES[0]); // Default to first stage for new customers
        setStages(STAGES);
        setStageData({
          "Working": { notes: [], tasks: [], completed: false },
          "Qualified": { notes: [], tasks: [], completed: false },
          "Converted": { notes: [], tasks: [], completed: false },
        });
        setProjects([]);
        setStatus("Active");
        setLastContact("N/A");
      }
      setLoading(false);
    };

    fetchCustomer();
  }, [id, navigate, setStages, setStageData]); // Depend on 'id', 'navigate', 'setStages', and 'setStageData'

  const handleSaveCustomer = async () => {
    setLoading(true);
    const customerDataToSave = {
      customerProfile,
      companyProfile,
      reputation,
      activities,
      reminders,
      files,
      currentStage,
      stageData,
      stages,
      projects,
      status,
      lastContact: lastContact === "N/A" ? serverTimestamp() : lastContact, // Set timestamp on first save
    };

    try {
      const docRef = doc(db, "customerProfiles", id);
      await updateDoc(docRef, customerDataToSave);
      console.log("Customer updated!");
        
      // TODO: For existing customers, you might also need to update their entry in the Contacts (organizations) if name/company changes.
      // This is more complex as it requires finding the client entry in the correct organization and updating it.
      // For now, we'll focus on new customer creation.
      navigate('/customerlist'); // Navigate back to the list after saving
    } catch (error) {
      console.error("Error saving customer: ", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddActivity = (activity) => {
    const updatedActivities = [activity, ...activities];
    setActivities(updatedActivities);
    // Consider saving to Firestore immediately or when main save button is clicked
  };

  const handleDeleteActivity = (indexToDelete) => {
    const updatedActivities = activities.filter((_, index) => index !== indexToDelete);
    setActivities(updatedActivities);
  };

  const handleAddReminder = async (reminder) => {
    const updatedReminders = [...reminders, reminder]; // Add new reminder to the end
    setReminders(updatedReminders);

    // Persist to Firestore immediately
    if (id) {
      const customerRef = doc(db, "customerProfiles", id);
      try {
        await updateDoc(customerRef, { reminders: updatedReminders });
        console.log("Reminder added and saved to Firestore.");
      } catch (error) {
        console.error("Error adding reminder to Firestore:", error);
      }
    }
  };

  const handleReminderRemove = async (indexToRemove) => {
    const updatedReminders = reminders.filter((_, index) => index !== indexToRemove);
    setReminders(updatedReminders);

    // Persist to Firestore immediately
    if (id) {
      const customerRef = doc(db, "customerProfiles", id);
      try {
        await updateDoc(customerRef, { reminders: updatedReminders });
        console.log("Reminder removed and saved to Firestore.");
      } catch (error) {
        console.error("Error removing reminder from Firestore:", error);
      }
    }
  };

  const handleFileAdd = (file) => {
    const updatedFiles = [...files, file];
    setFiles(updatedFiles);
  };

  const handleFileRemove = (indexToRemove) => {
    const updatedFiles = files.filter((_, index) => index !== indexToRemove);
    setFiles(updatedFiles);
  };

  const handleFileRename = (indexToRename, newName) => {
    const updatedFiles = files.map((file, index) => 
      index === indexToRename ? { ...file, name: newName } : file
    );
    setFiles(updatedFiles);
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: "50px", color: COLORS.lightText }}>Loading customer profile...</div>;
  }

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
          <CompanyReputation data={reputation} />
        </div>

        {/* Middle Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: LAYOUT.gap }}>
          <StatusPanel
            stages={stages}
            currentStage={currentStage}
            setCurrentStage={setCurrentStage}
            stageData={stageData}
            setStageData={setStageData}
            setStages={setStages}
            onStagesUpdate={handleStagesUpdate} // Pass the new handler
            renderStageContent={(stage, currentStageData, setCurrentStageData) => (
              <TaskManager 
                stage={stage}
                stageData={currentStageData} // Use currentStageData
                setStageData={setCurrentStageData} // Use setCurrentStageData
              />
            )}
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
          <button
            onClick={() => setShowSendApprovalModal(true)}
            style={{
              ...BUTTON_STYLES.secondary,
              padding: "10px 20px",
              fontSize: "16px",
              marginTop: LAYOUT.smallGap, // Add margin
              alignSelf: "flex-end", // Align button to the right within the flex column
            }}
          >
            Send Approval
          </button>
        </div>

      </div>
      <SendApprovalModal
        isOpen={showSendApprovalModal}
        onClose={() => setShowSendApprovalModal(false)}
        onSendApproval={(data) => console.log("Customer Profile - Approval data sent:", data)}
        allProjects={projects} // Pass customer's projects (from state)
      />
    </div>
  );
}
