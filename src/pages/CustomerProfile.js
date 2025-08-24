import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import CustomerInfo from "../components/profile-component/CustomerInfo";
import CompanyInfo from "../components/profile-component/CompanyInfo";
import CompanyReputation from "../components/profile-component/CompanyReputation";
import CompanyNewsPanel from "../components/profile-component/CompanyNewsPanel";
import ConvertedProjectRow from "../components/profile-component/ConvertedProjectRow";
import StatusPanel from "../components/profile-component/StatusPanel";
import Reminders from "../components/profile-component/Reminders";
import ProjectReminders from "../components/project-component/Reminders";
import AttachedFiles from "../components/profile-component/AttachedFiles";
import CustomerQuotesPanel from "../components/profile-component/CustomerQuotesPanel";
import ProjectWorkspacePanel from "../components/profile-component/ProjectWorkspacePanel";
import TaskManager from "../components/profile-component/TaskManager";
import SendApprovalModal from "../components/project-component/SendApprovalModal";
import CreateProjectModal from "../components/project-component/CreateProjectModal";
import AdvancedApprovalRequestModal from "../components/project-component/AdvancedApprovalRequestModal";
import { db } from "../firebase";
import { doc, getDoc, updateDoc, collection, serverTimestamp, addDoc, query, where, getDocs, deleteDoc, onSnapshot, arrayUnion, arrayRemove } from "firebase/firestore";
import { useAuth } from '../contexts/AuthContext';
import { DESIGN_SYSTEM, getPageContainerStyle, getCardStyle, getPageHeaderStyle, getContentContainerStyle, getButtonStyle } from '../styles/designSystem';

const STAGES = ["Working", "Qualified", "Converted"];

export default function CustomerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [showSendApprovalModal, setShowSendApprovalModal] = useState(false); // New state for SendApprovalModal
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false); // State for CreateProjectModal
  const [showAdvancedApprovalModal, setShowAdvancedApprovalModal] = useState(false); // State for AdvancedApprovalRequestModal
  const [approvalModalType, setApprovalModalType] = useState('stage'); // 'stage' or 'general'
  const [showProjectConversionApprovalModal, setShowProjectConversionApprovalModal] = useState(false); // State for project conversion approval
  const [hasApprovedConversion, setHasApprovedConversion] = useState(false); // Track if conversion was approved
  const [hasPendingConversionRequest, setHasPendingConversionRequest] = useState(false); // Track if conversion request was sent
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
  const [projectSnapshots, setProjectSnapshots] = useState({}); // Per-project saved data snapshots
  const [activeStageTab, setActiveStageTab] = useState('current');
  const [projectNames, setProjectNames] = useState({}); // Map of projectId -> name
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectMeetingTranscripts, setProjectMeetingTranscripts] = useState([]);
  const [lastContact, setLastContact] = useState("N/A"); // Default last contact
  const [customerTeamMembersDetails, setCustomerTeamMembersDetails] = useState([]); // State for enriched team member details

  // Meeting state (mirrors ProjectDetail)
  const [showMeeting, setShowMeeting] = useState(false);
  const [meetingMinimized, setMeetingMinimized] = useState(false);
  const [meetingParticipants, setMeetingParticipants] = useState([]);
  const [suppressMeetingBar, setSuppressMeetingBar] = useState(false);
  const userHasJoinedMeeting = meetingParticipants.includes(currentUser?.uid || "");

  // Meeting session + transcription
  const [meetingSessionId, setMeetingSessionId] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [sessionTranscripts, setSessionTranscripts] = useState([]);
  const lastInterimSaveRef = useRef(0);
  const meetingSessionIdRef = useRef(null);
  const transcriptBufferRef = useRef("");
  const pendingInterimRef = useRef("");
  const recognitionRef = useRef(null);

  // Saved transcripts under customer profile
  const [meetingTranscriptsList, setMeetingTranscriptsList] = useState([]);
  const meetingIframeRef = useRef(null);

  // AI Actions modal state
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiModalLoading, setAiModalLoading] = useState(false);
  const [aiModalError, setAiModalError] = useState("");
  const [aiModalItems, setAiModalItems] = useState([]);
  const [aiModalSelection, setAiModalSelection] = useState({});
  const [aiModalTranscriptDoc, setAiModalTranscriptDoc] = useState(null);
  const [aiModalTarget, setAiModalTarget] = useState('reminders'); // 'reminders' | 'notes'
  // Default CRM tab to Stages on load
  const [defaultCrmTab, setDefaultCrmTab] = useState('Stages');

  // Wire AI Actions button inside CRM transcripts to this page modal
  useEffect(() => {
    const handler = (e) => {
      try {
        const detail = e?.detail || {};
        if (!detail.transcript) return;
        setAiModalTranscriptDoc(detail.transcript);
        setAiModalItems([]);
        setAiModalSelection({});
        setAiModalTarget('tasks');
        setAiModalError('');
        setAiModalOpen(true);
      } catch {}
    };
    window.addEventListener('proflow-ai-actions', handler);
    return () => window.removeEventListener('proflow-ai-actions', handler);
  }, []);

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
    // First show approval request modal for project conversion
    setShowProjectConversionApprovalModal(true);
  };

  const handleProjectConversionApprovalSuccess = (result) => {
    setShowProjectConversionApprovalModal(false);
    setHasPendingConversionRequest(true);
    // Don't create project immediately - wait for approval
    alert("Conversion approval request sent successfully! You'll be able to create the project once it's approved.");
  };

  const handleCreateProjectAfterApproval = () => {
    setShowCreateProjectModal(true);
  };

  // Helper function to get proper customer name
  const getCustomerName = () => {
    const firstName = customerProfile?.firstName || '';
    const lastName = customerProfile?.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    
    if (fullName) return fullName;
    if (customerProfile?.name) return customerProfile.name;
    if (companyProfile?.companyName) return companyProfile.companyName;
    if (companyProfile?.company) return companyProfile.company;
    
    return 'Customer Profile';
  };

  const handleRequestApproval = (currentStage, nextStage) => {
    setApprovalModalType('stage');
    setShowAdvancedApprovalModal(true);
  };

  const handleSendApprovalRequest = () => {
    setApprovalModalType('general');
    setShowAdvancedApprovalModal(true);
  };

  const handleApprovalRequestSuccess = (result) => {
    setShowAdvancedApprovalModal(false);
    alert(`Approval request sent successfully to ${result.recipientCount} team member(s)!\n\nTitle: ${result.title}\nType: ${result.type}\nEntity: ${result.entityName}`);
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
          setProjectSnapshots(data.projectSnapshots || {});
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

  // Keep session id in ref
  useEffect(() => { meetingSessionIdRef.current = meetingSessionId; }, [meetingSessionId]);

  // Watch live meeting participants on the customer profile
  useEffect(() => {
    if (!id) return;
    const customerRef = doc(db, 'customerProfiles', id);
    const unsub = onSnapshot(customerRef, snap => {
      const data = snap.data();
      setMeetingParticipants(data?.meetingParticipants || []);
      if ((data?.meetingParticipants || []).length > 0 && !showMeeting && !suppressMeetingBar) {
        setMeetingMinimized(true);
      }
    });
    return () => unsub();
  }, [id, showMeeting, suppressMeetingBar]);

  // Watch saved transcripts list under customer
  useEffect(() => {
    if (!id) { setMeetingTranscriptsList([]); return; }
    const colRef = collection(db, 'customerProfiles', id, 'meetingTranscripts');
    const unsub = onSnapshot(colRef, snap => {
      const files = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
      setMeetingTranscriptsList(files);
    });
    return () => unsub();
  }, [id]);

  // Watch session transcripts
  useEffect(() => {
    if (meetingSessionId) {
      const sub = onSnapshot(collection(db, 'meetingSessions', meetingSessionId, 'transcripts'), (snap) => {
        const lines = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a,b)=> (a.createdAt?.seconds||0)-(b.createdAt?.seconds||0));
        setSessionTranscripts(lines);
      });
      return () => sub();
    } else {
      setSessionTranscripts([]);
    }
  }, [meetingSessionId]);

  const startTranscription = async () => {
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { alert('Transcription not supported in this browser. Try Chrome.'); return; }
      if (!meetingSessionIdRef.current) {
        const ref = await addDoc(collection(db, 'meetingSessions'), { customerId: id, startedAt: serverTimestamp(), participants: meetingParticipants });
        meetingSessionIdRef.current = ref.id;
        setMeetingSessionId(ref.id);
      }
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';
      rec.onresult = async (e) => {
        let interim = "";
        let finalText = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) finalText += res[0].transcript;
          else interim += res[0].transcript;
        }
        if (interim) {
          setLiveTranscript(interim);
          const t = interim.trim();
          pendingInterimRef.current = t;
          const now = Date.now();
          const sessionId = meetingSessionIdRef.current;
          if (sessionId && t && t.length > 0 && now - (lastInterimSaveRef.current || 0) > 2500) {
            try {
              await addDoc(collection(db, 'meetingSessions', sessionId, 'transcripts'), {
                text: t,
                userId: currentUser?.uid || 'anon',
                createdAt: serverTimestamp(),
              });
              lastInterimSaveRef.current = now;
            } catch {}
          }
        }
        if (finalText) {
          setLiveTranscript("");
          transcriptBufferRef.current = `${transcriptBufferRef.current} ${finalText.trim()}`.trim();
          const sessionId = meetingSessionIdRef.current;
          if (sessionId) {
            await addDoc(collection(db, 'meetingSessions', sessionId, 'transcripts'), {
              text: finalText.trim(),
              userId: currentUser?.uid || 'anon',
              createdAt: serverTimestamp(),
            });
          }
        }
      };
      rec.onend = () => {
        if (isTranscribing) {
          try { rec.start(); } catch {}
        }
      };
      rec.onerror = () => {
        if (!isTranscribing) return;
        setTimeout(() => { try { rec.start(); } catch {} }, 1000);
      };
      recognitionRef.current = rec;
      setIsTranscribing(true);
      rec.start();
    } catch (e) {
      console.warn('Failed to start transcription', e);
    }
  };

  const stopTranscription = async () => {
    setIsTranscribing(false);
    try { recognitionRef.current && recognitionRef.current.stop(); } catch {}
    try { recognitionRef.current && recognitionRef.current.abort && recognitionRef.current.abort(); } catch {}
    recognitionRef.current = null;
    if (meetingSessionId) {
      await updateDoc(doc(db, 'meetingSessions', meetingSessionId), { endedAt: serverTimestamp() });
    }
  };

  const callGeminiForSummary = async (promptText) => {
    const key = localStorage.getItem('gemini_api_key');
    if (!key) throw new Error('Missing API key. Set it in the Personal Assistant.');
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=' + encodeURIComponent(key);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `You are a meeting assistant. Given the raw transcript, return JSON with keys: summary (string) and action_items (array of objects with title (string), assignee (optional), deadline (optional YYYY-MM-DD or natural language)).\nTranscript:\n${promptText}` }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1500 }
      })
    });
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text;
  };

  const safeParseJson = (str) => {
    try {
      return JSON.parse(str);
    } catch {
      const m = str.match(/\{[\s\S]*\}/);
      if (m) {
        try { return JSON.parse(m[0]); } catch {}
      }
      return null;
    }
  };

  const handleJoinMeeting = async () => {
    if (!id || !currentUser) return;
    const ref = doc(db, 'customerProfiles', id);
    await updateDoc(ref, { meetingParticipants: arrayUnion(currentUser.uid) });
    setShowMeeting(true);
    setSuppressMeetingBar(false);
    if (!meetingSessionId) {
      const sref = await addDoc(collection(db, 'meetingSessions'), { customerId: id, startedAt: serverTimestamp(), participants: [currentUser.uid] });
      setMeetingSessionId(sref.id);
    }
  };

  const handleLeaveMeeting = async () => {
    if (!id || !currentUser) return;
    const ref = doc(db, 'customerProfiles', id);
    await updateDoc(ref, { meetingParticipants: arrayRemove(currentUser.uid) });
    if (isTranscribing) await stopTranscription();
    if (meetingSessionId) await updateDoc(doc(db, 'meetingSessions', meetingSessionId), { endedAt: serverTimestamp() });
  };

  const handleToggleMeeting = async () => {
    if (!showMeeting && !meetingMinimized) {
      setShowMeeting(true);
      setMeetingMinimized(false);
      setSuppressMeetingBar(false);
      return;
    }
    // Always attempt to leave the meeting and end the transcription/session
    try { await handleLeaveMeeting(); } catch {}
    if (isTranscribing) {
      try { await stopTranscription(); } catch {}
    }
    // Force release media from iframe
    try { if (meetingIframeRef.current) { meetingIframeRef.current.src = 'about:blank'; } } catch {}
    // Clear meeting session and transcript buffers
    try {
      setMeetingSessionId(null);
      meetingSessionIdRef.current = null;
      setSessionTranscripts([]);
      setLiveTranscript("");
      transcriptBufferRef.current = "";
      pendingInterimRef.current = "";
      lastInterimSaveRef.current = 0;
    } catch {}
    setShowMeeting(false);
    setMeetingMinimized(false);
    setSuppressMeetingBar(true);
    // Also close any forum meetings linked via this customer's projects
    try {
      if (projects && projects.length > 0 && currentUser?.uid) {
        // Fetch forums that reference these projects
        for (const pid of projects) {
          const forumsSnap = await getDocs(query(collection(db, 'forums'), where('projectId', '==', pid)));
          for (const fdoc of forumsSnap.docs) {
            await updateDoc(doc(db, 'forums', fdoc.id), { meetingParticipants: arrayRemove(currentUser.uid) });
          }
        }
      }
    } catch {}
  };

  const handleGenerateTranscript = async () => {
    try {
      // Flush remaining interim/live text to session
      if (meetingSessionId && liveTranscript && liveTranscript.trim().length > 0) {
        await addDoc(collection(db, 'meetingSessions', meetingSessionId, 'transcripts'), {
          text: liveTranscript.trim(),
          userId: currentUser?.uid || 'anon',
          createdAt: serverTimestamp(),
        });
        setLiveTranscript("");
      }
      const combined = `${sessionTranscripts.map(l => l.text).join('\n')}`.trim();
      const fileName = `meeting-transcript-${new Date().toISOString().replace(/[:.]/g,'-')}.txt`;
      await addDoc(collection(db, 'customerProfiles', id, 'meetingTranscripts'), {
        name: fileName,
        mimeType: 'text/plain',
        content: combined,
        size: combined.length,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.uid || 'anon',
      });
      if (meetingSessionId) {
        try {
          await Promise.all(sessionTranscripts.map(line => deleteDoc(doc(db, 'meetingSessions', meetingSessionId, 'transcripts', line.id))));
          setSessionTranscripts([]);
        } catch {}
      }
    } catch (e) {
      console.error('Failed to save transcript', e);
      alert('Failed to save transcript');
    }
  };

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

  // Fetch project names for tabs
  useEffect(() => {
    const loadNames = async () => {
      try {
        const map = {};
        for (const pid of projects || []) {
          try {
            const psnap = await getDoc(doc(db, 'projects', pid));
            if (psnap.exists()) map[pid] = psnap.data().name || pid;
          } catch {}
        }
        setProjectNames(map);
      } catch {}
    };
    loadNames();
  }, [projects]);

  // Do not auto-select a project; default stays as "No Project" until user selects

  // Load meeting transcripts for selected project
  useEffect(() => {
    if (!selectedProjectId) { setProjectMeetingTranscripts([]); return; }
    const colRef = collection(db, 'projects', selectedProjectId, 'meetingTranscripts');
    const unsub = onSnapshot(colRef, snap => {
      const files = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
      setProjectMeetingTranscripts(files);
    });
    return () => unsub();
  }, [selectedProjectId]);

  // Check for approved conversion requests and pending requests
  useEffect(() => {
    const checkConversionStatus = async () => {
      if (!currentUser || !id) return;

      try {
        // Check for any conversion requests (approved or pending)
        const approvalRequestsQuery = query(
          collection(db, 'approvalRequests'),
          where('entityId', '==', id),
          where('requestedBy', '==', currentUser.uid),
          where('requestType', '==', 'Customer')
        );
        
        const snapshot = await getDocs(approvalRequestsQuery);
        
        let hasApproved = false;
        let hasPending = false;
        
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.requestTitle && data.requestTitle.toLowerCase().includes('convert')) {
            if (data.status === 'approved') {
              hasApproved = true;
            } else if (data.status === 'pending') {
              hasPending = true;
            }
          }
        });
        
        setHasApprovedConversion(hasApproved);
        setHasPendingConversionRequest(hasPending);
      } catch (error) {
        console.error("Error checking conversion request status:", error);
      }
    };

    checkConversionStatus();
  }, [currentUser, id]);

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
        status: "Active", // Set as active since approval was already given
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        customerId: id, // Link to the current customer
        convertedFromCustomer: true,
        
        // Ensure project appears in ProjectList queries
        userId: currentUser.uid, // Legacy field for compatibility
        createdBy: currentUser.uid, // New field
        createdByName: currentUser.name || currentUser.displayName || currentUser.email,
        
        // Ensure current user is in team if not already
        team: projectData.team && projectData.team.length > 0 
          ? (projectData.team.includes(currentUser.uid) ? projectData.team : [...projectData.team, currentUser.uid])
          : [currentUser.uid]
      };

      const projectsCollectionRef = collection(db, "projects");
      const newProjectRef = await addDoc(projectsCollectionRef, preFilledProjectData);

      // Update the customer's projects array with the new project ID
      const customerRef = doc(db, "customerProfiles", id);
      // Save a snapshot of current pipeline data for this project tab
      const snapshot = {
        stages,
        stageData,
        currentStage,
        reminders,
        files,
        activities
      };
      await updateDoc(customerRef, {
        projects: [...projects, newProjectRef.id],
        projectSnapshots: { ...(projectSnapshots || {}), [newProjectRef.id]: snapshot }
      });
      setProjectSnapshots(prev => ({ ...(prev || {}), [newProjectRef.id]: snapshot }));

      // Move all customer draft quotes into the new project's quotes collection
      try {
        const draftsSnap = await getDocs(collection(db, 'customerProfiles', id, 'quotesDrafts'));
        const addPromises = [];
        draftsSnap.forEach(d => {
          const q = d.data() || {};
          const items = Array.isArray(q.items) ? q.items : [];
          addPromises.push(addDoc(collection(db, 'projects', newProjectRef.id, 'quotes'), {
            client: q.client || '',
            validUntil: q.validUntil || '',
            items,
            total: Number(q.total || 0),
            status: q.status || 'draft',
            createdAt: serverTimestamp(),
            movedFromCustomerId: id,
          }).then(() => deleteDoc(doc(db, 'customerProfiles', id, 'quotesDrafts', d.id))).catch(() => {}));
        });
        if (addPromises.length > 0) {
          await Promise.all(addPromises);
        }
      } catch {}

      console.log("Project created from conversion with ID:", newProjectRef.id);
      // Reset non-core panels for a clean state per requirement
      setActivities([]);
      setReminders([]);
      setFiles([]);
      // Reset stage content but keep structure
      const resetStageData = Object.fromEntries((stages || []).map(s => [s, { notes: [], tasks: [], completed: false }]));
      setStageData(resetStageData);
      await updateDoc(doc(db, 'customerProfiles', id), { activities: [], reminders: [], files: [], stageData: resetStageData });

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
        paddingTop: DESIGN_SYSTEM.spacing['2xl'],
        position: 'relative',
        zIndex: 0
      }}>

        {/* Meeting Section */}
        {(showMeeting || meetingMinimized) && (
          <div style={{
            ...getCardStyle('customers'),
            marginBottom: DESIGN_SYSTEM.spacing.lg,
            padding: 0
          }}>
            {/* Minimized bar */}
            {meetingMinimized && !showMeeting && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: DESIGN_SYSTEM.spacing.base, background: '#111827', color: '#fff', borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0` }}>
                <div>
                  Ongoing Meeting – {meetingParticipants.length} participant{meetingParticipants.length === 1 ? '' : 's'}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setMeetingMinimized(false); setShowMeeting(true); }} style={{ ...getButtonStyle('secondary', 'customers') }}>Expand</button>
                  <button onClick={() => { setMeetingMinimized(false); setShowMeeting(false); }} style={{ ...getButtonStyle('secondary', 'customers') }}>Close</button>
                </div>
              </div>
            )}
            {/* Expanded meeting */}
            {(
              (showMeeting || meetingMinimized) && (
              <div>
                {showMeeting && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: DESIGN_SYSTEM.spacing.base, background: DESIGN_SYSTEM.pageThemes.customers.gradient, color: DESIGN_SYSTEM.colors.text.inverse, borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0` }}>
                    <div>Customer Meeting</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {userHasJoinedMeeting ? (
                        <>
                          <button onClick={isTranscribing ? stopTranscription : startTranscription} style={{ ...getButtonStyle('secondary', 'customers') }}>{isTranscribing ? 'Stop Transcribe' : 'Transcribe'}</button>
                          <button onClick={handleLeaveMeeting} style={{ ...getButtonStyle('secondary', 'customers') }}>Leave</button>
                        </>
                      ) : (
                        <button onClick={handleJoinMeeting} style={{ ...getButtonStyle('secondary', 'customers') }}>Join</button>
                      )}
                      <button onClick={() => { setMeetingMinimized(true); setShowMeeting(false); }} style={{ ...getButtonStyle('secondary', 'customers') }}>Minimize</button>
                    </div>
                  </div>
                )}
                {/* Iframe stays mounted */}
                <div style={{ width: '100%', height: showMeeting ? '600px' : '1px', background: '#000' }}>
                  {userHasJoinedMeeting ? (
                    <iframe
                      title="Customer Meeting"
                      src={`https://meet.jit.si/customer-${id}-meeting`}
                      ref={meetingIframeRef}
                      style={{ width: '100%', height: '100%', border: '0', borderRadius: showMeeting ? `0 0 ${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg}` : 0, visibility: showMeeting ? 'visible' : 'hidden' }}
                      allow="camera; microphone; fullscreen; display-capture"
                    />
                  ) : (
                    showMeeting && (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>
                        Click Join to connect to the meeting
                      </div>
                    )
                  )}
                </div>
              </div>
            ))}
            {/* Transcript viewer */}
            {showMeeting && (
              <div style={{ padding: DESIGN_SYSTEM.spacing.base }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>Live Transcript</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleGenerateTranscript} style={{ ...getButtonStyle('secondary', 'customers') }}>Generate Transcript</button>
                    <button onClick={() => { setMeetingMinimized(true); setShowMeeting(false); }} style={{ ...getButtonStyle('secondary', 'customers') }}>Minimize</button>
                  </div>
                </div>
                <div style={{ border: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`, borderRadius: 8, padding: 8, background: '#fff', minHeight: 120, maxHeight: 200, overflowY: 'auto' }}>
                  {sessionTranscripts.map(line => (
                    <div key={line.id} style={{ fontSize: DESIGN_SYSTEM.typography.fontSize.sm, color: DESIGN_SYSTEM.colors.text.secondary, marginBottom: 4 }}>
                      <span style={{ color: DESIGN_SYSTEM.colors.text.secondary, marginRight: 6 }}>{new Date((line.createdAt?.seconds || 0) * 1000).toLocaleTimeString()}</span>
                      {line.text}
                    </div>
                  ))}
                  {liveTranscript && (
                    <div style={{ fontStyle: 'italic', color: DESIGN_SYSTEM.colors.text.secondary }}>{liveTranscript}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "350px 1fr 350px", 
          gap: DESIGN_SYSTEM.spacing.xl,
          width: "100%",
          maxWidth: "100%",
          overflowX: "hidden"
        }}>
        
        {/* Middle + Right: Toolbar and Project Workspace (moved up near TopBar) */}
        <div style={{ gridColumn: "2 / span 2", gridRow: "1", display: "grid", gridTemplateColumns: "1fr 350px", gap: DESIGN_SYSTEM.spacing.lg, alignItems: "start", alignSelf: 'start' }}>
          {/* Toolbar only for middle+right columns */}
          <div style={{ gridColumn: "1 / span 2", marginBottom: DESIGN_SYSTEM.spacing.sm }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: DESIGN_SYSTEM.pageThemes.customers.gradient,
              color: DESIGN_SYSTEM.colors.text.inverse,
              padding: 10,
              borderRadius: 12,
              boxShadow: DESIGN_SYSTEM.shadows.sm
            }}>
              <div style={{ fontSize: 12, opacity: 0.9 }}>Project:</div>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', minWidth: 220 }}
              >
                <option value="">No Project</option>
                {(projects || []).map(pid => (
                  <option key={pid} value={pid}>{projectNames[pid] || pid}</option>
                ))}
              </select>
              <div style={{ flex: 1 }} />
              <button
                onClick={handleToggleMeeting}
                style={{ ...getButtonStyle('secondary', 'customers'), background: 'rgba(255,255,255,0.15)', borderColor: 'transparent' }}
              >
                {(showMeeting || meetingMinimized) ? 'Close Meeting' : 'Conduct Meeting'}
              </button>
            </div>
          </div>

          {/* Project Workspace sits directly below toolbar */}
          <div style={{ gridColumn: "1 / span 2" }}>
            <ProjectWorkspacePanel
              selectedProjectId={selectedProjectId}
              projects={projects}
              projectNames={projectNames}
              files={files}
              onFileAdd={handleFileAdd}
              onFileRemove={handleFileRemove}
              onFileRename={handleFileRename}
              customerId={id}
              customerProfile={customerProfile}
              onConvertToProject={handleConvertToProject}
              onSendApprovalRequest={handleSendApprovalRequest}
              stages={stages}
              currentStage={currentStage}
              setCurrentStage={setCurrentStage}
              stageData={stageData}
              setStageData={setStageData}
              setStages={setStages}
              onStagesUpdate={handleStagesUpdate}
              hasApprovedConversion={hasApprovedConversion}
              onCreateProjectAfterApproval={handleCreateProjectAfterApproval}
              onRequestApproval={handleRequestApproval}
              customerName={getCustomerName()}
              projectSnapshots={projectSnapshots}
              customerReminders={reminders}
              onAddCustomerReminder={handleAddReminder}
              onCustomerReminderRemove={handleReminderRemove}
              customerTranscripts={meetingTranscriptsList}
            />
          </div>
        </div>

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
              <CompanyReputation 
                data={reputation} 
                companyProfile={companyProfile}
                onAiUpdate={async (val) => {
                  try {
                    const merged = { ...(reputation || {}), ...(val || {}) };
                    setReputation(merged);
                    if (id) await updateDoc(doc(db, 'customerProfiles', id), { reputation: merged });
                  } catch {}
                }}
              />
            </div>
          </div>

          {/* Company News Panel */}
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
                Latest News
              </h2>
            </div>
            <div style={{ padding: 0 }}>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                <CompanyNewsPanel companyName={companyProfile.company || companyProfile.companyName || ''} />
              </div>
            </div>
          </div>

          {/* Converted Projects Panel */}
          {/* Removed Converted Projects panel as requested */}
        </div>

        {/* Duplicate Middle+Right block removed */}
      </div>
      </div>
      
      {/* AI Actions Modal */}
      {aiModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, width: 640, maxWidth: '95vw', boxShadow: '0 10px 25px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>AI Actions</div>
              <button onClick={() => setAiModalOpen(false)} style={{ ...getButtonStyle('secondary', 'customers') }}>Close</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button onClick={async () => {
                if (!aiModalTranscriptDoc) return;
                try {
                  setAiModalLoading(true); setAiModalError('');
                  const text = aiModalTranscriptDoc.content || '';
                  const MAX_INPUT = 60000;
                  const aiText = await callGeminiForSummary(text.slice(0, MAX_INPUT));
                  const json = safeParseJson(aiText) || { summary: aiText, action_items: [] };
                  let items = Array.isArray(json.action_items) ? json.action_items : [];
                  if (!items.length) {
                    const src = (json.summary || aiText || '').split('\n')
                      .map(s => s.trim())
                      .filter(s => s && /(^- |^\d+\. |should|need to|please|action|task|todo)/i.test(s))
                      .slice(0, 10);
                    items = src.map(s => ({ title: s.replace(/^[^-\d\.\s]+/, '').trim(), description: '' }));
                  }
                  const normalizeDate = (dl) => {
                    if (!dl) return '';
                    const s = String(dl).trim().toLowerCase();
                    const fmt = (d) => {
                      const y = d.getFullYear();
                      const m = String(d.getMonth() + 1).padStart(2, '0');
                      const da = String(d.getDate()).padStart(2, '0');
                      return `${y}-${m}-${da}`;
                    };
                    const today = new Date();
                    if (/\btoday\b/.test(s)) return fmt(today);
                    if (/\b(tmr|tmrw|tmmrw|tmmr|tomor+ow?)\b/.test(s)) { const d = new Date(today); d.setDate(d.getDate() + 1); return fmt(d); }
                    if (/\byesterday\b/.test(s)) { const d = new Date(today); d.setDate(d.getDate() - 1); return fmt(d); }
                    if (/^next\s*week$/.test(s) || /\bnextweek\b/.test(s)) { const d = new Date(today); d.setDate(d.getDate() + 7); return fmt(d); }
                    const inDays = s.match(/\bin\s+(\d+)\s+days?\b/);
                    if (inDays) { const d = new Date(today); d.setDate(d.getDate() + parseInt(inDays[1], 10)); return fmt(d); }
                    const wd = s.match(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
                    if (wd) {
                      const map = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };
                      const target = map[wd[1]];
                      const d = new Date(today);
                      const cur = d.getDay();
                      let add = (target + 7 - cur) % 7; if (add === 0) add = 7; d.setDate(d.getDate() + add);
                      return fmt(d);
                    }
                    const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:[t\s](\d{2}:\d{2}))?/);
                    if (m) return m[1];
                    return '';
                  };
                  const normalized = items.map((it, idx) => {
                    const candidate = (it.title || it.name || it.task || it.action || '').toString().trim();
                    const displayTitle = candidate || (it.description || '').toString().split(/\.|;|\n/)[0].slice(0, 140) || `Action Item ${idx + 1}`;
                    const normDeadline = normalizeDate(it.deadline);
                    return { id: String(idx), displayTitle, ...it, deadline: normDeadline || it.deadline || '' };
                  });
                  setAiModalItems(normalized);
                } catch (e) {
                  setAiModalError(e.message || 'Failed to analyze transcript.');
                } finally {
                  setAiModalLoading(false);
                }
              }} style={{ ...getButtonStyle('secondary', 'customers') }}>Analyze</button>
              <select value={aiModalTarget} onChange={(e) => setAiModalTarget(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 8px' }}>
                <option value="reminders">Add to Reminders</option>
                <option value="notes">Add to Notes</option>
              </select>
              <button disabled={aiModalLoading || aiModalItems.length === 0} onClick={async () => {
                try {
                  setAiModalLoading(true); setAiModalError('');
                  const selected = aiModalItems.filter(it => aiModalSelection[it.id]);
                  if (selected.length === 0) { setAiModalLoading(false); return; }
                  if (aiModalTarget === 'reminders') {
                    // Map to reminders array on customer profile
                    const parseDeadline = (dl) => {
                      if (!dl) return { date: '', time: '' };
                      const s = String(dl).trim().toLowerCase();
                      const fmt = (d) => {
                        const y = d.getFullYear();
                        const m = String(d.getMonth() + 1).padStart(2, '0');
                        const da = String(d.getDate()).padStart(2, '0');
                        return { date: `${y}-${m}-${da}`, time: '' };
                      };
                      const today = new Date();
                      if (/\btoday\b/.test(s)) return fmt(today);
                      if (/\b(tmr|tmrw|tmmrw|tmmr|tomor+ow?)\b/.test(s)) { const d = new Date(today); d.setDate(d.getDate() + 1); return fmt(d); }
                      if (/\byesterday\b/.test(s)) { const d = new Date(today); d.setDate(d.getDate() - 1); return fmt(d); }
                      if (/^next\s*week$/.test(s) || /\bnextweek\b/.test(s)) { const d = new Date(today); d.setDate(d.getDate() + 7); return fmt(d); }
                      const inDays = s.match(/\bin\s+(\d+)\s+days?\b/);
                      if (inDays) { const d = new Date(today); d.setDate(d.getDate() + parseInt(inDays[1], 10)); return fmt(d); }
                      const wd = s.match(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
                      if (wd) {
                        const map = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };
                        const target = map[wd[1]];
                        const d = new Date(today);
                        const cur = d.getDay();
                        let add = (target + 7 - cur) % 7; if (add === 0) add = 7; d.setDate(d.getDate() + add);
                        return fmt(d);
                      }
                      const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:[t\s](\d{2}:\d{2}))?/);
                      if (m) return { date: m[1], time: m[2] || '' };
                      return { date: '', time: '' };
                    };
                    const base = Array.isArray(reminders) ? [...reminders] : [];
                    const newRems = selected.map((it, idx) => {
                      const { date, time } = parseDeadline(it.deadline);
                      const finalDate = date || new Date().toISOString().slice(0,10);
                      return {
                        title: (it.displayTitle || it.title || it.name || `Reminder ${idx + 1}`).toString(),
                        description: it.description || '',
                        date: finalDate,
                        time: time || ''
                      };
                    });
                    const next = [...base, ...newRems];
                    setReminders(next);
                    if (id) await updateDoc(doc(db, 'customerProfiles', id), { reminders: next });
                    // Write notifications for each added reminder
                    try {
                      for (let r of newRems) {
                        await addDoc(collection(db, 'users', currentUser.uid, 'notifications'), {
                          unread: true,
                          createdAt: serverTimestamp(),
                          origin: 'customer',
                          title: 'New Customer Reminder',
                          message: `${getCustomerName()}: ${r.title} on ${r.date}${r.time ? ' ' + r.time : ''}`,
                          refType: 'customerReminder',
                          customerId: id
                        });
                      }
                    } catch {}
                    setAiModalOpen(false);
                  } else {
                    // Add to current stage notes
                    const baseStage = stageData[currentStage] || { notes: [], tasks: [], completed: false };
                    const newNotes = selected.map((it) => ({ type: 'Meeting', text: ((it.displayTitle || it.title || it.name || 'Note').toString() + (it.description ? ` – ${it.description}` : '')), createdAt: Date.now() }));
                    const updatedStage = { ...stageData, [currentStage]: { ...baseStage, notes: [...(baseStage.notes || []), ...newNotes] } };
                    setStageData(updatedStage);
                    // Persist via updateDoc directly
                    if (id) await updateDoc(doc(db, 'customerProfiles', id), { stageData: updatedStage });
                    setAiModalOpen(false);
                  }
                } catch (e) {
                  setAiModalError(e.message || 'Failed to add items.');
                } finally {
                  setAiModalLoading(false);
                }
              }} style={{ ...getButtonStyle('primary', 'customers') }}>Add Selected</button>
            </div>
            {aiModalError && <div style={{ color: '#b91c1c', marginBottom: 8 }}>{aiModalError}</div>}
            <div style={{ maxHeight: 320, overflowY: 'auto', border: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`, borderRadius: 8, padding: 8, background: '#fff' }}>
              {aiModalLoading ? (
                <div style={{ color: DESIGN_SYSTEM.colors.text.secondary }}>Analyzing…</div>
              ) : aiModalItems.length === 0 ? (
                <div style={{ color: DESIGN_SYSTEM.colors.text.secondary }}>Click Analyze to extract action items from the transcript.</div>
              ) : (
                aiModalItems.map(item => (
                  <label key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 6 }}>
                    <input type="checkbox" checked={!!aiModalSelection[item.id]} onChange={(e) => setAiModalSelection(s => ({ ...s, [item.id]: e.target.checked }))} />
                    <div>
                      <div style={{ fontWeight: 600 }}>{(item.displayTitle || item.title || item.name || item.task || item.action || 'Untitled').toString()}</div>
                      {item.description && <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>{item.description}</div>}
                      {item.assignee && <div style={{ fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>Assignee: {item.assignee}</div>}
                      {item.deadline && <div style={{ fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>Deadline: {item.deadline}</div>}
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      
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
        onConfirm={handleSaveProjectFromConversion}
      />

      <AdvancedApprovalRequestModal
        isOpen={showAdvancedApprovalModal}
        onClose={() => setShowAdvancedApprovalModal(false)}
        onSuccess={handleApprovalRequestSuccess}
        customerId={id}
        customerName={`${customerProfile.firstName || ''} ${customerProfile.lastName || ''}`.trim() || companyProfile.companyName || 'Unknown Customer'}
        currentUser={currentUser}
        currentStage={currentStage}
        nextStage={stages[stages.indexOf(currentStage) + 1] || ""}
        isStageAdvancement={approvalModalType === 'stage'}
      />

      <AdvancedApprovalRequestModal
        isOpen={showProjectConversionApprovalModal}
        onClose={() => setShowProjectConversionApprovalModal(false)}
        onSuccess={handleProjectConversionApprovalSuccess}
        customerId={id}
        customerName={`${customerProfile.firstName || ''} ${customerProfile.lastName || ''}`.trim() || companyProfile.companyName || 'Unknown Customer'}
        currentUser={currentUser}
        currentStage=""
        nextStage=""
        isStageAdvancement={false}
      />
    </div>
  );
}
