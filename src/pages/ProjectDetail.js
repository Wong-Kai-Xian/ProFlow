import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import TopBar from '../components/TopBar';
import ProjectDetails from '../components/project-component/ProjectDetails';
import Reminders from '../components/project-component/Reminders';
import ProjectTaskPanel from '../components/project-component/ProjectTaskPanel';
import ProjectGroupForum from '../components/ProjectGroupForum';
import StageIndicator from '../components/project-component/StageIndicator';
import ApprovalModal from '../components/project-component/ApprovalModal';
import AdvanceStageChoiceModal from '../components/project-component/AdvanceStageChoiceModal';
import SendApprovalModal from '../components/project-component/SendApprovalModal';
import AddTeamMemberModal from '../components/project-component/AddTeamMemberModal';
import TeamMembersPanel from '../components/project-component/TeamMembersPanel';
import { db } from "../firebase";
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot, getDocs, arrayUnion, arrayRemove, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from '../contexts/AuthContext';
import { DESIGN_SYSTEM, getPageContainerStyle, getCardStyle, getContentContainerStyle, getButtonStyle } from '../styles/designSystem';

const DEFAULT_STAGES = ["Planning", "Development", "Testing", "Completed"];

export default function ProjectDetail() {
  const { projectId } = useParams(); // Changed from projectName to projectId
  const [projectData, setProjectData] = useState(null);
  const [projectStages, setProjectStages] = useState(DEFAULT_STAGES);
  const [currentStage, setCurrentStage] = useState(DEFAULT_STAGES[0]);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showAdvanceChoiceModal, setShowAdvanceChoiceModal] = useState(false);
  const [showSendApprovalModal, setShowSendApprovalModal] = useState(false);
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

  const startTranscription = async () => {
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { alert('Transcription not supported in this browser. Try Chrome.'); return; }
      if (!meetingSessionId) {
        // Create meeting session doc
        const ref = await addDoc(collection(db, 'meetingSessions'), { projectId, startedAt: serverTimestamp(), participants: meetingParticipants });
        setMeetingSessionId(ref.id);
      }
      const rec = new SR();
      recognitionRef.current = rec;
      rec.lang = 'en-US';
      rec.interimResults = true;
      rec.continuous = true;
      rec.onresult = async (e) => {
        let finalText = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) {
            finalText += t + ' ';
          } else {
            setLiveTranscript(t);
          }
        }
        if (finalText.trim() && meetingSessionId) {
          await addDoc(collection(db, 'meetingSessions', meetingSessionId, 'transcripts'), {
            text: finalText.trim(),
            userId: currentUser?.uid || 'anon',
            createdAt: serverTimestamp()
          });
          setLiveTranscript('');
        }
      };
      rec.onerror = (e) => console.warn('SpeechRecognition error', e);
      rec.onend = () => { if (isTranscribing) rec.start(); };
      rec.start();
      setIsTranscribing(true);
    } catch (e) {
      console.error(e);
      alert('Failed to start transcription.');
    }
  };

  const stopTranscription = async () => {
    setIsTranscribing(false);
    try { recognitionRef.current && recognitionRef.current.stop(); } catch {}
    recognitionRef.current = null;
    if (meetingSessionId) {
      await updateDoc(doc(db, 'meetingSessions', meetingSessionId), { endedAt: serverTimestamp() });
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
        // Ask whether to require approval or advance directly
        setShowAdvanceChoiceModal(true);
      } else {
        alert("All tasks in the current stage must be marked as 'Complete' before advancing.");
      }
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
    setShowMeeting(false);
    setMeetingMinimized(false);
    setSuppressMeetingBar(true);
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
      
      <div style={{
        ...getContentContainerStyle(),
        paddingTop: DESIGN_SYSTEM.spacing['2xl']
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
                <Reminders projectId={projectId} /> 
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
                  onClick={() => !currentApproval && setShowSendApprovalModal(true)}
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
