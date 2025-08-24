import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import TopBar from '../components/TopBar';
import ProjectDetails from '../components/project-component/ProjectDetails';
import Reminders from '../components/project-component/Reminders';
import ProjectTaskPanel from '../components/project-component/ProjectTaskPanel';
import ProjectGroupForum from '../components/ProjectGroupForum';
import StageIndicator from '../components/project-component/StageIndicator';
import ApprovalModal from '../components/project-component/ApprovalModal';
import AdvanceStageChoiceModal from '../components/project-component/AdvanceStageChoiceModal';
import SendApprovalModal from '../components/project-component/SendApprovalModal';
import AdvancedApprovalRequestModal from '../components/project-component/AdvancedApprovalRequestModal';
import AddTeamMemberModal from '../components/project-component/AddTeamMemberModal';
import TeamMembersPanel from '../components/project-component/TeamMembersPanel';
import { db } from "../firebase";
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot, getDocs, arrayUnion, arrayRemove, addDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { useAuth } from '../contexts/AuthContext';
import { DESIGN_SYSTEM, getPageContainerStyle, getCardStyle, getContentContainerStyle, getButtonStyle } from '../styles/designSystem';

const DEFAULT_STAGES = ["Planning", "Development", "Testing", "Completed"];

export default function ProjectDetail() {
  const { projectId } = useParams(); // Changed from projectName to projectId
  const location = useLocation();
  const autoOpenReminderId = React.useMemo(() => {
    try {
      const sp = new URLSearchParams(location.search);
      return sp.get('reminderId') || null;
    } catch { return null; }
  }, [location.search]);
  const [projectData, setProjectData] = useState(null);
  const [projectStages, setProjectStages] = useState(DEFAULT_STAGES);
  const [currentStage, setCurrentStage] = useState(DEFAULT_STAGES[0]);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showAdvanceChoiceModal, setShowAdvanceChoiceModal] = useState(false);
  const [showSendApprovalModal, setShowSendApprovalModal] = useState(false);
  const [showAdvancedApprovalModal, setShowAdvancedApprovalModal] = useState(false);
  const [approvalModalType, setApprovalModalType] = useState('stage'); // 'stage' or 'general'
  const [projectForums, setProjectForums] = useState([]); // State to hold project-specific forums
  const { currentUser } = useAuth(); // Get current user from AuthContext
  const [currentApproval, setCurrentApproval] = useState(null); // State to hold the current approval request
  const [showAddTeamMemberModal, setShowAddTeamMemberModal] = useState(false); // New state for add team member modal
  const [allProjectNames, setAllProjectNames] = useState([]); // New state to store all project names
  const [projectTeamMembersDetails, setProjectTeamMembersDetails] = useState([]); // State for enriched team member details
  // Stage editor state
  const [isEditingStages, setIsEditingStages] = useState(false);
  const [workingStages, setWorkingStages] = useState([]);
  const [showStageSelectModal, setShowStageSelectModal] = useState(false);
  const [stageSelectOptions, setStageSelectOptions] = useState([]);
  const [showDeleteStageConfirm, setShowDeleteStageConfirm] = useState(false);
  const [deleteStageIndex, setDeleteStageIndex] = useState(null);
  const [deleteStageName, setDeleteStageName] = useState("");

  // Meeting state
  const [showMeeting, setShowMeeting] = useState(false);
  const [meetingMinimized, setMeetingMinimized] = useState(false);
  const [meetingParticipants, setMeetingParticipants] = useState([]);
  const [suppressMeetingBar, setSuppressMeetingBar] = useState(false);
  const userHasJoinedMeeting = meetingParticipants.includes(currentUser?.uid || "");

  // Meeting session + transcription
  const [meetingSessionId, setMeetingSessionId] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const recognitionRef = useRef(null);
  const [sessionTranscripts, setSessionTranscripts] = useState([]);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [meetingSummary, setMeetingSummary] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const lastInterimSaveRef = useRef(0);
  const meetingSessionIdRef = useRef(null);
  const transcriptBufferRef = useRef("");
  const pendingInterimRef = useRef("");
  const restartTimeoutRef = useRef(null);
  const restartAttemptsRef = useRef(0);

  const clearRestartTimer = () => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
  };

  const resetRestartBackoff = () => {
    restartAttemptsRef.current = 0;
    clearRestartTimer();
  };

  const scheduleRestart = (initialDelay = 300) => {
    clearRestartTimer();
    const attempts = restartAttemptsRef.current;
    const delay = Math.min(5000, Math.max(200, initialDelay * Math.pow(2, attempts)));
    restartTimeoutRef.current = setTimeout(() => {
      restartAttemptsRef.current = Math.min(attempts + 1, 7);
      startTranscription().catch(() => {});
    }, delay);
  };

  const [meetingTranscriptsList, setMeetingTranscriptsList] = useState([]);
  const meetingIframeRef = useRef(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiModalLoading, setAiModalLoading] = useState(false);
  const [aiModalError, setAiModalError] = useState("");
  const [aiModalItems, setAiModalItems] = useState([]);
  const [aiModalTarget, setAiModalTarget] = useState('tasks'); // 'tasks' | 'reminders'
  const [aiModalSelection, setAiModalSelection] = useState({});
  const [aiModalTranscriptDoc, setAiModalTranscriptDoc] = useState(null);

  useEffect(() => {
    meetingSessionIdRef.current = meetingSessionId;
  }, [meetingSessionId]);

  useEffect(() => {
    if (meetingSessionId) {
      const sub = onSnapshot(collection(db, 'meetingSessions', meetingSessionId, 'transcripts'), (snap) => {
        const lines = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b)=> (a.createdAt?.seconds||0)-(b.createdAt?.seconds||0));
        setSessionTranscripts(lines);
      });
      return () => sub();
    } else {
      setSessionTranscripts([]);
    }
  }, [meetingSessionId]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && isTranscribing && !recognitionRef.current) {
        scheduleRestart(300);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [isTranscribing]);

  const startTranscription = async () => {
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { alert('Transcription not supported in this browser. Try Chrome.'); return; }
      if (!meetingSessionIdRef.current) {
        const ref = await addDoc(collection(db, 'meetingSessions'), { projectId, startedAt: serverTimestamp(), participants: meetingParticipants });
        meetingSessionIdRef.current = ref.id;
        setMeetingSessionId(ref.id);
      }
      const rec = new SR();
      recognitionRef.current = rec;
      rec.lang = 'en-US';
      rec.interimResults = true;
      rec.continuous = true;
      rec.maxAlternatives = 1;
      rec.onresult = async (e) => {
        let finalText = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) {
            finalText += t + ' ';
          } else {
            setLiveTranscript(t);
            pendingInterimRef.current = t;
            // Throttle-save interim segments so we don't lose context
            const now = Date.now();
            const sessionId = meetingSessionIdRef.current;
            if (sessionId && t && t.trim().length > 0 && now - (lastInterimSaveRef.current || 0) > 2500) {
              try {
                await addDoc(collection(db, 'meetingSessions', sessionId, 'transcripts'), {
                  text: t.trim(),
                  userId: currentUser?.uid || 'anon',
                  createdAt: serverTimestamp()
                });
                lastInterimSaveRef.current = now;
              } catch {}
            }
          }
        }
        if (finalText.trim()) {
          // Append to local buffer for robust summarization
          transcriptBufferRef.current = `${transcriptBufferRef.current} ${finalText.trim()}`.trim();
          const sessionId = meetingSessionIdRef.current;
          if (sessionId) {
            await addDoc(collection(db, 'meetingSessions', sessionId, 'transcripts'), {
              text: finalText.trim(),
              userId: currentUser?.uid || 'anon',
              createdAt: serverTimestamp()
            });
          }
          setLiveTranscript('');
          pendingInterimRef.current = '';
        }
      };
      rec.onerror = (e) => {
        console.warn('SpeechRecognition error', e);
        if (!isTranscribing) return;
        // Handle common cases: no-speech, audio-capture, not-allowed
        switch (e.error) {
          case 'no-speech':
          case 'audio-capture':
          case 'network':
            scheduleRestart(400);
            break;
          case 'not-allowed':
          case 'service-not-allowed':
            // Permission denied; require user gesture
            // Do not auto-retry aggressively
            scheduleRestart(1500);
            break;
          default:
            scheduleRestart(600);
        }
      };
      rec.onend = () => {
        if (!isTranscribing) return;
        scheduleRestart(300);
      };
      // Keep continuous; do not force stop so partials remain until summary
      rec.start();
      setIsTranscribing(true);
      resetRestartBackoff();
    } catch (e) {
      console.error(e);
      alert('Failed to start transcription.');
    }
  };

  const stopTranscription = async () => {
    setIsTranscribing(false);
    try { recognitionRef.current && recognitionRef.current.stop(); } catch {}
    try { recognitionRef.current && recognitionRef.current.abort && recognitionRef.current.abort(); } catch {}
    recognitionRef.current = null;
    // Clear any pending auto-restart timers
    clearRestartTimer();
    if (meetingSessionId) {
      await updateDoc(doc(db, 'meetingSessions', meetingSessionId), { endedAt: serverTimestamp() });
    }
  };

  // No periodic flush; keep interim until summary per request

  // Generate AI meeting summary and auto-create tasks
  const callGeminiForSummary = async (promptText) => {
    const key = localStorage.getItem('gemini_api_key');
    if (!key) throw new Error('Missing GEMINI API key. Please set it in the Personal Assistant.');
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=' + encodeURIComponent(key);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `You are a meeting assistant. Given the raw transcript, return JSON with keys: summary (string) and action_items (array of objects with title (string), assignee (optional), deadline (optional YYYY-MM-DD or natural language)).\nTranscript:\n${promptText}` }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1500 }
      })
    });
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text;
  };

  const safeParseJson = (text) => {
    try {
      // try to extract JSON block if wrapped in extra text
      const match = text.match(/\{[\s\S]*\}/);
      const raw = match ? match[0] : text;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const generateTranscriptOnly = async () => {
    try {
      setIsSummarizing(true);
      setSummaryError("");
      // Force restart flow regardless of prior state for reliability
      const wasTranscribing = true;
      // Pause recognition during summary to avoid overlap
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      if (liveTranscript && liveTranscript.trim().length > 0) {
        if (meetingSessionId) {
          await addDoc(collection(db, 'meetingSessions', meetingSessionId, 'transcripts'), {
            text: liveTranscript.trim(),
            userId: currentUser?.uid || 'anon',
            createdAt: serverTimestamp()
          });
        }
        transcriptBufferRef.current = `${transcriptBufferRef.current} ${liveTranscript.trim()}`.trim();
        setLiveTranscript('');
      }
      const firestoreText = sessionTranscripts.map(t => `${new Date((t.createdAt?.seconds||0)*1000).toLocaleTimeString()} ${t.text}`).join('\n');
      const bufferedText = transcriptBufferRef.current;
      const combined = [firestoreText, bufferedText].filter(Boolean).join('\n');
      const transcriptText = combined.trim();
      if (!transcriptText.trim()) { alert('No transcript available.'); setIsSummarizing(false); return; }

      // Save full transcript as a file record under project
      const fileName = `meeting-transcript-${new Date().toISOString().replace(/[:.]/g,'-')}.txt`;
      await addDoc(collection(db, 'projects', projectId, 'meetingTranscripts'), {
        name: fileName,
        mimeType: 'text/plain',
        size: transcriptText.length,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.uid || 'anon',
        content: transcriptText
      });

      if (meetingSessionId) {
        try {
          await Promise.all(sessionTranscripts.map(line => deleteDoc(doc(db, 'meetingSessions', meetingSessionId, 'transcripts', line.id))));
          setSessionTranscripts([]);
        } catch {}
      }
      transcriptBufferRef.current = '';
      pendingInterimRef.current = '';
      setLiveTranscript('');
      // If it was transcribing before, resume immediately
      try {
        // small delay to let mic release on some browsers
        await new Promise(r => setTimeout(r, 200));
        await startTranscription();
      } catch {}
    } catch (e) {
      console.error(e);
      setSummaryError(e.message || 'Failed to generate summary.');
    } finally {
      setIsSummarizing(false);
    }
  };

  useEffect(() => {
    const fetchProject = async () => {
      console.log("Fetching project with projectId:", projectId); // Added console.log
      if (projectId) {
        const docRef = doc(db, "projects", projectId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() };
          setProjectData(data);
          setProjectStages(data.stages && Array.isArray(data.stages) && data.stages.length > 0 ? data.stages : DEFAULT_STAGES);
          setCurrentStage(data.stage || (data.stages && data.stages[0]) || DEFAULT_STAGES[0]);
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
        where("status", "==", "pending")
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const pendingApprovals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCurrentApproval(pendingApprovals.length > 0 ? pendingApprovals[0] : null);
      });
      return () => unsubscribe();
    }
  }, [projectId, currentStage]);

  useEffect(() => {
    if (projectData) {
    const filteredTasks = (projectData.tasks || []).filter(section => section.stage === currentStage);
    setProjectTasks(filteredTasks);
      setProjectReminders(projectData.reminders || []);
      setProjectDetails(projectData);
    }
  }, [projectData, currentStage]);

  // Initialize states with projectData or empty arrays if projectData is null
  const [projectTasks, setProjectTasks] = useState([]);
  const [projectReminders, setProjectReminders] = useState([]);
  const [projectDetails, setProjectDetails] = useState(null);

  const handleAdvanceStage = async () => {
    const currentStageIndex = projectStages.indexOf(currentStage);
    if (currentStageIndex < projectStages.length - 1) {
      const allTasksCompleteInCurrentStage = projectTasks.every(section => 
        section.tasks.every(task => task.status === 'complete')
      );

      if (allTasksCompleteInCurrentStage) {
        // Use advanced approval modal for stage advancement
        setApprovalModalType('stage');
        setShowAdvancedApprovalModal(true);
      } else {
        alert("All tasks in the current stage must be marked as 'Complete' before advancing.");
      }
    }
  };

  const handleSendApprovalRequest = () => {
    setApprovalModalType('general');
    setShowAdvancedApprovalModal(true);
  };

  const handleApprovalRequestSuccess = (result) => {
    console.log(`Project approval request sent for ${result.entityName}`);
    // Could add notification or other success handling here
  };

  const handleConfirmAdvanceStage = async () => {
    const currentStageIndex = projectStages.indexOf(currentStage);
    const nextStage = projectStages[currentStageIndex + 1];
    if (projectData && projectData.id) {
      const projectRef = doc(db, "projects", projectData.id);
      await updateDoc(projectRef, { stage: nextStage });
      setCurrentStage(nextStage);
    setShowApprovalModal(false);
      // alert(`Advancing to next stage: ${nextStage}`);
    }
  };

  const handleAdvanceChoice = (requireApproval) => {
    setShowAdvanceChoiceModal(false);
    if (requireApproval) {
      setShowApprovalModal(true);
    } else {
      handleConfirmAdvanceStage();
    }
  };


  const handleStageSelect = async (stage) => {
    if (projectData && projectData.id) {
      const projectRef = doc(db, "projects", projectData.id);
      await updateDoc(projectRef, { stage: stage });
    setCurrentStage(stage);
    }
  };

  // Stage editing handlers (edit mode working copy)
  const enterEditStages = () => {
    setWorkingStages(projectStages);
    setIsEditingStages(true);
  };

  const cancelEditStages = () => {
    setIsEditingStages(false);
    setWorkingStages(projectStages);
  };

  const handleAddStage = () => {
    const newStageName = `Stage ${workingStages.length + 1}`;
    setWorkingStages(prev => [...prev, newStageName]);
  };

  const handleDeleteStageAt = (index) => {
    if (workingStages.length <= 1) return;
    const stageName = workingStages[index];
    const hasContent = (projectData?.tasks || []).some(section => section.stage === stageName && ((section.tasks && section.tasks.length > 0) || (section.notes && section.notes.length > 0)));
    if (hasContent) {
      setDeleteStageIndex(index);
      setDeleteStageName(stageName);
      setShowDeleteStageConfirm(true);
      return;
    }
    const next = workingStages.filter((_, i) => i !== index);
    setWorkingStages(next);
  };

  const handleRenameStageAt = (index, newName) => {
    if (!newName || !newName.trim()) return;
    const trimmed = newName.trim();
    const duplicate = workingStages.some((s, i) => i !== index && s === trimmed);
    if (duplicate) return;
    const next = workingStages.map((s, i) => (i === index ? trimmed : s));
    setWorkingStages(next);
  };

  const handleMoveStageLeft = (index) => {
    if (index <= 0) return;
    const next = [...workingStages];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setWorkingStages(next);
  };

  const handleMoveStageRight = (index) => {
    if (index >= workingStages.length - 1) return;
    const next = [...workingStages];
    [next[index + 1], next[index]] = [next[index], next[index + 1]];
    setWorkingStages(next);
  };

  const handleSaveStages = async () => {
    const newStages = [...workingStages];
    const newCurrent = newStages[0];
    // Remove tasks that belong to deleted stages
    const filteredTaskSections = (projectData?.tasks || []).filter(section => newStages.includes(section.stage));
    if (projectData?.id) {
      await updateDoc(doc(db, 'projects', projectData.id), { stages: newStages, stage: newCurrent, tasks: filteredTaskSections });
    }
    setProjectStages(newStages);
    setCurrentStage(newCurrent);
    setProjectData(prev => prev ? { ...prev, stages: newStages, stage: newCurrent, tasks: filteredTaskSections } : prev);
    setIsEditingStages(false);
    setStageSelectOptions(newStages);
    setShowStageSelectModal(true);
  };

  const handleGoBackStage = async () => {
    const currentStageIndex = projectStages.indexOf(currentStage);
    if (currentStageIndex > 0) {
      const prevStage = projectStages[currentStageIndex - 1];
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
    projectStages.indexOf(currentStage) < projectStages.length - 1 &&
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

    if (true) {
      try {
        const projectRef = doc(db, "projects", projectData.id);
        await updateDoc(projectRef, {
          team: projectData.team.filter(uid => uid !== memberUid)
        });
        setProjectData(prevData => ({ 
          ...prevData, 
          team: prevData.team.filter(uid => uid !== memberUid) 
        }));
        const popup = document.createElement('div');
        popup.textContent = 'Team member removed';
        popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:20px;border-radius:8px;box-shadow:0 10px 25px rgba(0,0,0,0.15);z-index:1100;color:#ef4444;font-weight:600';
        document.body.appendChild(popup);
        setTimeout(() => document.body.removeChild(popup), 1200);
      } catch (error) {
        console.error("Error removing team member:", error);
        alert("Failed to remove team member.");
      }
    }
  };

  // Live meeting participants
  useEffect(() => {
    if (!projectId) return;
    const projectRef = doc(db, 'projects', projectId);
    const unsub = onSnapshot(projectRef, snap => {
      const data = snap.data();
      setMeetingParticipants(data?.meetingParticipants || []);
      // show minimized bar if meeting has participants
      if ((data?.meetingParticipants || []).length > 0 && !showMeeting && !suppressMeetingBar) {
        setMeetingMinimized(true);
      }
    });
    return () => unsub();
  }, [projectId, showMeeting, suppressMeetingBar]);

  // Meeting transcripts list for project
  useEffect(() => {
    if (!projectId) { setMeetingTranscriptsList([]); return; }
    const colRef = collection(db, 'projects', projectId, 'meetingTranscripts');
    const unsub = onSnapshot(colRef, snap => {
      const files = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
      setMeetingTranscriptsList(files);
    });
    return () => unsub();
  }, [projectId]);

  const handleJoinMeeting = async () => {
    if (!currentUser || !projectId) return;
    const projectRef = doc(db, 'projects', projectId);
    await updateDoc(projectRef, {
      meetingParticipants: arrayUnion(currentUser.uid)
    });
    setShowMeeting(true);
    setMeetingMinimized(false);
    setSuppressMeetingBar(false);
    // Create new session when user joins if none
    if (!meetingSessionId) {
      const ref = await addDoc(collection(db, 'meetingSessions'), { projectId, startedAt: serverTimestamp(), participants: [currentUser.uid] });
      setMeetingSessionId(ref.id);
    }
  };

  const handleLeaveMeeting = async () => {
    if (!currentUser || !projectId) return;
    const projectRef = doc(db, 'projects', projectId);
    await updateDoc(projectRef, {
      meetingParticipants: arrayRemove(currentUser.uid)
    });
    if (isTranscribing) await stopTranscription();
    if (meetingSessionId) await updateDoc(doc(db, 'meetingSessions', meetingSessionId), { endedAt: serverTimestamp() });
  };

  const handleToggleMeeting = async () => {
    if (!showMeeting && !meetingMinimized) {
      // open panel
      setShowMeeting(true);
      setMeetingMinimized(false);
      setSuppressMeetingBar(false);
      return;
    }
    // close panel but keep session alive only if minimized
    if (userHasJoinedMeeting) {
      await handleLeaveMeeting();
    }
    // ensure mic/transcription is stopped when closing the panel
    try { await stopTranscription(); } catch {}
    // Force release media from iframe
    try { if (meetingIframeRef.current) { meetingIframeRef.current.src = 'about:blank'; } } catch {}
    setShowMeeting(false);
    setMeetingMinimized(false);
    setSuppressMeetingBar(true);
    // Also close any forum meeting if linked and user is joined there
    try {
      if (projectForums && projectForums.length > 0 && currentUser?.uid) {
        for (const forum of projectForums) {
          if (forum?.id) {
            await updateDoc(doc(db, 'forums', forum.id), { meetingParticipants: arrayRemove(currentUser.uid) });
          }
        }
      }
    } catch {}
  };

  if (!projectData) {
    return (
      <div style={getPageContainerStyle()}>
        <TopBar />
        <div style={{ textAlign: "center", padding: "50px", color: DESIGN_SYSTEM.colors.text.secondary }}>
          Loading project details...
        </div>
      </div>
    );
  }

  return (
    <div style={getPageContainerStyle()}>
      <TopBar />
      
      {/* Pending Approval Overlay */}
      {projectData?.pendingApproval && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: DESIGN_SYSTEM.colors.background.primary,
            borderRadius: DESIGN_SYSTEM.borderRadius.xl,
            padding: DESIGN_SYSTEM.spacing.xl,
            textAlign: 'center',
            maxWidth: '500px',
            width: '90%',
            boxShadow: DESIGN_SYSTEM.shadows.xl
          }}>
            <div style={{
              fontSize: '48px',
              marginBottom: DESIGN_SYSTEM.spacing.base
            }}>
              ⏳
            </div>
            <h2 style={{
              margin: `0 0 ${DESIGN_SYSTEM.spacing.base} 0`,
              fontSize: DESIGN_SYSTEM.typography.fontSize['2xl'],
              fontWeight: DESIGN_SYSTEM.typography.fontWeight.bold,
              color: DESIGN_SYSTEM.colors.text.primary
            }}>
              Waiting for Approval
            </h2>
            <p style={{
              margin: `0 0 ${DESIGN_SYSTEM.spacing.lg} 0`,
              fontSize: DESIGN_SYSTEM.typography.fontSize.base,
              color: DESIGN_SYSTEM.colors.text.secondary,
              lineHeight: 1.6
            }}>
              This project was converted from a customer profile and is pending approval. 
              Only the project details are available until the approval is complete.
            </p>
            <div style={{
              padding: DESIGN_SYSTEM.spacing.base,
              backgroundColor: DESIGN_SYSTEM.colors.background.secondary,
              borderRadius: DESIGN_SYSTEM.borderRadius.base,
              border: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`
            }}>
              <p style={{
                margin: 0,
                fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                color: DESIGN_SYSTEM.colors.text.tertiary
              }}>
                <strong>Project:</strong> {projectData?.name || 'Unnamed Project'}
              </p>
              {projectData?.customerProfile && (
                <p style={{
                  margin: `${DESIGN_SYSTEM.spacing.xs} 0 0 0`,
                  fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                  color: DESIGN_SYSTEM.colors.text.tertiary
                }}>
                  <strong>Converted from:</strong> {projectData.customerProfile.firstName} {projectData.customerProfile.lastName}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      
      <div style={{
        ...getContentContainerStyle(),
        paddingTop: DESIGN_SYSTEM.spacing['2xl'],
        opacity: projectData?.pendingApproval ? 0.3 : 1,
        pointerEvents: projectData?.pendingApproval ? 'none' : 'auto'
      }}>
        {/* Project Header - single line summary */}
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
            alignItems: "center",
            gap: DESIGN_SYSTEM.spacing.base,
            whiteSpace: "nowrap"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: DESIGN_SYSTEM.spacing.base, overflow: "hidden" }}>
              <span style={{
                fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.bold,
                overflow: "hidden",
                textOverflow: "ellipsis"
              }} title={projectData?.name || 'Project Details'}>
                {projectData?.name || 'Project Details'}
              </span>
              <span style={{ opacity: 0.85 }}>|</span>
              <span style={{ fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>Members: {projectData?.team?.length || 0}</span>
              <span style={{ opacity: 0.85 }}>|</span>
              <span style={{ fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>Stage: {projectData?.stage || currentStage}</span>
              <span style={{ opacity: 0.85 }}>|</span>
              <span style={{ fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>Deadline: {projectData?.deadline || 'No deadline'}</span>
            </div>
            <div style={{ display: "flex", gap: DESIGN_SYSTEM.spacing.base, flexShrink: 0 }}>
              <button
                onClick={handleToggleMeeting}
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
                {(showMeeting || meetingMinimized) ? 'Close Meeting' : 'Conduct Meeting'}
              </button>
            </div>
          </div>
        </div>

        {/* Meeting Section */}
        {(showMeeting || meetingMinimized) && (
          <div style={{
            ...getCardStyle('projects'),
            padding: 0,
            marginBottom: DESIGN_SYSTEM.spacing.lg,
          }}>
            {/* Minimized bar */}
            {meetingMinimized && !showMeeting && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: DESIGN_SYSTEM.spacing.base, background: '#111827', color: '#fff', borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0` }}>
                <div>
                  Ongoing Meeting – {meetingParticipants.length} participant{meetingParticipants.length === 1 ? '' : 's'}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowMeeting(true)} style={{ ...getButtonStyle('secondary', 'projects') }}>Expand</button>
                </div>
              </div>
            )}
            {/* Expanded meeting */}
            {(
              (showMeeting || meetingMinimized) && (
              <div>
                  {showMeeting && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: DESIGN_SYSTEM.spacing.base, background: DESIGN_SYSTEM.pageThemes.projects.gradient, color: DESIGN_SYSTEM.colors.text.inverse, borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0` }}>
                  <div>Project Meeting</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {userHasJoinedMeeting ? (
                          <>
                            <button onClick={isTranscribing ? stopTranscription : startTranscription} style={{ ...getButtonStyle('secondary', 'projects') }}>{isTranscribing ? 'Stop Transcribe' : 'Transcribe'}</button>
                      <button onClick={handleLeaveMeeting} style={{ ...getButtonStyle('secondary', 'projects') }}>Leave</button>
                          </>
                    ) : (
                      <button onClick={handleJoinMeeting} style={{ ...getButtonStyle('secondary', 'projects') }}>Join</button>
                    )}
                    <button onClick={() => { setMeetingMinimized(true); setShowMeeting(false); }} style={{ ...getButtonStyle('secondary', 'projects') }}>Minimize</button>
                  </div>
                </div>
                  )}
                  {/* Iframe stays mounted in minimized state to keep session alive */}
                  <div style={{ width: '100%', height: showMeeting ? '600px' : '1px', background: '#000' }}>
                  {userHasJoinedMeeting ? (
                    <iframe
                      title="Project Meeting"
                      src={`https://meet.jit.si/project-${projectId}-meeting`}
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
                  {/* Transcript viewer */}
                  {showMeeting && (
                    <div style={{ padding: DESIGN_SYSTEM.spacing.base, background: '#f8fafc', borderTop: `1px solid ${DESIGN_SYSTEM.colors.border}` }}>
                      <div style={{ fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold, marginBottom: DESIGN_SYSTEM.spacing.xs }}>Transcript</div>
                      <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: DESIGN_SYSTEM.typography.fontSize.sm, color: DESIGN_SYSTEM.colors.text.primary, background: '#fff', border: `1px solid ${DESIGN_SYSTEM.colors.border}`, borderRadius: DESIGN_SYSTEM.borderRadius.lg, padding: DESIGN_SYSTEM.spacing.base }}>
                        {sessionTranscripts.map((line) => (
                          <div key={line.id} style={{ marginBottom: 6 }}>
                            <span style={{ color: DESIGN_SYSTEM.colors.text.secondary, marginRight: 6 }}>{new Date((line.createdAt?.seconds || 0) * 1000).toLocaleTimeString()}</span>
                            {line.text}
              </div>
                        ))}
                        {liveTranscript && (
                          <div style={{ opacity: 0.7 }}>{liveTranscript}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: DESIGN_SYSTEM.spacing.xs }}>
                        <button onClick={generateTranscriptOnly} disabled={isSummarizing} style={{ ...getButtonStyle('primary', 'projects'), padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.base}` }}>{isSummarizing ? 'Saving…' : 'Generate Transcript'}</button>
                        {summaryError && <span style={{ color: '#ef4444', fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>{summaryError}</span>}
                      </div>
                      {meetingSummary && (
                        <div style={{ marginTop: DESIGN_SYSTEM.spacing.xs, background: '#fff', border: `1px solid ${DESIGN_SYSTEM.colors.border}`, borderRadius: DESIGN_SYSTEM.borderRadius.lg, padding: DESIGN_SYSTEM.spacing.base }}>
                          <div style={{ fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold, marginBottom: 6 }}>Summary</div>
                          <div style={{ whiteSpace: 'pre-wrap' }}>{meetingSummary}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}

      <div style={{
        display: "grid",
          gridTemplateColumns: "380px 1fr",
          gridTemplateRows: "1fr",
          gap: DESIGN_SYSTEM.spacing.xl,
          minHeight: "calc(100vh - 300px)"
      }}>
        {/* Left Column */}
        <div style={{ 
          display: "flex", 
          flexDirection: "column", 
          gap: DESIGN_SYSTEM.spacing.lg,
          gridColumn: 1, 
          gridRow: 1,
          maxHeight: "90vh",
          overflowY: "auto"
        }}>
          {/* Project Details Card */}
          <div style={{
            ...getCardStyle('projects'),
            flexShrink: 0
          }}>
            <div style={{
              background: DESIGN_SYSTEM.pageThemes.projects.gradient,
              color: DESIGN_SYSTEM.colors.text.inverse,
              padding: DESIGN_SYSTEM.spacing.base,
              borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`
            }}>
              <h3 style={{
                margin: 0,
                fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold
              }}>
                Project Details
              </h3>
            </div>
            <div style={{ padding: 0 }}>
          <ProjectDetails 
            project={projectDetails} 
            onSave={handleSaveEditedProjectDetails}
                allProjectNames={allProjectNames}
                readOnly={false}
              />
            </div>
          </div>
          
          {/* Reminders Section */}
          <div style={{
            ...getCardStyle('projects'),
            flexShrink: 0
          }}>
            <div style={{
              background: DESIGN_SYSTEM.pageThemes.projects.gradient,
              color: DESIGN_SYSTEM.colors.text.inverse,
              padding: DESIGN_SYSTEM.spacing.base,
              borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`
            }}>
              <h3 style={{
                margin: 0,
                fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold
              }}>
                Reminders
              </h3>
            </div>
            <div style={{ padding: 0 }}>
            <Reminders projectId={projectId} autoOpenReminderId={autoOpenReminderId} /> 
          </div>
          </div>
          
          {/* Project Forum Section */}
          <div style={{
            ...getCardStyle('projects'),
            flex: "1 1 350px", 
            minHeight: "300px",
            maxHeight: "400px",
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{
              background: DESIGN_SYSTEM.pageThemes.forums.gradient,
              color: DESIGN_SYSTEM.colors.text.inverse,
              padding: DESIGN_SYSTEM.spacing.base,
              borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`
            }}>
              <h3 style={{
                margin: 0,
                fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold
              }}>
                Project Forum
              </h3>
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
            <ProjectGroupForum 
              projectId={projectId} 
                forums={projectForums}
            />
          </div>
          </div>
          
          {/* Team Members Section */}
          <div style={{
            ...getCardStyle('projects'),
            flex: "1 1 300px", 
            minHeight: "250px",
            maxHeight: "350px",
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{
              background: DESIGN_SYSTEM.pageThemes.projects.gradient,
              color: DESIGN_SYSTEM.colors.text.inverse,
              padding: DESIGN_SYSTEM.spacing.base,
              borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`
            }}>
              <h3 style={{
                margin: 0,
                fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold
              }}>
                Team Members
              </h3>
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
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

            {/* Meeting Transcripts Section */}
            <div style={{
              ...getCardStyle('projects'),
              flex: "1 1 280px",
              minHeight: "200px",
              display: "flex",
              flexDirection: "column"
            }}>
              <div style={{
                background: DESIGN_SYSTEM.pageThemes.projects.gradient,
                color: DESIGN_SYSTEM.colors.text.inverse,
                padding: DESIGN_SYSTEM.spacing.base,
                borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`
              }}>
                <h3 style={{
                  margin: 0,
                  fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
                  fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold
                }}>
                  Meeting Transcripts
                </h3>
              </div>
              <div style={{ padding: DESIGN_SYSTEM.spacing.base, maxHeight: 260, overflowY: 'auto' }}>
                {meetingTranscriptsList.length === 0 ? (
                  <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>No transcripts yet. Click Save Transcript to save one.</div>
                ) : (
                  meetingTranscriptsList.map(file => (
                    <div key={file.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', border: `1px solid ${DESIGN_SYSTEM.colors.border}`, borderRadius: 8, marginBottom: 8, background: '#fff' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{file.name}</span>
                        <span style={{ fontSize: DESIGN_SYSTEM.typography.fontSize.sm, color: DESIGN_SYSTEM.colors.text.secondary }}>{new Date((file.createdAt?.seconds||0)*1000).toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => {
                          const blob = new Blob([file.content || ''], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = file.name || 'transcript.txt';
                          a.click();
                          URL.revokeObjectURL(url);
                        }} style={{ 
                          ...getButtonStyle('secondary', 'projects'),
                          padding: '4px 8px',
                          fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                          borderRadius: 9999,
                          background: '#fff',
                          color: '#111827',
                          border: '1px solid #e5e7eb'
                        }}>⬇️ Download</button>
                        <button onClick={() => { setAiModalTranscriptDoc(file); setAiModalOpen(true); setAiModalItems([]); setAiModalSelection({}); setAiModalTarget('tasks'); setAiModalError(''); }} style={{ 
                          ...getButtonStyle('secondary', 'projects'),
                          padding: '4px 8px',
                          fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                          borderRadius: 9999,
                          background: '#111827',
                          color: '#fff',
                          border: '1px solid #111827'
                        }}>🤖 AI Actions</button>
                        <button onClick={async () => {
                          try {
                            await deleteDoc(doc(db, 'projects', projectId, 'meetingTranscripts', file.id));
                            // Optimistically update local list
                            setMeetingTranscriptsList(prev => prev.filter(f => f.id !== file.id));
                          } catch (e) {
                            alert('Failed to delete transcript');
                          }
                        }} style={{ 
                          ...getButtonStyle('secondary', 'projects'),
                          padding: '4px 8px',
                          fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                          borderRadius: 9999,
                          background: '#fee2e2',
                          border: '1px solid #fecaca',
                          color: '#b91c1c'
                        }}>🗑️ Delete</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
        </div>

        {/* Right Column */}
        <div style={{ 
          display: "flex", 
          flexDirection: "column", 
          gap: DESIGN_SYSTEM.spacing.lg, 
          gridColumn: 2, 
            gridRow: 1 
        }}>
          {/* Project Stages Section */}
          <div style={{
            ...getCardStyle('projects'),
              padding: 0
          }}>
            <div style={{
              background: DESIGN_SYSTEM.pageThemes.projects.gradient,
              color: DESIGN_SYSTEM.colors.text.inverse,
              padding: DESIGN_SYSTEM.spacing.base,
              borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <h3 style={{
                margin: 0,
                fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold
              }}>
                Project Stages
              </h3>
                <button
                  onClick={() => !currentApproval && handleSendApprovalRequest()}
                disabled={!!currentApproval}
                style={{
                    ...getButtonStyle('secondary', 'projects'),
                    background: currentApproval ? 'rgba(107,114,128,0.3)' : 'rgba(255,255,255,0.2)',
                    color: currentApproval ? '#9CA3AF' : DESIGN_SYSTEM.colors.text.inverse,
                    border: currentApproval ? `1px solid rgba(156,163,175,0.5)` : `1px solid rgba(255,255,255,0.3)`,
                    padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.base}`,
                    fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                    cursor: currentApproval ? 'not-allowed' : 'pointer'
                }}
              >
                {currentApproval ? 'Pending Approval' : 'Send Approval'}
              </button>
          </div>
            <div style={{ padding: DESIGN_SYSTEM.spacing.base, overflowX: 'hidden' }}>
          <StageIndicator 
            currentStage={currentStage} 
            allStages={isEditingStages ? workingStages : projectStages} 
            onAdvanceStage={handleAdvanceStage} 
            onGoBackStage={handleGoBackStage} 
            isCurrentStageTasksComplete={isCurrentStageTasksComplete}
            onStageSelect={handleStageSelect}
            canAdvance={canAdvanceStage}
            editing={isEditingStages}
            onAddStage={handleAddStage}
            onDeleteStageAt={handleDeleteStageAt}
            onRenameStage={handleRenameStageAt}
            onMoveStageLeft={handleMoveStageLeft}
            onMoveStageRight={handleMoveStageRight}
          />
            </div>
          </div>

          {/* Project Tasks Section */}
          <div style={{
            ...getCardStyle('projects'),
            flex: 1,
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{
              background: DESIGN_SYSTEM.pageThemes.projects.gradient,
              color: DESIGN_SYSTEM.colors.text.inverse,
              padding: DESIGN_SYSTEM.spacing.base,
              borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`
            }}>
              <h3 style={{
                margin: 0,
                fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold
              }}>
                Project Tasks
              </h3>
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
          <ProjectTaskPanel 
            projectTasks={projectTasks}
            setProjectTasks={setProjectTasks}
            currentStage={currentStage} 
            projectId={projectId}
                setProjectData={setProjectData}
                projectMembers={projectTeamMembersDetails}
          />
        </div>
      </div>
        </div>
      </div>
      </div>
      
      {showApprovalModal && (
        <ApprovalModal
          isOpen={showApprovalModal}
          onClose={() => setShowApprovalModal(false)}
          onConfirm={handleConfirmAdvanceStage}
          projectId={projectId}
        />
      )}
      <AdvanceStageChoiceModal
        isOpen={showAdvanceChoiceModal}
        onClose={() => setShowAdvanceChoiceModal(false)}
        onChoose={handleAdvanceChoice}
      />
      <SendApprovalModal
        isOpen={showSendApprovalModal}
        onClose={() => setShowSendApprovalModal(false)}
        onSendApproval={(data) => console.log("Approval data sent:", data)}
        defaultProject={projectDetails}
        defaultStatus={currentStage}
        currentUser={currentUser}
        teamMembers={projectTeamMembersDetails}
      />
      
      <AdvancedApprovalRequestModal
        isOpen={showAdvancedApprovalModal}
        onClose={() => setShowAdvancedApprovalModal(false)}
        onSuccess={handleApprovalRequestSuccess}
        projectId={projectId}
        projectName={projectData?.name || ""}
        currentUser={currentUser}
        currentStage={currentStage}
        nextStage={projectStages[projectStages.indexOf(currentStage) + 1] || ""}
        isStageAdvancement={approvalModalType === 'stage'}
      />
      
      {/* Add Team Member Modal */}
      <AddTeamMemberModal
        isOpen={showAddTeamMemberModal}
        onClose={() => setShowAddTeamMemberModal(false)}
        projectId={projectId}
        onTeamMemberAdded={handleTeamMemberAdded}
      />

      {/* AI Actions Modal */}
      {aiModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, width: 640, maxWidth: '95vw', boxShadow: '0 10px 25px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>AI Actions</div>
              <button onClick={() => setAiModalOpen(false)} style={{ ...getButtonStyle('secondary', 'projects') }}>Close</button>
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
                    // Fallback: derive items from summary lines or transcript keywords
                    const src = (json.summary || aiText || '').split('\n')
                      .map(s => s.trim())
                      .filter(s => s && /(^- |^\d+\. |should|need to|please|action|task|todo)/i.test(s))
                      .slice(0, 10);
                    items = src.map(s => ({ title: s.replace(/^[-\d\.\s]+/, '').trim(), description: '' }));
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
              }} style={{ ...getButtonStyle('secondary', 'projects') }}>Analyze</button>
              <select value={aiModalTarget} onChange={(e) => setAiModalTarget(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 8px' }}>
                <option value="tasks">Add to Tasks</option>
                <option value="reminders">Add to Reminders</option>
              </select>
              <button disabled={aiModalLoading || aiModalItems.length === 0} onClick={async () => {
                try {
                  setAiModalLoading(true); setAiModalError('');
                  const selected = aiModalItems.filter(it => aiModalSelection[it.id]);
                  if (selected.length === 0) { setAiModalLoading(false); return; }
                  if (aiModalTarget === 'tasks') {
                    const sections = Array.isArray(projectData.tasks) ? [...projectData.tasks] : [];
                    let sectionIndex = sections.findIndex(s => s.stage === currentStage);
                    if (sectionIndex === -1) { sections.push({ stage: currentStage, title: 'Auto Tasks', tasks: [] }); sectionIndex = sections.length - 1; }
                    const teammateNames = (projectTeamMembersDetails || []).map(m => m.name?.toLowerCase?.() || '');
                    const newTasks = selected.map((it, idx) => {
                      let title = (it.displayTitle || '').toString().trim();
                      if (!title) title = `Action Item ${idx + 1}`;
                      title = title.charAt(0).toUpperCase() + title.slice(1);
                      if (title.length > 140) title = title.slice(0, 137) + '...';
                      const desc = it.description || `Generated from transcript.`;
                      const assignee = (it.assignee && teammateNames.includes(it.assignee.toLowerCase())) ? it.assignee : '';
                      // Map AI deadline to YYYY-MM-DD and default to today if missing
                      const parseDeadline = (dl) => {
                        if (!dl) return '';
                        const s = String(dl).trim().toLowerCase();
                        const fmt = (d) => {
                          const y = d.getFullYear();
                          const m = String(d.getMonth() + 1).padStart(2, '0');
                          const da = String(d.getDate()).padStart(2, '0');
                          return `${y}-${m}-${da}`;
                        };
                        const today = new Date();
                        // today / tomorrow keywords (robust matching anywhere in string)
                        if (/\btoday\b/.test(s)) return fmt(today);
                        if (/\b(tmr|tmrw|tmmrw|tmmr|tomor+ow?)\b/.test(s)) { const d = new Date(today); d.setDate(d.getDate() + 1); return fmt(d); }
                        if (/^yesterday\b/.test(s)) { const d = new Date(today); d.setDate(d.getDate() - 1); return fmt(d); }
                        if (/^next\s*week$/.test(s) || /\bnextweek\b/.test(s)) { const d = new Date(today); d.setDate(d.getDate() + 7); return fmt(d); }
                        // in X days
                        const inDays = s.match(/\bin\s+(\d+)\s+days?\b/);
                        if (inDays) { const d = new Date(today); d.setDate(d.getDate() + parseInt(inDays[1], 10)); return fmt(d); }
                        // next weekday
                        const wd = s.match(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
                        if (wd) {
                          const map = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };
                          const target = map[wd[1]];
                          const d = new Date(today);
                          const cur = d.getDay();
                          let add = (target + 7 - cur) % 7; if (add === 0) add = 7; d.setDate(d.getDate() + add);
                          return fmt(d);
                        }
                        // ISO-like
                        const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:[t\s](\d{2}:\d{2}))?/);
                        if (m) return m[1];
                        return '';
                      };
                      let deadline = parseDeadline(it.deadline);
                      if (!deadline) deadline = new Date().toISOString().slice(0,10);
                      return { id: Date.now() + Math.random(), title, name: title, description: desc, status: 'open', deadline, assignee };
                    });
                    const section = sections[sectionIndex];
                    section.tasks = Array.isArray(section.tasks) ? [...section.tasks, ...newTasks] : newTasks;
                    await updateDoc(doc(db, 'projects', projectData.id), { tasks: sections });
                    setProjectData(prev => prev ? { ...prev, tasks: sections } : prev);
                    setAiModalOpen(false);
                  } else {
                    // Map AI items to project reminders subcollection
                    const parseDeadline = (dl) => {
                      if (!dl) return { date: '', time: '' };
                      const s = String(dl).trim().toLowerCase();
                      const fmt = (d) => {
                        const y = d.getFullYear();
                        const m = String(d.getMonth() + 1).padStart(2, '0');
                        const da = String(d.getDate()).padStart(2, '0');
                        return `${y}-${m}-${da}`;
                      };
                      const today = new Date();
                      if (/\btoday\b/.test(s)) return { date: fmt(today), time: '' };
                      if (/\b(tmr|tmrw|tmmrw|tmmr|tomor+ow?)\b/.test(s)) { const d = new Date(today); d.setDate(d.getDate() + 1); return { date: fmt(d), time: '' }; }
                      if (/\byesterday\b/.test(s)) { const d = new Date(today); d.setDate(d.getDate() - 1); return { date: fmt(d), time: '' }; }
                      if (/^next\s*week$/.test(s) || /\bnextweek\b/.test(s)) { const d = new Date(today); d.setDate(d.getDate() + 7); return { date: fmt(d), time: '' }; }
                      const inDays = s.match(/\bin\s+(\d+)\s+days?\b/);
                      if (inDays) { const d = new Date(today); d.setDate(d.getDate() + parseInt(inDays[1], 10)); return { date: fmt(d), time: '' }; }
                      const wd = s.match(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
                      if (wd) {
                        const map = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };
                        const target = map[wd[1]];
                        const d = new Date(today);
                        const cur = d.getDay();
                        let add = (target + 7 - cur) % 7; if (add === 0) add = 7; d.setDate(d.getDate() + add);
                        return { date: fmt(d), time: '' };
                      }
                      const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:[t\s](\d{2}:\d{2}))?/);
                      if (m) return { date: m[1], time: m[2] || '' };
                      return { date: '', time: '' };
                    };
                    for (let idx = 0; idx < selected.length; idx++) {
                      const it = selected[idx];
                      const { date, time } = parseDeadline(it.deadline);
                      const finalDate = date || new Date().toISOString().slice(0,10);
                      const ref = await addDoc(collection(db, 'projects', projectData.id, 'reminders'), {
                        title: (it.displayTitle || it.title || it.name || `Reminder ${idx + 1}`).toString(),
                        description: it.description || '',
                        date: finalDate,
                        time: time || '',
                        timestamp: serverTimestamp(),
                      });
                      // Write notification
                      try {
                        await addDoc(collection(db, 'users', currentUser.uid, 'notifications'), {
                          unread: true,
                          createdAt: serverTimestamp(),
                          origin: 'project',
                          title: 'New Project Reminder',
                          message: `${projectData?.name || 'Project'}: ${it.displayTitle || it.title || 'Reminder'} on ${finalDate}${time ? ' ' + time : ''}`,
                          refType: 'projectReminder',
                          refId: ref.id,
                          projectId: projectData.id
                        });
                      } catch {}
                    }
                    setAiModalOpen(false);
                  }
                } catch (e) {
                  setAiModalError(e.message || 'Failed to add items.');
                } finally {
                  setAiModalLoading(false);
                }
              }} style={{ ...getButtonStyle('primary', 'projects') }}>Add Selected</button>
            </div>
            {aiModalError && <div style={{ color: '#b91c1c', marginBottom: 8 }}>{aiModalError}</div>}
            <div style={{ maxHeight: 320, overflowY: 'auto', border: `1px solid ${DESIGN_SYSTEM.colors.border}`, borderRadius: 8, padding: 8, background: '#fff' }}>
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
    </div>
  );
}
