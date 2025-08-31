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
import FinancePanel from '../components/project-component/FinancePanel';
import ProjectQuotesPanel from '../components/project-component/ProjectQuotesPanel';
import { db, storage } from "../firebase";
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot, getDocs, arrayUnion, arrayRemove, addDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useAuth } from '../contexts/AuthContext';
import { DESIGN_SYSTEM, getPageContainerStyle, getCardStyle, getContentContainerStyle, getButtonStyle } from '../styles/designSystem';
import { useNavigate } from 'react-router-dom';
import ConfirmationModal from '../components/common/ConfirmationModal';
import GoogleEmbedModal from '../components/common/GoogleEmbedModal';
import AttachDriveFileModal from '../components/common/AttachDriveFileModal';
import PreviewModal from '../components/common/PreviewModal';
import DriveShareModal from '../components/common/DriveShareModal';
import FileActionsModal from '../components/common/FileActionsModal';
import { ensureDriveToken as ensureDriveTokenCentral, requestDriveConsent } from '../utils/googleAuth';
import { listSopTemplates, applyProjectSopTemplate, listUserSopTemplates, saveUserSopTemplate, updateUserSopTemplate, deleteUserSopTemplate } from '../utils/sopTemplates';

const DEFAULT_STAGES = ["Planning", "Development", "Testing", "Completed"];

export default function ProjectDetail() {
  const { projectId } = useParams(); // Changed from projectName to projectId
  const navigate = useNavigate();
  const location = useLocation();
  const { autoOpenReminderId, openSopAtLoad } = React.useMemo(() => {
    try {
      const sp = new URLSearchParams(location.search);
      return { autoOpenReminderId: sp.get('reminderId') || null, openSopAtLoad: sp.get('openSop') === '1' };
    } catch { return { autoOpenReminderId: null, openSopAtLoad: false }; }
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
  const [viewingStage, setViewingStage] = useState(null);
  // SOP picker state
  const [showProjectSopPicker, setShowProjectSopPicker] = useState(false);
  const [projectSopChoice, setProjectSopChoice] = useState('project_general_v1');

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
  const lastSavedFinalRef = useRef("");

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
  const [isUploadingProjectFile, setIsUploadingProjectFile] = useState(false);
  const [showAddFileModal, setShowAddFileModal] = useState(false);
  const filePickerRef = useRef(null);
  // Drive/embed state
  const [showGoogleViewer, setShowGoogleViewer] = useState(false);
  const [googleViewerType, setGoogleViewerType] = useState('');
  const [googleViewerId, setGoogleViewerId] = useState('');
  const [googleViewerTitle, setGoogleViewerTitle] = useState('');
  const [showAttachDrive, setShowAttachDrive] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [shareFile, setShareFile] = useState(null);
  const [driveAuthNeeded, setDriveAuthNeeded] = useState(false);
  const [driveAuthError, setDriveAuthError] = useState('');
  const [actionsFile, setActionsFile] = useState(null);

  const loadScriptOnce = (src) => new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script'); s.src = src; s.async = true; s.onload = resolve; s.onerror = () => reject(new Error('Failed to load ' + src)); document.head.appendChild(s);
  });

  const ensureDriveToken = async () => {
    try { const t = await ensureDriveTokenCentral(); return t || null; } catch { return null; }
  };

  useEffect(() => {
    if (openSopAtLoad) setShowProjectSopPicker(true);
  }, [openSopAtLoad]);

  // Proactively check Drive auth when the Project Files card is in view
  useEffect(() => {
    (async () => {
      try {
        const token = await ensureDriveToken();
        setDriveAuthNeeded(!token);
      } catch {
        setDriveAuthNeeded(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const createGoogleFile = async (kind) => {
    try {
      if (!projectId) return;
      let token = await ensureDriveToken();
      if (!token) { token = await requestDriveConsent(); }
      if (!token) { setDriveAuthNeeded(true); alert('Google Drive authorization required.'); return; }
      const mimeMap = {
        gdoc: 'application/vnd.google-apps.document',
        gsheet: 'application/vnd.google-apps.spreadsheet',
        gslide: 'application/vnd.google-apps.presentation'
      };
      const typeLabel = kind === 'gdoc' ? 'Document' : kind === 'gsheet' ? 'Spreadsheet' : 'Presentation';
      const defaultName = `${typeLabel} - ${projectData?.name || 'Untitled'} - ${new Date().toLocaleDateString()}`;
      const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink,parents&supportsAllDrives=true', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: defaultName, mimeType: mimeMap[kind], parents: ['root'] })
      });
      if (!res.ok) {
        try {
          const err = await res.json();
          const msg = err?.error?.message || `HTTP ${res.status}`;
          if (res.status === 401 || res.status === 403) setDriveAuthNeeded(true);
          alert(`Failed to create file: ${msg}`);
        } catch { alert('Failed to create file.'); }
        return;
      }
      const json = await res.json();
      const driveId = json.id;
      const entry = {
        name: json.name || defaultName,
        type: kind,
        driveId,
        url: kind === 'gdoc' ? `https://docs.google.com/document/d/${driveId}/edit` : kind === 'gsheet' ? `https://docs.google.com/spreadsheets/d/${driveId}/edit` : `https://docs.google.com/presentation/d/${driveId}/edit`,
        createdAt: Date.now()
      };
      await updateDoc(doc(db, 'projects', projectId), { files: Array.isArray(projectData?.files) ? [...projectData.files, entry] : [entry] });
      setGoogleViewerType(kind); setGoogleViewerId(driveId); setGoogleViewerTitle(entry.name); setShowGoogleViewer(true);
    } catch { alert('Failed to create Google file.'); }
  };

  const copyLink = async (url) => { try { await navigator.clipboard.writeText(url || ''); } catch {} };

  const renameGoogleFile = async (file, providedName) => {
    try {
      if (!projectId || !file?.driveId) return;
      let nextName = providedName;
      if (!nextName) {
        nextName = window.prompt('Rename file to:', file.name || 'Untitled') || '';
      }
      if (!nextName || nextName === file.name) return;
      let token = await ensureDriveToken();
      if (!token) { token = await requestDriveConsent(); }
      if (!token) { setDriveAuthNeeded(true); alert('Authorization required to rename.'); return; }
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.driveId}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: nextName }) });
      if (!res.ok) { alert('Failed to rename on Drive'); return; }
      const next = (Array.isArray(projectData?.files) ? projectData.files : []).map((f) => (f.driveId === file.driveId ? { ...f, name: nextName } : f));
      await updateDoc(doc(db, 'projects', projectId), { files: next });
      setProjectData((prev) => ({ ...(prev || {}), files: next }));
    } catch { alert('Rename failed'); }
  };

  const deleteGoogleFile = async (file) => {
    try {
      if (!projectId || !file?.driveId) return;
      const sure = window.confirm('Delete this file from Drive and remove from project?');
      if (!sure) return;
      let token = await ensureDriveToken();
      if (!token) { token = await requestDriveConsent(); }
      if (!token) { setDriveAuthNeeded(true); alert('Authorization required to delete.'); return; }
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.driveId}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
      if (!res.ok) { alert('Failed to delete on Drive'); return; }
      const next = (Array.isArray(projectData?.files) ? projectData.files : []).filter((f) => f.driveId !== file.driveId);
      await updateDoc(doc(db, 'projects', projectId), { files: next });
      setProjectData((prev) => ({ ...(prev || {}), files: next }));
    } catch { alert('Delete failed'); }
  };

  const shareGoogleFile = async (file) => {
    try {
      if (!file?.driveId) return;
      let token = await ensureDriveToken();
      if (!token) { token = await requestDriveConsent(); }
      if (!token) { setDriveAuthNeeded(true); alert('Authorization required to share.'); return; }
      const permRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.driveId}/permissions?supportsAllDrives=true`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'reader', type: 'anyone', allowFileDiscovery: false }) });
      if (!permRes.ok) { alert('Failed to set sharing permission'); return; }
      const getRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.driveId}?fields=webViewLink&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
      let link = file.url || '';
      if (getRes.ok) { const j = await getRes.json(); if (j.webViewLink) link = j.webViewLink; }
      try { await navigator.clipboard.writeText(link); alert('Share link copied'); } catch { alert('Share enabled'); }
    } catch { alert('Share failed'); }
  };
  
  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState({
    title: '',
    message: '',
    onConfirm: () => {},
    confirmText: 'Confirm',
    confirmButtonType: 'primary'
  });

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
            // Do not persist interim segments to avoid duplicates
          }
        }
        const clean = finalText.trim();
        if (clean) {
          transcriptBufferRef.current = `${transcriptBufferRef.current} ${clean}`.trim();
          const sessionId = meetingSessionIdRef.current;
          const prev = (lastSavedFinalRef.current || '').trim();
          const isDup = !!prev && (clean === prev || prev.endsWith(clean) || clean.endsWith(prev));
          if (sessionId && !isDup) {
            await addDoc(collection(db, 'meetingSessions', sessionId, 'transcripts'), {
              text: clean,
              userId: currentUser?.uid || 'anon',
              createdAt: serverTimestamp()
            });
            lastSavedFinalRef.current = clean;
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
        // Include any remaining interim text in buffer but do not persist as separate line
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
    if (!projectId) return;
    const refDoc = doc(db, 'projects', projectId);
    // Initial fetch for immediate values
    (async () => {
      try {
        const snap = await getDoc(refDoc);
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() };
          setProjectData(data);
          setProjectStages(Array.isArray(data.stages) && data.stages.length > 0 ? data.stages : DEFAULT_STAGES);
          setCurrentStage(data.stage || (Array.isArray(data.stages) && data.stages[0]) || DEFAULT_STAGES[0]);
        }
      } catch {}
    })();
    // Live updates
    const unsub = onSnapshot(refDoc, (snap) => {
      if (!snap.exists()) { setProjectData(null); return; }
      const data = { id: snap.id, ...snap.data() };
      setProjectData(data);
      setProjectStages(Array.isArray(data.stages) && data.stages.length > 0 ? data.stages : DEFAULT_STAGES);
      setCurrentStage(data.stage || (Array.isArray(data.stages) && data.stages[0]) || DEFAULT_STAGES[0]);
    });
    return () => unsub();
  }, [projectId]);

  // Fetch project-specific forums in real-time (show even if user is not a member)
  useEffect(() => {
    if (projectId) {
      const forumsCollectionRef = collection(db, "forums");
      const q = query(forumsCollectionRef, where("projectId", "==", projectId));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const forumsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProjectForums(forumsData);
      });
      return () => unsubscribe();
    }
  }, [projectId]);

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
    if (!projectData) return;
      const stageToShow = viewingStage || currentStage;
      const filteredTasks = (projectData.tasks || []).filter(section => section.stage === stageToShow);
      setProjectTasks(filteredTasks);
      setProjectReminders(projectData.reminders || []);
      setProjectDetails(projectData);
  }, [projectData, currentStage, viewingStage]);

  // Initialize states with projectData or empty arrays if projectData is null
  const [projectTasks, setProjectTasks] = useState([]);
  const [projectReminders, setProjectReminders] = useState([]);
  const [projectDetails, setProjectDetails] = useState(null);
  const [stagesCollapsed, setStagesCollapsed] = useState(false);
  const [stageApprovalPending, setStageApprovalPending] = useState(false);

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
        setViewingStage(null);
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
    // If bypassed (no approval needed), immediately reflect next stage locally
    if (result && result.bypassed && result.nextStage) {
      setCurrentStage(result.nextStage);
      setProjectData(prev => prev ? { ...prev, stage: result.nextStage } : prev);
    }
    // If this was a stage advancement request (not bypass), mark pending indicator
    if (approvalModalType === 'stage' && !(result && result.bypassed)) {
      setStageApprovalPending(true);
    }
    // Show styled popup, no cancel, include rich info
    const lines = [];
    if (result?.title) lines.push(`Title: ${result.title}`);
    if (result?.entityName) lines.push(`Entity: ${result.entityName}`);
    if (result?.type) lines.push(`Type: ${result.type}`);
    if (approvalModalType === 'stage' && result?.nextStage && !result?.bypassed) {
      lines.push(`Requested Stage: ${currentStage} → ${result.nextStage}`);
    }
    if (!result?.bypassed) {
      const msg = `Approval request sent successfully.${lines.length ? `\n\n${lines.join('\n')}` : ''}`;
      setConfirmModalConfig({
        title: 'Approval Sent',
        message: msg,
        confirmText: 'OK',
        confirmButtonType: 'primary',
        onConfirm: () => setShowConfirmModal(false)
      });
      setShowConfirmModal(true);
    }
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
      // Reload tasks for the newly selected stage from Firestore to avoid stale local filtering
      try {
        const snap = await getDoc(projectRef);
        if (snap.exists()) {
          const data = snap.data() || {};
          const allSections = Array.isArray(data.tasks) ? data.tasks : [];
          const filtered = allSections.filter(s => s && s.stage === stage);
          setProjectData(prev => prev ? { ...prev, ...data } : { ...data, id: projectData.id });
          setProjectTasks(filtered);
        }
      } catch {}
    }
  };

  const ProjectSopPicker = ({ onClose }) => {
    const templates = listSopTemplates('project');
    const selected = templates.find(t => t.id === projectSopChoice) || templates[0];
    const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(selected || {})));
    useEffect(() => { setDraft(JSON.parse(JSON.stringify(selected || {}))); }, [selected?.id]);
    const [tab, setTab] = useState('templates'); // 'templates' | 'ai' | 'my'
    const [aiDesc, setAiDesc] = useState('');
    const [aiIndustry, setAiIndustry] = useState('');
    const [aiProjectType, setAiProjectType] = useState('');
    const [aiRoles, setAiRoles] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState('');
    const [aiRaw, setAiRaw] = useState('');
    // My templates state (project)
    const [userTemplates, setUserTemplates] = useState([]);
    const [userTemplatesLoading, setUserTemplatesLoading] = useState(false);
    const [userTemplatesError, setUserTemplatesError] = useState('');
    const [templateName, setTemplateName] = useState('');
    const [selectedUserTemplateId, setSelectedUserTemplateId] = useState('');
    const parseJsonFromText = (text) => {
      const tryParse = (s) => { try { return JSON.parse(s); } catch { return null; } };
      const repairJson = (input) => {
        try {
          let s = String(input || '');
          s = s.replace(/```(?:json)?\s*([\s\S]*?)```/gi, '$1');
          s = s.replace(/,\s*(\}|\])/g, '$1');
          s = s.replace(/([\{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":');
          s = s.replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, ': "$1"');
          return s;
        } catch { return input; }
      };
      const t0 = (text || '').trim();
      let parsed = tryParse(t0);
      if (parsed) return parsed;
      const fence = t0.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fence) {
        const inner = fence[1].trim();
        parsed = tryParse(inner) || tryParse(repairJson(inner));
        if (parsed) return parsed;
      }
      const first = t0.indexOf('{'); const last = t0.lastIndexOf('}');
      if (first !== -1 && last !== -1 && last > first) {
        const slice = t0.slice(first, last + 1);
        parsed = tryParse(slice) || tryParse(repairJson(slice));
        if (parsed) return parsed;
      }
      const match = t0.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = tryParse(match[0]) || tryParse(repairJson(match[0]));
        if (parsed) return parsed;
      }
      return null;
    };
    const normalizeProjectTemplate = (obj) => {
      try {
        const t = typeof obj === 'object' && obj ? obj : {};
        const outlineStages = Array.isArray(t?.outline?.stages) ? t.outline.stages : [];
        const safeStages = outlineStages.map((s) => {
          const name = String(s?.name || 'Stage');
          const sections = Array.isArray(s?.sections) ? s.sections : [];
          const safeSecs = sections.map((sec) => {
            const secName = String(sec?.name || 'Section');
            const tasks = Array.isArray(sec?.tasks) ? sec.tasks : [];
            const safeTasks = tasks.map((tk) => ({ title: String(tk?.title || tk?.name || 'Task') }));
            return { name: secName, tasks: safeTasks };
          });
          return { name, sections: safeSecs };
        });
        const defRems = Array.isArray(t.defaultReminders) ? t.defaultReminders : [];
        const defFiles = Array.isArray(t.defaultFiles) ? t.defaultFiles : [];
        return {
          id: String(t.id || `ai_project_${Date.now()}`),
          type: 'project',
          name: String(t.name || 'AI Project SOP'),
          version: Number(t.version || 1),
          outline: { stages: safeStages },
          defaultReminders: defRems.map((r) => (typeof r === 'string' ? r : { title: String(r?.title || 'Reminder'), date: String(r?.date || r?.dueDate || ''), time: String(r?.time || r?.dueTime || '') })),
          defaultFiles: defFiles.map((f) => (typeof f === 'string' ? f : String(f?.name || 'File')))
        };
      } catch { return { id: `ai_project_${Date.now()}`, type: 'project', name: 'AI Project SOP', version: 1, outline: { stages: [] }, defaultReminders: [], defaultFiles: [] }; }
    };
    const buildLocalProjectTemplate = () => {
      const name = `AI Project SOP (${aiIndustry || 'General'})`;
      const toTasks = (arr) => arr.map(t => ({ title: t }));
      const stages = [
        { name: 'Planning', sections: [
          { name: 'Design', tasks: toTasks(['Site survey', 'Concept drawings', 'Material takeoff']) },
          { name: 'Permits', tasks: toTasks(['Identify permits', 'Prepare submission package', 'Submission']) }
        ]},
        { name: 'Procurement', sections: [
          { name: 'Vendors', tasks: toTasks(['Issue RFQs', 'Evaluate bids', 'Select suppliers']) },
          { name: 'Contracts', tasks: toTasks(['Draft PO/Contracts', 'Legal review', 'Sign-off']) }
        ]},
        { name: 'Execution', sections: [
          { name: 'Foundation', tasks: toTasks(['Excavation', 'Rebar placement', 'Pour concrete']) },
          { name: 'Structure', tasks: toTasks(['Frame erection', 'Scaffolding', 'Safety inspection']) }
        ]},
        { name: 'Testing', sections: [
          { name: 'QA/QC', tasks: toTasks(['Material tests', 'Inspection checklist', 'Defect list']) }
        ]},
        { name: 'Completed', sections: [
          { name: 'Handover', tasks: toTasks(['As-built docs', 'Client training', 'Final acceptance']) }
        ]}
      ];
      return { id: `ai_project_${Date.now()}`, type: 'project', name, version: 1, outline: { stages }, defaultReminders: ['Weekly progress update'], defaultFiles: ['Project Charter.pdf'] };
    };
    // Load user templates when switching to 'my'
    useEffect(() => {
      const loadMy = async () => {
        if (!currentUser) return;
        setUserTemplatesLoading(true); setUserTemplatesError('');
        try {
          const list = await listUserSopTemplates({ userId: currentUser.uid, kind: 'project' });
          setUserTemplates(list);
        } catch (e) {
          setUserTemplatesError('Failed to load templates');
        } finally {
          setUserTemplatesLoading(false);
        }
      };
      if (tab === 'my') loadMy();
    }, [tab, currentUser]);

    const handleNewTemplate = () => {
      const blank = {
        id: `user_project_${Date.now()}`,
        type: 'project',
        name: templateName || 'My Project Template',
        version: 1,
        outline: { stages: [ { name: 'Stage 1', sections: [ { name: 'Section 1', tasks: [] } ] } ] },
        defaultReminders: [],
        defaultFiles: []
      };
      setDraft(JSON.parse(JSON.stringify(blank)));
    };

    const handleUseCurrentProjectAsTemplate = () => {
      const stList = Array.isArray(projectStages) ? projectStages : [];
      const mappedStages = stList.map((stageName) => {
        const sections = (projectData?.tasks || []).filter(sec => sec.stage === stageName).map(sec => ({
          name: sec.name,
          tasks: Array.isArray(sec.tasks) ? sec.tasks.map(t => ({ title: String(t.name || t.title || '') })) : []
        }));
        return { name: stageName, sections };
      });
      const tpl = {
        id: `user_project_${Date.now()}`,
        type: 'project',
        name: templateName || 'My Project Template',
        version: 1,
        outline: { stages: mappedStages },
        defaultReminders: [],
        defaultFiles: Array.isArray(projectData?.files) ? projectData.files.map(String) : []
      };
      setDraft(JSON.parse(JSON.stringify(tpl)));
    };

    const handleSaveDraftAsMyTemplate = async () => {
      if (!currentUser) return;
      const prepared = {
        ...draft,
        name: templateName || draft?.name || 'My Project Template',
        type: 'project',
        version: Number(draft?.version || 1)
      };
      const saved = await saveUserSopTemplate({ userId: currentUser.uid, template: prepared });
      if (saved) {
        try {
          const list = await listUserSopTemplates({ userId: currentUser.uid, kind: 'project' });
          setUserTemplates(list);
          setSelectedUserTemplateId(saved._docId || '');
        } catch {}
      }
    };

    const handleSelectUserTemplate = async (docId) => {
      setSelectedUserTemplateId(docId);
      const found = userTemplates.find(t => t._docId === docId);
      if (found) {
        setTemplateName(String(found.name || ''));
        setDraft(JSON.parse(JSON.stringify(found)));
      }
    };

    const handleDeleteUserTemplate = async (docId) => {
      if (!currentUser || !docId) return;
      const ok = await deleteUserSopTemplate({ userId: currentUser.uid, docId });
      if (ok) {
        try {
          const list = await listUserSopTemplates({ userId: currentUser.uid, kind: 'project' });
          setUserTemplates(list);
          if (selectedUserTemplateId === docId) setSelectedUserTemplateId('');
        } catch {}
      }
    };

    // Preview add/remove helpers (project):
    const addStage = () => setDraft(d => {
      const next = JSON.parse(JSON.stringify(d||{}));
      const count = (next.outline?.stages || []).length;
      if (!next.outline) next.outline = { stages: [] };
      next.outline.stages.push({ name: `Stage ${count + 1}`, sections: [] });
      return next;
    });
    const addSection = (sIdx) => setDraft(d => {
      const next = JSON.parse(JSON.stringify(d||{}));
      const secs = next.outline?.stages?.[sIdx]?.sections;
      if (Array.isArray(secs)) secs.push({ name: 'New Section', tasks: [] });
      return next;
    });
    const addTask = (sIdx, secIdx) => setDraft(d => {
      const next = JSON.parse(JSON.stringify(d||{}));
      const tasks = next.outline?.stages?.[sIdx]?.sections?.[secIdx]?.tasks;
      if (Array.isArray(tasks)) tasks.push({ title: 'New Task' });
      return next;
    });
    const generateAiProjectTemplate = async () => {
      try {
        setAiLoading(true); setAiError('');
        const key = localStorage.getItem('gemini_api_key');
        if (!key) throw new Error('Missing GEMINI API key. Set it in Personal Assistant.');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${encodeURIComponent(key)}`;
        const sys = `You generate a project SOP template as pure JSON only. Schema: { id:string, type:"project", name:string, version:number, outline:{ stages:[ { name:string, sections:[ { name:string, tasks:[ { title:string, description?:string } ] } ] } ] }, defaultReminders:(string|{title,date?,time?})[], defaultFiles:(string|{name})[] }. Constraints: 3-6 stages, 1-3 sections/stage, 2-6 tasks/section, concise titles, leave date/time empty if unknown. Do not include any text outside the JSON.`;
        const user = `Industry: ${aiIndustry||''}\nProject type: ${aiProjectType||''}\nTeam roles: ${aiRoles||''}\nDescription: ${aiDesc||''}`;
        const body = {
          contents: [ { role: 'user', parts: [ { text: `${sys}\n\nContext:\n${user}` } ] } ],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1800, responseMimeType: 'application/json' },
          safetySettings: [
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' }
          ]
        };
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(`AI error ${res.status}`);
        const json = await res.json();
        setAiRaw('');
        if (json?.promptFeedback?.blockReason) {
          setAiRaw(JSON.stringify(json, null, 2));
          throw new Error(`AI blocked: ${json.promptFeedback.blockReason}`);
        }
        let parsed = null;
        const candidates = Array.isArray(json?.candidates) ? json.candidates : [];
        let fallbackText = '';
        for (let i = 0; i < candidates.length; i++) {
          const parts = Array.isArray(candidates[i]?.content?.parts) ? candidates[i].content.parts : [];
          const joined = parts.map(p => p?.text || '').join('').trim();
          if (joined) {
            const attempt = parseJsonFromText(joined);
            if (attempt) { parsed = attempt; break; }
            if (!fallbackText) fallbackText = joined;
          }
        }
        if (!parsed && fallbackText) parsed = parseJsonFromText(fallbackText);
        setAiRaw(fallbackText || (candidates.length ? JSON.stringify(candidates[0].content, null, 2) : ''));
        const normalized = parsed ? normalizeProjectTemplate(parsed) : buildLocalProjectTemplate();
        setDraft(JSON.parse(JSON.stringify(normalized)));
      } catch (e) {
        try {
          const normalized = buildLocalProjectTemplate();
          setDraft(JSON.parse(JSON.stringify(normalized)));
          setAiError('');
        } catch {
          setAiError(e?.message || 'Failed to generate');
        }
      } finally {
        setAiLoading(false);
      }
    };
    const removeStage = (idx) => setDraft(d => { const next = JSON.parse(JSON.stringify(d||{})); (next.outline.stages||[]).splice(idx,1); return next; });
    const removeSection = (sIdx, secIdx) => setDraft(d => { const next = JSON.parse(JSON.stringify(d||{})); (next.outline.stages?.[sIdx]?.sections||[]).splice(secIdx,1); return next; });
    const removeTask = (sIdx, secIdx, tIdx) => setDraft(d => { const next = JSON.parse(JSON.stringify(d||{})); (next.outline.stages?.[sIdx]?.sections?.[secIdx]?.tasks||[]).splice(tIdx,1); return next; });
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 1120, maxWidth: '96%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: DESIGN_SYSTEM.spacing.base, background: DESIGN_SYSTEM.pageThemes.projects.gradient, color: DESIGN_SYSTEM.colors.text.inverse, borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`, marginBottom: DESIGN_SYSTEM.spacing.base }}>
            <div style={{ fontWeight: 700, fontSize: DESIGN_SYSTEM.typography.fontSize.lg }}>Choose SOP Template (Project)</div>
            <button onClick={onClose} style={{ ...getButtonStyle('secondary', 'projects'), padding: '6px 10px' }}>Close</button>
          </div>
          <div style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ border: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`, borderRadius: DESIGN_SYSTEM.borderRadius.lg, padding: 0 }}>
                <div style={{ display: 'flex', borderBottom: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}` }}>
                  <button onClick={() => setTab('templates')} style={{ flex: 1, padding: 8, background: tab==='templates' ? '#fff' : '#f9fafb', border: 'none', borderRight: '1px solid #e5e7eb', cursor: 'pointer', fontWeight: 600 }}>Templates</button>
                  <button onClick={() => setTab('ai')} style={{ flex: 1, padding: 8, background: tab==='ai' ? '#fff' : '#f9fafb', border: 'none', borderRight: '1px solid #e5e7eb', cursor: 'pointer', fontWeight: 600 }}>AI Template</button>
                  <button onClick={() => setTab('my')} style={{ flex: 1, padding: 8, background: tab==='my' ? '#fff' : '#f9fafb', border: 'none', cursor: 'pointer', fontWeight: 600 }}>My Templates</button>
                </div>
                <div style={{ padding: DESIGN_SYSTEM.spacing.base, maxHeight: '60vh', overflowY: 'auto' }}>
                  {tab === 'templates' ? (
                    <div>
                      {templates.map(t => (
                        <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8, cursor: 'pointer', border: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`, marginBottom: 8, background: projectSopChoice === t.id ? '#fff' : '#fafafa' }}>
                          <input type="radio" name="proj_sop" checked={projectSopChoice === t.id} onChange={() => { setProjectSopChoice(t.id); setDraft(JSON.parse(JSON.stringify(t))); }} />
                          <span style={{ fontWeight: 600 }}>{t.name}</span>
                        </label>
                      ))}
                    </div>
                  ) : tab === 'ai' ? (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: DESIGN_SYSTEM.spacing.base }}>
                        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280' }}>
                          <span style={{ marginBottom: 4 }}>Industry</span>
                          <input value={aiIndustry} onChange={(e)=>setAiIndustry(e.target.value)} placeholder="e.g., Construction" />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280' }}>
                          <span style={{ marginBottom: 4 }}>Project type</span>
                          <input value={aiProjectType} onChange={(e)=>setAiProjectType(e.target.value)} placeholder="e.g., Residential build" />
                        </label>
                        <label style={{ gridColumn: '1 / span 2', display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280' }}>
                          <span style={{ marginBottom: 4 }}>Roles involved</span>
                          <input value={aiRoles} onChange={(e)=>setAiRoles(e.target.value)} placeholder="e.g., PM; QS; Site; QA" />
                        </label>
                        <label style={{ gridColumn: '1 / span 2', display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280' }}>
                          <span style={{ marginBottom: 4 }}>Description</span>
                          <textarea value={aiDesc} onChange={(e)=>setAiDesc(e.target.value)} placeholder="Describe the project workflow and requirements" style={{ minHeight: 70 }} />
                        </label>
                      </div>
                      <div style={{ display: 'flex', gap: DESIGN_SYSTEM.spacing.base, marginTop: DESIGN_SYSTEM.spacing.base }}>
                        <button onClick={generateAiProjectTemplate} disabled={aiLoading} style={{ ...getButtonStyle('primary', 'projects'), opacity: aiLoading ? 0.7 : 1 }}>{aiLoading ? 'Generating…' : 'Generate AI Template'}</button>
                        {aiError && <span style={{ color: '#b91c1c', fontSize: 12 }}>{aiError}</span>}
                        {!!aiRaw && <button onClick={() => { try { alert(aiRaw.slice(0, 5000)); } catch {} }} style={{ ...getButtonStyle('secondary', 'projects') }}>View AI Output</button>}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: DESIGN_SYSTEM.spacing.base, marginBottom: DESIGN_SYSTEM.spacing.base }}>
                        <label style={{ gridColumn: '1 / span 2', display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280' }}>
                          <span style={{ marginBottom: 4 }}>Template name</span>
                          <input value={templateName} onChange={(e)=>setTemplateName(e.target.value)} placeholder="My Project Template" />
                        </label>
                        <button onClick={handleNewTemplate} style={{ ...getButtonStyle('secondary', 'projects') }}>New Template</button>
                        <button onClick={handleUseCurrentProjectAsTemplate} style={{ ...getButtonStyle('secondary', 'projects') }}>Use Current Project</button>
                        <button onClick={handleSaveDraftAsMyTemplate} style={{ ...getButtonStyle('primary', 'projects') }}>Save as My Template</button>
                      </div>
                      {userTemplatesLoading ? (
                        <div>Loading…</div>
                      ) : userTemplatesError ? (
                        <div style={{ color: '#b91c1c' }}>{userTemplatesError}</div>
                      ) : (
                        <div>
                          {(userTemplates || []).map(ut => (
                            <div key={ut._docId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`, borderRadius: 8, padding: 8, marginBottom: 8, background: selectedUserTemplateId === ut._docId ? '#fff' : '#fafafa' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                <input type="radio" name="my_proj_tpl" checked={selectedUserTemplateId === ut._docId} onChange={() => handleSelectUserTemplate(ut._docId)} />
                                <span style={{ fontWeight: 600 }}>{ut.name}</span>
                              </label>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => handleSelectUserTemplate(ut._docId)} style={{ ...getButtonStyle('secondary', 'projects'), padding: '4px 8px' }}>Load</button>
                                <button onClick={() => handleDeleteUserTemplate(ut._docId)} style={{ ...getButtonStyle('secondary', 'projects'), padding: '4px 8px' }}>Delete</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ border: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`, borderRadius: DESIGN_SYSTEM.borderRadius.lg, padding: DESIGN_SYSTEM.spacing.base }}>
                <div style={{ fontWeight: 700, marginBottom: DESIGN_SYSTEM.spacing.sm, fontSize: DESIGN_SYSTEM.typography.fontSize.base }}>Outline</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: DESIGN_SYSTEM.spacing.sm, maxHeight: '66vh', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                    <button onClick={addStage} style={{ ...getButtonStyle('secondary', 'projects'), padding: '4px 8px' }}>+ Add Stage</button>
                  </div>
                  {(draft?.outline?.stages || []).length === 0 ? (
                    <div style={{ color: '#6b7280', fontStyle: 'italic' }}>No stages.</div>
                  ) : (
                    (draft.outline.stages || []).map((s, sIdx) => (
                      <div key={sIdx} style={{ border: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`, borderRadius: 8, padding: 8, background: '#fafafa' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <input value={s.name} onChange={(e)=>setDraft(d=>{ const n=JSON.parse(JSON.stringify(d||{})); n.outline.stages[sIdx].name = e.target.value; return n; })} style={{ fontWeight: 700, flex: 1 }} />
                          <button onClick={() => removeStage(sIdx)} style={{ ...getButtonStyle('secondary', 'projects'), padding: '4px 8px' }}>Remove Stage</button>
                        </div>
                        {Array.isArray(s.sections) && s.sections.length > 0 && (
                          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {s.sections.map((sec, secIdx) => (
                              <div key={secIdx} style={{ border: '1px dashed #e5e7eb', borderRadius: 8, padding: 8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                  <input value={sec.name || 'Section'} onChange={(e)=>setDraft(d=>{ const n=JSON.parse(JSON.stringify(d||{})); n.outline.stages[sIdx].sections[secIdx].name = e.target.value; return n; })} style={{ fontWeight: 600, flex: 1 }} />
                                  <button onClick={() => removeSection(sIdx, secIdx)} style={{ ...getButtonStyle('secondary', 'projects'), padding: '2px 6px', fontSize: 11 }}>Remove Section</button>
                                </div>
                                {Array.isArray(sec.tasks) && sec.tasks.length > 0 && (
                                  <ul style={{ margin: '6px 0 0 16px' }}>
                                    {sec.tasks.map((t, tIdx) => (
                                      <li key={tIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <input value={t.title || t.name} onChange={(e)=>setDraft(d=>{ const n=JSON.parse(JSON.stringify(d||{})); n.outline.stages[sIdx].sections[secIdx].tasks[tIdx].title = e.target.value; return n; })} />
                                        <button onClick={() => removeTask(sIdx, secIdx, tIdx)} style={{ ...getButtonStyle('secondary', 'projects'), padding: '2px 6px', fontSize: 11 }}>Remove</button>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                                  <button onClick={() => addTask(sIdx, secIdx)} style={{ ...getButtonStyle('secondary', 'projects'), padding: '2px 6px', fontSize: 12 }}>+ Add Task</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ marginTop: 6 }}>
                          <button onClick={() => addSection(sIdx)} style={{ ...getButtonStyle('secondary', 'projects'), padding: '2px 6px', fontSize: 12 }}>+ Add Section</button>
                        </div>
                      </div>
                    ))
                  )}
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontWeight: 700, margin: '6px 0' }}>Default Reminders</div>
                    {(draft.defaultReminders || []).length === 0 ? (
                      <div style={{ color: '#6b7280', fontStyle: 'italic' }}>None</div>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {(draft.defaultReminders || []).map((r, i) => {
                          const label = (typeof r === 'string') 
                            ? r 
                            : `${String(r?.title || 'Reminder')}${(r && (r.date || r.dueDate)) ? ` — ${String(r.date || r.dueDate)}` : ''}${(r && (r.time || r.dueTime)) ? ` ${String(r.time || r.dueTime)}` : ''}`;
                          return (
                            <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{label}</span>
                              <button onClick={() => setDraft(d => { const n = JSON.parse(JSON.stringify(d||{})); (n.defaultReminders||[]).splice(i,1); return n; })} style={{ ...getButtonStyle('secondary', 'projects'), padding: '2px 6px', fontSize: 11 }}>Remove</button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <div style={{ marginTop: 6 }}>
                      <button onClick={() => setDraft(d => { const n = JSON.parse(JSON.stringify(d||{})); (n.defaultReminders||(n.defaultReminders=[])).push('New reminder'); return n; })} style={{ ...getButtonStyle('secondary', 'projects'), padding: '2px 6px', fontSize: 12 }}>+ Add Reminder</button>
                    </div>
                    <div style={{ fontWeight: 700, margin: '10px 0 6px' }}>Default Files</div>
                    {(draft.defaultFiles || []).length === 0 ? (
                      <div style={{ color: '#6b7280', fontStyle: 'italic' }}>None</div>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {(draft.defaultFiles || []).map((f, i) => (
                          <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{f}</span>
                            <button onClick={() => setDraft(d => { const n = JSON.parse(JSON.stringify(d||{})); (n.defaultFiles||[]).splice(i,1); return n; })} style={{ ...getButtonStyle('secondary', 'projects'), padding: '2px 6px', fontSize: 11 }}>Remove</button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div style={{ marginTop: 6 }}>
                      <button onClick={() => setDraft(d => { const n = JSON.parse(JSON.stringify(d||{})); (n.defaultFiles||(n.defaultFiles=[])).push('New file'); return n; })} style={{ ...getButtonStyle('secondary', 'projects'), padding: '2px 6px', fontSize: 12 }}>+ Add File</button>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: DESIGN_SYSTEM.spacing.base, display: 'flex', justifyContent: 'flex-end', gap: DESIGN_SYSTEM.spacing.base }}>
                  <button onClick={onClose} style={{ ...getButtonStyle('secondary', 'projects') }}>Cancel</button>
                  <button onClick={async () => { try { if (projectId) { await applyProjectSopTemplate(projectId, draft); const nextStages = (draft.outline?.stages||[]).map(s=>s.name); const sections = []; (draft.outline?.stages||[]).forEach(st => { (st.sections||[]).forEach(sec => { sections.push({ id: Date.now()+Math.random(), name: String(sec.name||'Section'), color: '#3b82f6', tasks: (sec.tasks||[]).map(t => ({ id: Date.now()+Math.random(), name: String(t.title||t.name||''), done: false, status: 'working on' })), stage: st.name }); }); }); setProjectStages(nextStages.length ? nextStages : projectStages); const firstStage = nextStages[0] || currentStage; setCurrentStage(firstStage); setViewingStage(null); setProjectTasks(sections.filter(s => s.stage === firstStage)); setProjectData(prev => prev ? { ...prev, stages: nextStages, stage: firstStage, tasks: sections } : prev); } onClose(); } catch {} }} style={{ ...getButtonStyle('primary', 'projects') }}>Apply</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Stage editing handlers (edit mode working copy)
  const enterEditStages = () => {
    setWorkingStages(projectStages);
    setIsEditingStages(true);
  };

  const cancelEditStages = () => {
    setIsEditingStages(false);
    setWorkingStages(projectStages);
    setViewingStage(null);
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
    const oldStages = [...projectStages];
    // Map old stage name to new stage name by index
    const stageMap = {};
    const maxLen = Math.max(oldStages.length, newStages.length);
    for (let i = 0; i < maxLen; i++) {
      const oldName = oldStages[i];
      const newName = newStages[i];
      if (oldName && newName) stageMap[oldName] = newName;
    }
    // Remap existing task sections to preserve data
    const remappedSections = (projectData?.tasks || []).map(section => {
      const nextName = stageMap[section.stage] || section.stage;
      return { ...section, stage: nextName };
    }).filter(section => newStages.includes(section.stage));

    // Keep current mapped if possible, otherwise first
    const mappedCurrent = stageMap[currentStage] || (newStages.includes(currentStage) ? currentStage : newStages[0]);

    if (projectData?.id) {
      await updateDoc(doc(db, 'projects', projectData.id), {
        stages: newStages,
        tasks: remappedSections,
        stage: mappedCurrent
      });
    }
    setProjectStages(newStages);
    setProjectData(prev => prev ? { ...prev, stages: newStages, tasks: remappedSections, stage: mappedCurrent } : prev);
    setCurrentStage(mappedCurrent);
    setIsEditingStages(false);
    setViewingStage(null);
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

  const handleViewStage = (stage) => {
    setViewingStage(stage);
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
      // Ask for confirmation before saving edits
      setConfirmModalConfig({
        title: 'Save Changes',
        message: 'Save changes to project details?',
        confirmText: 'Save',
        confirmButtonType: 'primary',
        onConfirm: async () => {
          setShowConfirmModal(false);
          try {
            const projectRef = doc(db, "projects", projectData.id);
            // Ensure that only fields expected by Firestore are passed
            const { id, ...dataToUpdate } = updatedDetails; // Exclude 'id' if it's already part of the doc reference
            await updateDoc(projectRef, dataToUpdate);
            // Re-fetch the project to ensure we have canonical values from Firestore
            try {
              const snap = await getDoc(projectRef);
              if (snap.exists()) {
                setProjectData({ id: snap.id, ...snap.data() });
                setProjectDetails({ id: snap.id, ...snap.data() });
              } else {
                setProjectData(prev => prev ? { ...prev, ...updatedDetails } : prev);
                setProjectDetails(prev => prev ? { ...prev, ...updatedDetails } : prev);
              }
            } catch {
              setProjectData(prevData => ({ ...prevData, ...updatedDetails }));
              setProjectDetails(prevData => ({ ...prevData, ...updatedDetails }));
            }
          } catch (error) {
            console.error('Error saving project details:', error);
            alert('Failed to save project details.');
          }
        }
      });
      setShowConfirmModal(true);
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
    setConfirmModalConfig({
      title: 'Remove team member',
      message: 'Are you sure you want to remove this member from the project?',
      confirmText: 'Remove',
      confirmButtonType: 'danger',
      onConfirm: async () => {
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
        } finally {
          setShowConfirmModal(false);
        }
      }
    });
    setShowConfirmModal(true);
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
              <span style={{ fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>Stage: {currentStage || projectData?.stage}</span>
              <span style={{ opacity: 0.85 }}>|</span>
              <span style={{ fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>Deadline: {projectData?.deadline || 'No deadline'}</span>
            </div>
            <div style={{ display: "flex", gap: DESIGN_SYSTEM.spacing.base, flexShrink: 0 }}>
              <button
                onClick={() => setShowProjectSopPicker(true)}
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
                Template
              </button>
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
            {viewingStage && viewingStage !== currentStage && (
              <div style={{ padding: 8, background: '#FFFBEB', borderTop: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ color: '#92400E', fontSize: 12 }}>Viewing stage: {viewingStage}. This does not change the project stage.</div>
                <button onClick={() => setViewingStage(null)} style={{ ...getButtonStyle('secondary', 'projects'), padding: '4px 8px' }}>Return to current stage</button>
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
          gridRow: 1
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

          
          {/* Project Files Section */}
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
                Project Files
              </h3>
            </div>
            <div style={{ padding: DESIGN_SYSTEM.spacing.base }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontSize: DESIGN_SYSTEM.typography.fontSize.sm, color: DESIGN_SYSTEM.colors.text.secondary }}>Upload or create files</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button onClick={() => setShowAddFileModal(true)} style={{ ...getButtonStyle('secondary', 'projects'), padding: '6px 10px', fontSize: 12 }}>+ Upload</button>
                  <button onClick={() => createGoogleFile('gdoc')} style={{ ...getButtonStyle('secondary', 'projects'), padding: '6px 10px', fontSize: 12 }}>+ Google Doc</button>
                  <button onClick={() => createGoogleFile('gsheet')} style={{ ...getButtonStyle('secondary', 'projects'), padding: '6px 10px', fontSize: 12 }}>+ Google Sheet</button>
                  <button onClick={() => createGoogleFile('gslide')} style={{ ...getButtonStyle('secondary', 'projects'), padding: '6px 10px', fontSize: 12 }}>+ Google Slides</button>
                  <button onClick={() => setShowAttachDrive(true)} style={{ ...getButtonStyle('secondary', 'projects'), padding: '6px 10px', fontSize: 12 }}>Attach from Drive</button>
                </div>
              </div>
              {driveAuthNeeded && (
                <div style={{ marginBottom: 10, padding: 10, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, borderRadius: 8, background: '#fffbe6', color: '#7c6f00', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div>Authorize Google Drive to create, attach, and share files.</div>
                    {driveAuthError && (<div style={{ color: '#b45309', fontSize: 12, marginTop: 4 }}>Error: {driveAuthError}</div>)}
                  </div>
                  <button onClick={async () => { const t = await requestDriveConsent(); if (t) { setDriveAuthNeeded(false); setDriveAuthError(''); } }} style={{ ...getButtonStyle('secondary', 'projects'), padding: '6px 10px', fontSize: 12 }}>Authorize Google Drive</button>
                </div>
              )}
              {Array.isArray(projectData?.files) && projectData.files.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                  {projectData.files.map((f, i) => (
                    <div key={i} style={{ display: 'contents' }}>
                      <div
                        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8, cursor: 'default' }}
                        onDoubleClick={() => {
                          if (f.type === 'gdoc' || f.type === 'gsheet' || f.type === 'gslide') {
                            setGoogleViewerType(f.type); setGoogleViewerId(f.driveId); setGoogleViewerTitle(f.name || 'Google File'); setShowGoogleViewer(true);
                          } else if (f.url) {
                            setPreviewFile(f); setShowPreview(true);
                          }
                        }}
                        title="Double-click to open"
                      >
                        {f.type === 'gdoc' && (<span style={{ padding: '2px 6px', borderRadius: 9999, background: '#1a73e8', color: '#fff', fontSize: 10, fontWeight: 600 }}>Doc</span>)}
                        {f.type === 'gsheet' && (<span style={{ padding: '2px 6px', borderRadius: 9999, background: '#34a853', color: '#fff', fontSize: 10, fontWeight: 600 }}>Sheet</span>)}
                        {f.type === 'gslide' && (<span style={{ padding: '2px 6px', borderRadius: 9999, background: '#fbbc05', color: '#111827', fontSize: 10, fontWeight: 700 }}>Slides</span>)}
                        {(!f.type || (f.type !== 'gdoc' && f.type !== 'gsheet' && f.type !== 'gslide')) && (<span>{f.type === 'image' ? '🖼️' : '📄'}</span>)}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name || 'File'}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => setActionsFile(f)} style={{ ...getButtonStyle('secondary', 'projects'), padding: '4px 8px', fontSize: 12 }}>Edit</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>No files attached.</div>
              )}
              {isUploadingProjectFile && (
                <div style={{ marginTop: 8, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, color: DESIGN_SYSTEM.colors.text.secondary }}>Uploading…</div>
              )}
            </div>
          </div>

          {/* Team Members Section */}
          <div style={{
            ...getCardStyle('projects'),
            flex: "1 1 300px", 
            minHeight: "250px",
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
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
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

          {/* Project Forum Section */}
          <div style={{
            ...getCardStyle('projects'),
            flex: "1 1 350px", 
            minHeight: "300px",
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
            <div style={{ flex: 1, overflow: "visible" }}>
            <ProjectGroupForum 
              projectId={projectId} 
                forums={projectForums}
            />
          </div>
          </div>

          {/* Leave Project Button at bottom of left panel */}
          <div style={{
            marginTop: 'auto',
            padding: DESIGN_SYSTEM.spacing.base
          }}>
            <button
              onClick={() => {
                if (!currentUser || !projectData?.id) return;
                setConfirmModalConfig({
                  title: 'Leave Project',
                  message: 'Leave this project? You will be removed from the team.',
                  confirmText: 'Leave',
                  confirmButtonType: 'danger',
                  onConfirm: async () => {
                    setShowConfirmModal(false);
                    try {
                      await updateDoc(doc(db, 'projects', projectData.id), {
                        team: (projectData.team || []).filter(uid => uid !== currentUser.uid)
                      });
                      navigate('/project');
                    } catch (e) {
                      alert('Failed to leave project.');
                    }
                  }
                });
                setShowConfirmModal(true);
              }}
              style={{
                ...getButtonStyle('secondary', 'projects'),
                background: '#fee2e2',
                color: '#b91c1c',
                border: '1px solid #fecaca',
                width: '100%',
                padding: `${DESIGN_SYSTEM.spacing.base} ${DESIGN_SYSTEM.spacing.lg}`,
                fontSize: DESIGN_SYSTEM.typography.fontSize.base,
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold
              }}
            >
              Leave Project
            </button>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ 
          display: "flex", 
          flexDirection: "column", 
          gap: DESIGN_SYSTEM.spacing.lg, 
          gridColumn: 2, 
            gridRow: 1,
            minWidth: '0',
            overflowX: 'hidden' 
        }}>
          {/* Project Stages + inline Tasks Section */}
          <div style={{
            ...getCardStyle('projects'),
              padding: 0,
              overflow: 'hidden',
              minWidth: '0'
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
              <div style={{ display: 'flex', gap: DESIGN_SYSTEM.spacing.xs, alignItems: 'center' }}>
                {!isEditingStages ? (
                  <button
                    onClick={enterEditStages}
                    style={{
                      ...getButtonStyle('secondary', 'projects'),
                      background: 'rgba(255,255,255,0.2)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.base}`,
                      fontSize: DESIGN_SYSTEM.typography.fontSize.sm
                    }}
                  >
                    Edit Stages
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSaveStages}
                      style={{
                        ...getButtonStyle('primary', 'projects'),
                        padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.base}`,
                        fontSize: DESIGN_SYSTEM.typography.fontSize.sm
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEditStages}
                      style={{
                        ...getButtonStyle('secondary', 'projects'),
                        background: 'rgba(255,255,255,0.2)',
                        border: '1px solid rgba(255,255,255,0.3)',
                        padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.base}`,
                        fontSize: DESIGN_SYSTEM.typography.fontSize.sm
                      }}
                    >
                      Cancel
                    </button>
                  </>
                )}
                {!isEditingStages && (
                <button
                  onClick={() => handleSendApprovalRequest()}
                  disabled={false}
                  style={{
                    ...getButtonStyle('secondary', 'projects'),
                    background: 'rgba(255,255,255,0.2)',
                    color: DESIGN_SYSTEM.colors.text.inverse,
                    border: `1px solid rgba(255,255,255,0.3)`,
                    padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.base}`,
                    fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                    cursor: 'pointer'
                  }}
                >
                  Send Approval
                </button>
                )}
                {!isEditingStages && (
                  <button
                    onClick={() => setStagesCollapsed(v => !v)}
                    style={{
                      ...getButtonStyle('secondary', 'projects'),
                      background: 'rgba(255,255,255,0.2)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.base}`,
                      fontSize: DESIGN_SYSTEM.typography.fontSize.sm
                    }}
                    title={stagesCollapsed ? 'Expand' : 'Collapse'}
                  >
                    {stagesCollapsed ? 'Expand' : 'Collapse'}
                  </button>
                )}
              </div>
          </div>
            {!stagesCollapsed && (
            <div style={{ padding: DESIGN_SYSTEM.spacing.base, overflowX: 'auto', maxWidth: '100%', width: '100%', boxSizing: 'border-box', minWidth: '0' }}>
               <StageIndicator 
                 currentStage={currentStage} 
                 displayStage={viewingStage || currentStage}
                 allStages={isEditingStages ? workingStages : projectStages} 
                 onAdvanceStage={handleAdvanceStage} 
                 onGoBackStage={handleGoBackStage} 
                 onViewStage={handleViewStage}
                 isCurrentStageTasksComplete={isCurrentStageTasksComplete}
                 onStageSelect={handleStageSelect}
                 canAdvance={canAdvanceStage}
                 editing={isEditingStages}
                 onAddStage={handleAddStage}
                 onDeleteStageAt={handleDeleteStageAt}
                 onRenameStage={handleRenameStageAt}
                 onMoveStageLeft={handleMoveStageLeft}
                 onMoveStageRight={handleMoveStageRight}
                 isStageApprovalPending={stageApprovalPending}
               />
            </div>
            )}
            {!stagesCollapsed && (
              <div style={{ padding: DESIGN_SYSTEM.spacing.base, borderTop: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <h4 style={{ margin: 0 }}></h4>
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <ProjectTaskPanel 
                    projectTasks={projectTasks}
                    setProjectTasks={setProjectTasks}
                    currentStage={currentStage} 
                    projectId={projectId}
                    setProjectData={setProjectData}
                    projectMembers={projectTeamMembersDetails}
                    activeStageName={viewingStage || currentStage}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Finance Section - moved below Project Tasks */}
          <div style={{
            ...getCardStyle('projects'),
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: '480px'
          }}>
            <FinancePanel projectId={projectId} />
          </div>
        </div>
      </div>
      </div>
      {showProjectSopPicker && (
        <ProjectSopPicker onClose={() => setShowProjectSopPicker(false)} />
      )}
      {/* Drive & embed modals */}
      <GoogleEmbedModal isOpen={showGoogleViewer} onClose={() => setShowGoogleViewer(false)} fileType={googleViewerType} driveId={googleViewerId} title={googleViewerTitle} />
      <AttachDriveFileModal isOpen={showAttachDrive} onClose={() => setShowAttachDrive(false)} onSelect={async (file) => {
        try {
          if (!projectId) return;
          const next = Array.isArray(projectData?.files) ? [...projectData.files, file] : [file];
          await updateDoc(doc(db, 'projects', projectId), { files: next });
          setProjectData(prev => ({ ...(prev || {}), files: next }));
          setShowAttachDrive(false);
        } catch { alert('Failed to attach Drive file'); }
      }} />
      <PreviewModal isOpen={showPreview} onClose={() => setShowPreview(false)} file={previewFile} />
      <DriveShareModal isOpen={!!shareFile} onClose={() => setShareFile(null)} file={shareFile} />
      <FileActionsModal
        isOpen={!!actionsFile}
        file={actionsFile}
        onClose={() => setActionsFile(null)}
        onOpen={(f) => { setActionsFile(null); setGoogleViewerType(f.type); setGoogleViewerId(f.driveId); setGoogleViewerTitle(f.name || 'Google File'); setShowGoogleViewer(true); }}
        onPreview={(f) => { setActionsFile(null); setPreviewFile(f); setShowPreview(true); }}
        onCopyLink={() => {}}
        onShare={(f) => { setActionsFile(null); setShareFile(f); }}
        onRename={async (f, nextName) => { setActionsFile(null); if (!nextName || nextName === f.name) return; await renameGoogleFile(f, nextName); }}
        onDelete={async (f) => {
          setActionsFile(null);
          if (f.type === 'gdoc' || f.type === 'gsheet' || f.type === 'gslide') { await deleteGoogleFile(f); }
          else {
            // reuse existing delete flow
            setConfirmModalConfig({
              title: 'Delete File',
              message: `Delete "${f.name || 'this file'}" from project files?`,
              confirmText: 'Delete',
              confirmButtonType: 'danger',
              onConfirm: async () => {
                setShowConfirmModal(false);
                setTimeout(() => {
                  setConfirmModalConfig({
                    title: 'Confirm Permanent Delete',
                    message: 'This will permanently delete the file from storage and cannot be undone.',
                    confirmText: 'Delete Permanently',
                    confirmButtonType: 'danger',
                    onConfirm: async () => {
                      try {
                        if (!f.url) { alert('No URL to delete'); return; }
                        let fileRef;
                        try {
                          const m = (f.url || '').match(/\/v0\/b\/([^/]+)\/o\/([^?]+)/);
                          if (m) { const objectPath = decodeURIComponent(m[2]); fileRef = storageRef(storage, objectPath); }
                        } catch {}
                        if (fileRef) { await deleteObject(fileRef); }
                        const remaining = (projectData.files || []).filter((x) => x !== f);
                        await updateDoc(doc(db, 'projects', projectId), { files: remaining });
                        setProjectData(prev => ({ ...(prev || {}), files: remaining }));
                      } catch (e) { alert('Failed to delete file'); }
                      finally { setShowConfirmModal(false); }
                    }
                  });
                  setShowConfirmModal(true);
                }, 0);
              }
            });
            setShowConfirmModal(true);
          }
        }}
      />
      
      {/* Add File Modal */}
      {showAddFileModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowAddFileModal(false)}>
          <div onClick={(e)=>e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 420, maxWidth: '92vw', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', padding: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Add Project File</div>
            <p style={{ margin: 0, color: DESIGN_SYSTEM.colors.text.secondary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>Choose a file to upload. Supported: any document or image.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <input ref={filePickerRef} type="file" onChange={async (e) => {
                try {
                  const file = e.target.files && e.target.files[0];
                  if (!file || !projectId) return;
                  setIsUploadingProjectFile(true);
                  const path = `project_files/${projectId}/${Date.now()}_${file.name}`;
                  const sref = storageRef(storage, path);
                  await uploadBytes(sref, file);
                  const url = await getDownloadURL(sref);
                  const fileEntry = { name: file.name, type: file.type && file.type.startsWith('image/') ? 'image' : 'document', url, size: file.size, uploadTime: Date.now() };
                  await updateDoc(doc(db, 'projects', projectId), { files: Array.isArray(projectData?.files) ? [...projectData.files, fileEntry] : [fileEntry] });
                  setShowAddFileModal(false);
                } catch { alert('Failed to upload file'); } finally {
                  setIsUploadingProjectFile(false);
                  if (e.target) { try { e.target.value = ''; } catch {} }
                }
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button onClick={() => setShowAddFileModal(false)} style={{ ...getButtonStyle('secondary', 'projects'), padding: '6px 10px' }}>Close</button>
            </div>
          </div>
        </div>
      )}

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

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={confirmModalConfig.onConfirm}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        confirmText={confirmModalConfig.confirmText}
        confirmButtonType={confirmModalConfig.confirmButtonType}
      />
    </div>
  );
}
