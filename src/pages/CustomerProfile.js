import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import CustomerInfo from "../components/profile-component/CustomerInfo";
import CompanyInfo from "../components/profile-component/CompanyInfo";
import CompanyReputation from "../components/profile-component/CompanyReputation";
import StatusPanel from "../components/profile-component/StatusPanel";
import Reminders from "../components/profile-component/Reminders";
import AttachedFiles from "../components/profile-component/AttachedFiles";
import TaskManager from "../components/profile-component/TaskManager";
import SendApprovalModal from "../components/project-component/SendApprovalModal";
import CreateProjectModal from "../components/project-component/CreateProjectModal";
import { db } from "../firebase";
import { doc, getDoc, updateDoc, collection, serverTimestamp, addDoc, query, where, getDocs, deleteDoc } from "firebase/firestore";
import { DESIGN_SYSTEM, getPageContainerStyle, getCardStyle, getPageHeaderStyle, getContentContainerStyle, getButtonStyle } from '../styles/designSystem';

const STAGES = ["Working", "Qualified", "Converted"];

export default function CustomerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showSendApprovalModal, setShowSendApprovalModal] = useState(false); // New state for SendApprovalModal
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false); // State for CreateProjectModal
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
  const [lastContact, setLastContact] = useState("N/A"); // Default last contact
  const [customerTeamMembersDetails, setCustomerTeamMembersDetails] = useState([]); // State for enriched team member details

  // Helper to check if a stage is completed
  const isStageCompleted = (stageName) => stageData[stageName]?.completed;

  // Helper to check if all stages are completed
  const areAllStagesCompleted = () => {
    return stages.every(stage => isStageCompleted(stage));
  };

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

  const handleConvertToProject = () => {
    setShowCreateProjectModal(true);
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
        setLastContact("N/A");
      }
      setLoading(false);
    };

    fetchCustomer();
  }, [id, navigate, setStages, setStageData]); // Depend on 'id', 'navigate', 'setStages', and 'setStageData'

  // Effect to fetch team member details from associated projects
  useEffect(() => {
    const fetchCustomerTeamMembersDetails = async () => {
      if (!projects || projects.length === 0) {
        setCustomerTeamMembersDetails([]);
        return;
      }

      const uniqueMemberUids = new Set();
      for (const projectId of projects) {
        const projectRef = doc(db, "projects", projectId);
        const projectSnap = await getDoc(projectRef);
        if (projectSnap.exists()) {
          const projectData = projectSnap.data();
          (projectData.team || []).forEach(memberUid => uniqueMemberUids.add(memberUid));
        }
      }

      const allMemberUids = Array.from(uniqueMemberUids);
      const fetchedDetails = [];
      if (allMemberUids.length > 0) {
        const chunkSize = 10; // Firestore 'in' query limit

        for (let i = 0; i < allMemberUids.length; i += chunkSize) {
          const chunk = allMemberUids.slice(i, i + chunkSize);
          const usersQuery = query(collection(db, "users"), where("uid", "in", chunk));
          const usersSnapshot = await getDocs(usersQuery);
          usersSnapshot.forEach(userDoc => {
            const userData = userDoc.data();
            fetchedDetails.push({
              uid: userDoc.id,
              name: userData.name || userData.email,
              email: userData.email,
            });
          });
        }
      }
      setCustomerTeamMembersDetails(fetchedDetails);
    };

    fetchCustomerTeamMembersDetails();
  }, [projects]); // Re-run when projects array changes

  const handleSaveCustomer = async (overrides = {}) => {
    setLoading(true);
    const mergedCustomerProfile = overrides.customerProfile || customerProfile;
    const mergedCompanyProfile = overrides.companyProfile || companyProfile;
    const customerDataToSave = {
      customerProfile: mergedCustomerProfile,
      companyProfile: mergedCompanyProfile,
      reputation,
      activities,
      reminders,
      files,
      currentStage,
      stageData,
      stages,
      projects,
      lastContact: lastContact === "N/A" ? serverTimestamp() : lastContact, // Set timestamp on first save
    };

    try {
      const docRef = doc(db, "customerProfiles", id);
      await updateDoc(docRef, customerDataToSave);
      console.log("Customer updated!");
        
      // Update corresponding entry in Contacts (organizations) if customer/company details changed
      try {
        const organizationsRef = collection(db, "organizations");
        const orgQuery = query(organizationsRef, where("clients", "array-contains", {
          id: id,
          name: customerProfile.name,
          email: customerProfile.email,
          phone: customerProfile.phone,
          company: companyProfile.company
        }));
        
        // Since we can't query by array element properties directly, we'll query all organizations and filter manually
        const allOrgsQuery = query(organizationsRef);
        const allOrgsSnapshot = await getDocs(allOrgsQuery);
        
        for (const orgDoc of allOrgsSnapshot.docs) {
          const orgData = orgDoc.data();
          const clients = orgData.clients || [];
          
          // Find the client with matching ID
          const clientIndex = clients.findIndex(client => client.id === id);
          if (clientIndex !== -1) {
            const isCompanyChanged = mergedCompanyProfile.company && orgData.name !== mergedCompanyProfile.company;
            if (isCompanyChanged) {
              // Remove from the old organization first
              const prunedClients = clients.filter(c => c.id !== id);
              await updateDoc(doc(db, "organizations", orgDoc.id), { clients: prunedClients });
              if (prunedClients.length === 0) {
                await deleteDoc(doc(db, "organizations", orgDoc.id));
                console.log("Deleted empty organization:", orgDoc.id);
              }

              // Move to destination organization (create if needed), preventing duplicates
              const destQuery = query(organizationsRef, where("name", "==", mergedCompanyProfile.company), where("userId", "==", orgData.userId));
              const destSnapshot = await getDocs(destQuery);
              const clientPayload = {
                id: id,
                name: mergedCustomerProfile.name,
                email: mergedCustomerProfile.email,
                phone: mergedCustomerProfile.phone,
                company: mergedCompanyProfile.company
              };
              if (!destSnapshot.empty) {
                const destDoc = destSnapshot.docs[0];
                const destClients = destDoc.data().clients || [];
                const exists = destClients.some(c => c.id === id);
                if (!exists) {
                  await updateDoc(doc(db, "organizations", destDoc.id), { clients: [...destClients, clientPayload] });
                  console.log("Moved client to organization:", destDoc.id);
                } else {
                  // Also ensure details are up to date if exists
                  const updatedDest = destClients.map(c => c.id === id ? clientPayload : c);
                  await updateDoc(doc(db, "organizations", destDoc.id), { clients: updatedDest });
                  console.log("Updated existing client in destination organization:", destDoc.id);
                }
              } else {
                await addDoc(organizationsRef, {
                  name: mergedCompanyProfile.company,
                  clients: [clientPayload],
                  collapsed: false,
                  userId: orgData.userId
                });
                console.log("Created new organization and moved client:", mergedCompanyProfile.company);
              }
            } else {
              // Same organization: just update client details in place
              const updatedClients = [...clients];
              updatedClients[clientIndex] = {
                id: id,
                name: mergedCustomerProfile.name,
                email: mergedCustomerProfile.email,
                phone: mergedCustomerProfile.phone,
                company: mergedCompanyProfile.company
              };
              await updateDoc(doc(db, "organizations", orgDoc.id), { clients: updatedClients });
              console.log("Updated client details in organization:", orgDoc.id);
            }
            break; // Found and handled
          }
        }
      } catch (orgError) {
        console.error("Error updating organization data:", orgError);
        // Don't fail the whole operation if organization update fails
      }
      
      navigate('/customer-profiles'); // Navigate back to the list after saving
    } catch (error) {
      console.error("Error saving customer: ", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProjectFromConversion = async (projectData) => {
    setLoading(true);
    try {
      // Pre-fill fields from customerProfile and companyProfile
      const preFilledProjectData = {
        ...projectData,
        company: companyProfile.company || projectData.company || '',
        industry: companyProfile.industry || projectData.industry || '',
        contactPerson: customerProfile.name || projectData.contactPerson || '',
        contactEmail: customerProfile.email || projectData.contactEmail || '',
        contactPhone: customerProfile.phone || projectData.contactPhone || '',
        status: "Waiting for Approval", // Set initial status
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        customerId: id, // Link to the current customer
      };

      const projectsCollectionRef = collection(db, "projects");
      const newProjectRef = await addDoc(projectsCollectionRef, preFilledProjectData);

      // Update the customer's projects array with the new project ID
      const customerRef = doc(db, "customerProfiles", id);
      await updateDoc(customerRef, {
        projects: [...projects, newProjectRef.id],
      });

      console.log("Project created from conversion with ID:", newProjectRef.id);
      setShowCreateProjectModal(false);
      navigate(`/project/${newProjectRef.id}`);
    } catch (error) {
      console.error("Error creating project from conversion:", error);
      alert("Failed to create project.");
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
    return (
      <div style={getPageContainerStyle()}>
        <TopBar />
        <div style={{ textAlign: "center", padding: "50px", color: DESIGN_SYSTEM.colors.text.secondary }}>
          Loading customer profile...
        </div>
      </div>
    );
  }

  return (
    <div style={getPageContainerStyle()}>
      <TopBar />

      <div style={{
        ...getContentContainerStyle(),
        paddingTop: DESIGN_SYSTEM.spacing['2xl']
      }}>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "350px 1fr 320px", 
          gap: DESIGN_SYSTEM.spacing.xl
        }}>
        
        {/* Left Column - Customer Information */}
        <div style={{ display: "flex", flexDirection: "column", gap: DESIGN_SYSTEM.spacing.lg }}>
          <div style={getCardStyle('customers')}>
            <div style={{
              background: DESIGN_SYSTEM.pageThemes.customers.gradient,
              color: DESIGN_SYSTEM.colors.text.inverse,
              padding: DESIGN_SYSTEM.spacing.base,
              borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`
            }}>
              <h2 style={{ 
                margin: 0, 
                fontSize: DESIGN_SYSTEM.typography.fontSize.lg, 
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold 
              }}>
                Customer Information
              </h2>
            </div>
            <div style={{ padding: "0" }}>
              <CustomerInfo data={customerProfile} setCustomerProfile={setCustomerProfile} />
            </div>
          </div>
          
          <div style={getCardStyle('customers')}>
            <div style={{
              background: DESIGN_SYSTEM.pageThemes.customers.gradient,
              color: DESIGN_SYSTEM.colors.text.inverse,
              padding: DESIGN_SYSTEM.spacing.base,
              borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`
            }}>
              <h2 style={{ 
                margin: 0, 
                fontSize: DESIGN_SYSTEM.typography.fontSize.lg, 
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold 
              }}>
                Company Details
              </h2>
            </div>
            <div style={{ padding: "0" }}>
              <CompanyInfo 
                data={companyProfile} 
                setCompanyProfile={(updated) => {
                  // Only update local state; persistence happens on explicit Save
                  setCompanyProfile(updated);
                }} 
                onSave={(updated) => handleSaveCustomer({ companyProfile: updated })}
              />
            </div>
          </div>
          
          <div style={getCardStyle('customers')}>
            <div style={{
              background: DESIGN_SYSTEM.pageThemes.customers.gradient,
              color: DESIGN_SYSTEM.colors.text.inverse,
              padding: DESIGN_SYSTEM.spacing.base,
              borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`
            }}>
              <h2 style={{ 
                margin: 0, 
                fontSize: DESIGN_SYSTEM.typography.fontSize.lg, 
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold 
              }}>
                Company Reputation
              </h2>
            </div>
            <div style={{ padding: "0" }}>
              <CompanyReputation data={reputation} />
            </div>
          </div>
        </div>

        {/* Middle Column - Main Workflow */}
        <div style={{ display: "flex", flexDirection: "column", gap: DESIGN_SYSTEM.spacing.lg }}>
          <div style={{
            ...getCardStyle('customers'),
            minHeight: "600px",
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{
              background: DESIGN_SYSTEM.pageThemes.customers.gradient,
              color: DESIGN_SYSTEM.colors.text.inverse,
              padding: DESIGN_SYSTEM.spacing.lg,
              borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`
            }}>
              <h2 style={{ 
                margin: 0, 
                fontSize: DESIGN_SYSTEM.typography.fontSize.xl, 
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold 
              }}>
                Stage Management
              </h2>
              <p style={{ 
                margin: "8px 0 0 0", 
                fontSize: DESIGN_SYSTEM.typography.fontSize.sm, 
                opacity: 0.9 
              }}>
                Track customer journey through customizable stages
              </p>
            </div>
            <div style={{ flex: 1, padding: "0" }}>
              <StatusPanel
                stages={stages}
                currentStage={currentStage}
                setCurrentStage={setCurrentStage}
                stageData={stageData}
                setStageData={setStageData}
                setStages={setStages}
                onStagesUpdate={handleStagesUpdate}
                onConvertToProject={handleConvertToProject}
                renderStageContent={(stage, currentStageData, setCurrentStageData) => (
                  <TaskManager 
                    stage={stage}
                    stageData={currentStageData}
                    setStageData={setCurrentStageData}
                  />
                )}
              />
            </div>
          </div>
        </div>

        {/* Right Column - Tools & Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: DESIGN_SYSTEM.spacing.lg }}>
          <div style={getCardStyle('customers')}>
            <div style={{
              background: DESIGN_SYSTEM.pageThemes.customers.gradient,
              color: DESIGN_SYSTEM.colors.text.inverse,
              padding: DESIGN_SYSTEM.spacing.base,
              borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`
            }}>
              <h2 style={{ 
                margin: 0, 
                fontSize: DESIGN_SYSTEM.typography.fontSize.lg, 
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold 
              }}>
                Reminders & Alerts
              </h2>
            </div>
            <div style={{ padding: "0" }}>
              <Reminders 
                reminders={reminders}
                onAddReminder={handleAddReminder}
                onReminderRemove={handleReminderRemove}
              />
            </div>
          </div>
          
          <div style={getCardStyle('customers')}>
            <div style={{
              background: DESIGN_SYSTEM.pageThemes.customers.gradient,
              color: DESIGN_SYSTEM.colors.text.inverse,
              padding: DESIGN_SYSTEM.spacing.base,
              borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`
            }}>
              <h2 style={{ 
                margin: 0, 
                fontSize: DESIGN_SYSTEM.typography.fontSize.lg, 
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold 
              }}>
                Document Management
              </h2>
            </div>
            <div style={{ padding: "0" }}>
              <AttachedFiles 
                files={files} 
                onFileAdd={handleFileAdd} 
                onFileRemove={handleFileRemove} 
                onFileRename={handleFileRename} 
              />
            </div>
          </div>
          
          {/* Action Center */}
          <div style={{
            ...getCardStyle('customers'),
            padding: DESIGN_SYSTEM.spacing.lg
          }}>
            <h3 style={{ 
              margin: `0 0 ${DESIGN_SYSTEM.spacing.base} 0`, 
              color: DESIGN_SYSTEM.colors.text.primary, 
              fontSize: DESIGN_SYSTEM.typography.fontSize.lg, 
              fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold,
              textAlign: "center"
            }}>
              Quick Actions
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: DESIGN_SYSTEM.spacing.base }}>
              {areAllStagesCompleted() && (
                <button
                  onClick={handleConvertToProject}
                  style={{
                    ...getButtonStyle('primary', 'projects'),
                    padding: `${DESIGN_SYSTEM.spacing.base} ${DESIGN_SYSTEM.spacing.base}`,
                    fontSize: DESIGN_SYSTEM.typography.fontSize.base,
                    fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold
                  }}
                >
                  Convert to Project
                </button>
              )}
              <button
                onClick={() => setShowSendApprovalModal(true)}
                style={{
                  ...getButtonStyle('primary', 'customers'),
                  padding: `${DESIGN_SYSTEM.spacing.base} ${DESIGN_SYSTEM.spacing.base}`,
                  fontSize: DESIGN_SYSTEM.typography.fontSize.base,
                  fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold
                }}
              >
                Send Approval Request
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
      
      <SendApprovalModal
        isOpen={showSendApprovalModal}
        onClose={() => setShowSendApprovalModal(false)}
        onSendApproval={(data) => console.log("Customer Profile - Approval data sent:", data)}
        teamMembers={customerTeamMembersDetails}
      />

      <CreateProjectModal
        isOpen={showCreateProjectModal}
        onClose={() => setShowCreateProjectModal(false)}
        customerProfile={customerProfile}
        companyProfile={companyProfile}
        onSave={handleSaveProjectFromConversion}
      />
    </div>
  );
}
