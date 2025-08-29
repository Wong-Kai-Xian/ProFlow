import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";
import TopBar from "../components/TopBar";
import ForumTabs from "../components/ForumTabs";
import ProjectDetails from "../components/project-component/ProjectDetails";
import ForumReminders from "../components/forum-tabs/ForumReminders";
import StarredPosts from "../components/forum-tabs/StarredPosts";
import ActiveUsers from "../components/forum-tabs/ActiveUsers";
import FloatingCreateButton from "../components/forum-tabs/FloatingCreateButton";
import CreatePostModal from "../components/forum-tabs/CreatePostModal";
import InviteMemberModal from "../components/forum-component/InviteMemberModal";
import { db } from "../firebase";
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, getDocs, getDoc, arrayUnion, arrayRemove, addDoc, deleteDoc, query, where } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { DESIGN_SYSTEM, getPageContainerStyle, getCardStyle, getContentContainerStyle, getButtonStyle } from '../styles/designSystem';
import { useNavigate } from 'react-router-dom';
import ConfirmationModal from '../components/common/ConfirmationModal';

// Gemini helpers for AI analysis
const callGeminiForSummary = async (promptText) => {
  const key = localStorage.getItem('gemini_api_key');
  if (!key) throw new Error('Missing GEMINI API key. Please set it in the Personal Assistant.');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${encodeURIComponent(key)}`;
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: `You are a meeting assistant. Given the raw transcript, return JSON with keys: summary (string) and action_items (array of objects with title (string), assignee (optional), deadline (optional YYYY-MM-DD or natural language)).\nTranscript:\n${promptText}` }
        ]
      }
    ],
    generationConfig: { temperature: 0.3, maxOutputTokens: 1500 }
  };
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return text;
};

const safeParseJson = (text) => {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    const raw = match ? match[0] : text;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export default function Forum() {
  const { id: forumId } = useParams(); // Rename `id` to `forumId` for clarity
  const location = useLocation();
  const navigate = useNavigate();
  const autoOpenReminderId = React.useMemo(() => {
    try {
      const sp = new URLSearchParams(location.search);
      return sp.get('reminderId') || null;
    } catch { return null; }
  }, [location.search]);
  const { currentUser } = useAuth(); // Get currentUser from AuthContext
  console.log("Forum.js: forumId from useParams:", forumId);
  const [forumData, setForumData] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [posts, setPosts] = useState([]); // This will eventually come from Discussion tab's Firestore logic
  const [linkedProjectData, setLinkedProjectData] = useState(null); // State for actual project data
  const [showInviteModal, setShowInviteModal] = useState(false); // State for the new Invite Member modal
  const [forumMembers, setForumMembers] = useState([]); // Will be populated from forumData (UIDs)
  const [enrichedForumMembersDetails, setEnrichedForumMembersDetails] = useState([]); // Enriched member data
  const [showMeeting, setShowMeeting] = useState(false);
  const [meetingMinimized, setMeetingMinimized] = useState(false);
  const [meetingParticipants, setMeetingParticipants] = useState([]);
  const [suppressMeetingBar, setSuppressMeetingBar] = useState(false);

  // Transcription/session state
  const [meetingSessionId, setMeetingSessionId] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [sessionTranscripts, setSessionTranscripts] = useState([]);
  const recognitionRef = React.useRef(null);

  // Saved transcript files for this forum
  const [meetingTranscriptsList, setMeetingTranscriptsList] = useState([]);
  const meetingIframeRef = React.useRef(null);

  // AI modal state
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiModalLoading, setAiModalLoading] = useState(false);
  const [aiModalError, setAiModalError] = useState("");
  const [aiModalItems, setAiModalItems] = useState([]);
  const [aiModalTarget, setAiModalTarget] = useState('tasks');
  const [aiModalSelection, setAiModalSelection] = useState({});
  const [aiModalTranscriptDoc, setAiModalTranscriptDoc] = useState(null);
  
  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState({
    title: '',
    message: '',
    onConfirm: () => {},
    confirmText: 'Confirm',
    confirmButtonType: 'primary'
  });

  // Simple local buffering for forum transcription
  const lastInterimSaveRef = React.useRef(0);
  const transcriptBufferRef = React.useRef("");

  const startTranscription = async () => {
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { alert('Transcription not supported in this browser. Try Chrome.'); return; }
      const rec = new SR();
      recognitionRef.current = rec;
      rec.lang = 'en-US';
      rec.interimResults = true;
      rec.continuous = true;
      rec.maxAlternatives = 1;
      const lastSavedFinalRef = { current: '' };
      rec.onresult = async (e) => {
        let finalText = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) {
            finalText += t + ' ';
          } else {
            setLiveTranscript(t);
            // Do not push interim lines into sessionTranscripts to avoid duplicates
          }
        }
        const clean = finalText.trim();
        if (clean) {
          transcriptBufferRef.current = `${transcriptBufferRef.current} ${clean}`.trim();
          const prev = (lastSavedFinalRef.current || '').trim();
          const isDup = !!prev && (clean === prev || prev.endsWith(clean) || clean.endsWith(prev));
          if (!isDup) {
            const now = Date.now();
            setSessionTranscripts(prevList => [...prevList, { id: String(now + Math.random()), text: clean, createdAtMs: now }]);
            lastSavedFinalRef.current = clean;
          }
          setLiveTranscript('');
        }
      };
      rec.onerror = (e) => {
        console.warn('Forum SpeechRecognition error', e);
        if (isTranscribing) {
          try { rec.start(); } catch {}
        }
      };
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
    try { recognitionRef.current && recognitionRef.current.abort && recognitionRef.current.abort(); } catch {}
    recognitionRef.current = null;
  };

  useEffect(() => {
    if (!forumId) return; // Exit if no forumId

    const forumRef = doc(db, "forums", forumId);
    const unsubscribeForum = onSnapshot(forumRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setForumData(data);
        setForumMembers(data.members || []); // Update forumMembers with UIDs
        setMeetingParticipants(data.meetingParticipants || []);
        if ((data.meetingParticipants || []).length > 0 && !showMeeting && !suppressMeetingBar) {
          setMeetingMinimized(true);
        }
      } else {
        console.log("No such forum document!");
        setForumData(null);
        setForumMembers([]);
        setMeetingParticipants([]);
      }
    });

    return () => unsubscribeForum();
  }, [forumId, showMeeting, suppressMeetingBar]);

  // When visiting a forum, mark all forum-related notifications for this forum as read for the current user
  useEffect(() => {
    if (!forumId || !currentUser?.uid) return;
    let cancelled = false;
    (async () => {
      try {
        const notifQuery = query(collection(db, 'users', currentUser.uid, 'notifications'));
        const snap = await getDocs(notifQuery);
        const updates = [];
        snap.forEach(d => {
          const n = d.data();
          if (n && n.unread && n.origin === 'forum' && n.forumId === forumId) {
            updates.push(updateDoc(doc(db, 'users', currentUser.uid, 'notifications', d.id), { unread: false }));
          }
        });
        if (!cancelled && updates.length) await Promise.allSettled(updates);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [forumId, currentUser?.uid]);

  // Effect to fetch linked project data in real-time
  useEffect(() => {
    if (!forumData?.projectId) {
      setLinkedProjectData(null);
      return;
    }

    const projectRef = doc(db, "projects", forumData.projectId);
    const unsubscribeProject = onSnapshot(projectRef, (projectSnap) => {
      if (projectSnap.exists()) {
        setLinkedProjectData({ id: projectSnap.id, ...projectSnap.data() });
      } else {
        setLinkedProjectData(null);
        console.warn("Linked project not found.", forumData.projectId);
      }
    });

    return () => unsubscribeProject();
  }, [forumData?.projectId]);

  // Effect to compute actual post count for Home forums list consumers
  useEffect(() => {
    if (!forumId) return;
    const postsRef = collection(db, 'forums', forumId, 'posts');
    const unsub = onSnapshot(postsRef, (snap) => {
      const count = snap.size;
      setForumData(prev => prev ? { ...prev, actualPostCount: count } : prev);
    });
    return () => unsub();
  }, [forumId]);

  // Effect to fetch details for forum members
  useEffect(() => {
    if (!forumMembers || forumMembers.length === 0) {
      setEnrichedForumMembersDetails([]);
      return;
    }

    const fetchMemberDetails = async () => {
      const fetchedDetails = await Promise.all(
        forumMembers.map(async (memberUid) => {
          try {
            // 1) Try doc by ID
            const byIdRef = doc(db, 'users', memberUid);
            const byIdSnap = await getDoc(byIdRef);
            if (byIdSnap.exists()) {
              const d = byIdSnap.data();
              return {
                id: memberUid,
                name: d.name || d.displayName || d.email || 'Forum Member',
                email: d.email || 'No email provided',
                status: 'online',
                role: 'Member'
              };
            }
            // 2) Fallback: query by uid field (some datasets store UID in a field)
            try {
              const q = query(collection(db, 'users'), where('uid', '==', memberUid));
              const snap = await getDocs(q);
              if (!snap.empty) {
                const docu = snap.docs[0];
                const d = docu.data();
                return {
                  id: memberUid,
                  name: d.name || d.displayName || d.email || 'Forum Member',
                  email: d.email || 'No email provided',
                  status: 'online',
                  role: 'Member'
                };
              }
            } catch {}
            // 3) Last resort: if it's the current user, use auth info
            if (currentUser && memberUid === currentUser.uid) {
              return {
                id: memberUid,
                name: currentUser.name || currentUser.displayName || currentUser.email || 'You',
                email: currentUser.email || 'No email provided',
                status: 'online',
                role: 'Member'
              };
            }
          } catch {}
          // 4) Fallback generic
          console.warn(`User record not found for forum member: ${memberUid}`);
          return {
            id: memberUid,
            name: 'Forum Member',
            email: 'User not found',
            status: 'offline',
            role: 'Member'
          };
        })
      );
      setEnrichedForumMembersDetails(fetchedDetails);
    };

    fetchMemberDetails();
  }, [forumMembers, currentUser]);

  // Effect to listen to forum meeting transcripts collection
  useEffect(() => {
    if (!forumId) return;
    const colRef = collection(db, 'forums', forumId, 'meetingTranscripts');
    const unsub = onSnapshot(colRef, snap => {
      const files = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
      setMeetingTranscriptsList(files);
    });
    return () => unsub();
  }, [forumId]);

  // Function to update lastActivity in Firestore whenever there's relevant activity
  const updateForumLastActivity = async () => {
    if (forumId) {
      const forumRef = doc(db, "forums", forumId);
      try {
        await updateDoc(forumRef, { lastActivity: serverTimestamp() });
      } catch (error) {
        console.error("Error updating forum last activity: ", error);
      }
    }
  };

  // Function to update post count in the main forum document
  const updateForumPostCount = async (incrementBy) => {
    if (forumId) {
      const forumRef = doc(db, "forums", forumId);
      try {
        // Use FieldValue.increment if you have it imported, otherwise fetch, update, and set
        // For simplicity and to avoid importing FieldValue, we'll do a read-modify-write
        const docSnap = await getDoc(forumRef);
        if (docSnap.exists()) {
          const currentPosts = docSnap.data().posts || 0;
          await updateDoc(forumRef, { posts: currentPosts + incrementBy });
        }
      } catch (error) {
        console.error("Error updating forum post count: ", error);
      }
    }
  };

  const handleJoinMeeting = async () => {
    if (!forumId || !currentUser) return;
    const forumRef = doc(db, 'forums', forumId);
    await updateDoc(forumRef, { meetingParticipants: arrayUnion(currentUser.uid) });
    setShowMeeting(true);
    setMeetingMinimized(false);
    setSuppressMeetingBar(false);
  };

  const handleLeaveMeeting = async () => {
    if (!forumId || !currentUser) return;
    const forumRef = doc(db, 'forums', forumId);
    await updateDoc(forumRef, { meetingParticipants: arrayRemove(currentUser.uid) });
  };

  const userHasJoinedMeeting = meetingParticipants.includes(currentUser?.uid || "");

  const handleToggleMeeting = async () => {
    if (!showMeeting && !meetingMinimized) {
      setShowMeeting(true);
      setMeetingMinimized(false);
      setSuppressMeetingBar(false);
      return;
    }
    if (userHasJoinedMeeting) {
      await handleLeaveMeeting();
    }
    // Always hard-stop mic recognition regardless of local state
    try { await stopTranscription(); } catch {}
    // Force release media from iframe
    try { if (meetingIframeRef.current) { meetingIframeRef.current.src = 'about:blank'; } } catch {}
    setShowMeeting(false);
    setMeetingMinimized(false);
    setSuppressMeetingBar(true);
  };

  // Mock data functions (handlePostSubmit, handleAddMember, handleRemoveMember) will be modified later
  // to interact with Firebase based on individual tab/modal integrations.
  const handleTrendingPostClick = (post) => {
    // This remains mostly UI related, but ensure it points to correct post IDs
    const postElement = document.getElementById(`post-${post.id}`);
    if (postElement) {
      postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      postElement.style.backgroundColor = '#E8F4FD';
      setTimeout(() => {
        postElement.style.backgroundColor = 'transparent'; // Revert to transparent or original background
      }, 2000);
    }
  };

  const handleAddMember = async (newMember) => {
    if (newMember.trim() && forumData && !forumData.members?.includes(newMember.trim())) {
      const updatedMembers = [...(forumData.members || []), newMember.trim()];
      try {
        const forumRef = doc(db, "forums", forumId);
        await updateDoc(forumRef, { members: updatedMembers });
        // setForumMembers is updated by onSnapshot listener, so no need to call it here
        updateForumLastActivity(); // Update last activity on member change
      } catch (error) {
        console.error("Error adding member: ", error);
      }
    }
  };

  const handleRemoveMember = async (memberToRemove) => {
    if (forumData) {
      const updatedMembers = forumData.members.filter(member => member !== memberToRemove);
      try {
        const forumRef = doc(db, "forums", forumId);
        await updateDoc(forumRef, { members: updatedMembers });
        // setForumMembers is updated by onSnapshot listener
        updateForumLastActivity(); // Update last activity on member change
      } catch (error) {
        console.error("Error removing member: ", error);
      }
    }
  };

  if (!forumData) {
    return (
      <div style={getPageContainerStyle()}>
        <TopBar />
        <div style={{ textAlign: "center", padding: "50px", color: DESIGN_SYSTEM.colors.text.secondary }}>
          Loading forum details...
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
        {/* Enhanced Forum Header */}
        <div style={{
          background: DESIGN_SYSTEM.pageThemes.forums.gradient,
          borderRadius: DESIGN_SYSTEM.borderRadius.xl,
          padding: DESIGN_SYSTEM.spacing.xl,
          marginBottom: DESIGN_SYSTEM.spacing.lg,
          boxShadow: DESIGN_SYSTEM.shadows.lg,
          color: DESIGN_SYSTEM.colors.text.inverse
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div>
              <h1 style={{
                margin: `0 0 ${DESIGN_SYSTEM.spacing.xs} 0`,
                fontSize: DESIGN_SYSTEM.typography.fontSize['3xl'],
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.bold
              }}>
                {forumData?.name}
              </h1>
              <p style={{
                margin: 0,
                fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
                opacity: 0.9
              }}>
                {forumData?.description || 'Team collaboration space'} • {forumData?.members?.length || 0} members
              </p>
            </div>
            <div style={{ display: 'flex', gap: DESIGN_SYSTEM.spacing.base }}>
              <button
                onClick={handleToggleMeeting}
                style={{
                  ...getButtonStyle('primary', 'forums'),
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
              <button
                onClick={() => setShowInviteModal(true)}
                style={{
                  ...getButtonStyle('primary', 'forums'),
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
                Invite Members
              </button>
            </div>
          </div>
        </div>

        {/* Meeting Section */}
        {(showMeeting || meetingMinimized) && (
          <div style={{
            ...getCardStyle('forums'),
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
                  <button onClick={() => setShowMeeting(true)} style={{ ...getButtonStyle('secondary', 'forums') }}>Expand</button>
                </div>
              </div>
            )}
            {/* Expanded meeting */}
            {showMeeting && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: DESIGN_SYSTEM.spacing.base, background: DESIGN_SYSTEM.pageThemes.forums.gradient, color: DESIGN_SYSTEM.colors.text.inverse, borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0` }}>
                  <div>Forum Meeting</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {userHasJoinedMeeting ? (
                      <>
                        <button onClick={isTranscribing ? stopTranscription : startTranscription} style={{ ...getButtonStyle('secondary', 'forums') }}>{isTranscribing ? 'Stop Transcribe' : 'Transcribe'}</button>
                        <button onClick={handleLeaveMeeting} style={{ ...getButtonStyle('secondary', 'forums') }}>Leave</button>
                      </>
                    ) : (
                      <button onClick={handleJoinMeeting} style={{ ...getButtonStyle('secondary', 'forums') }}>Join</button>
                    )}
                    <button onClick={() => { setMeetingMinimized(true); setShowMeeting(false); }} style={{ ...getButtonStyle('secondary', 'forums') }}>Minimize</button>
                  </div>
                </div>
                <div style={{ width: '100%', height: '600px', background: '#000' }}>
                  {userHasJoinedMeeting ? (
                    <iframe
                      title="Forum Meeting"
                      src={`https://meet.jit.si/forum-${forumId}-meeting`}
                      ref={meetingIframeRef}
                      style={{ width: '100%', height: '100%', border: '0', borderRadius: `0 0 ${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg}` }}
                      allow="camera; microphone; fullscreen; display-capture"
                    />
                  ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>
                      Click Join to connect to the meeting
                    </div>
                  )}
                </div>
                {/* Simple transcript capture bar to match project behavior */}
                <div style={{ padding: DESIGN_SYSTEM.spacing.base, background: '#f8fafc', borderTop: `1px solid ${DESIGN_SYSTEM.colors.border}` }}>
                  <div style={{ fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold, marginBottom: DESIGN_SYSTEM.spacing.xs }}>Transcript</div>
                  <div style={{ maxHeight: 160, overflowY: 'auto', fontSize: DESIGN_SYSTEM.typography.fontSize.sm, color: DESIGN_SYSTEM.colors.text.primary, background: '#fff', border: `1px solid ${DESIGN_SYSTEM.colors.border}`, borderRadius: DESIGN_SYSTEM.borderRadius.lg, padding: DESIGN_SYSTEM.spacing.base }}>
                    {(sessionTranscripts || []).map((line) => (
                      <div key={line.id} style={{ marginBottom: 6 }}>
                        <span style={{ color: DESIGN_SYSTEM.colors.text.secondary, marginRight: 6 }}>{new Date((line.createdAtMs || 0) * 1000).toLocaleTimeString()}</span>
                        {line.text}
                      </div>
                    ))}
                    {liveTranscript && (
                      <div style={{ opacity: 0.7 }}>{liveTranscript}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: DESIGN_SYSTEM.spacing.xs }}>
                    <button
                      onClick={async () => {
                        // Save combined transcript as file
                        const text = [(sessionTranscripts || []).map(t => `${new Date((t.createdAt?.seconds||0)*1000).toLocaleTimeString()} ${t.text}`).join('\n'), liveTranscript].filter(Boolean).join('\n').trim();
                        if (!text) { alert('No transcript available.'); return; }
                        const fileName = `forum-transcript-${new Date().toISOString().replace(/[:.]/g,'-')}.txt`;
                        await addDoc(collection(db, 'forums', forumId, 'meetingTranscripts'), {
                          name: fileName,
                          mimeType: 'text/plain',
                          size: text.length,
                          createdAt: serverTimestamp(),
                          createdBy: currentUser?.uid || 'anon',
                          content: text
                        });
                        // Clear the current transcript view after saving
                        setSessionTranscripts([]);
                        setLiveTranscript('');
                      }}
                      style={{ ...getButtonStyle('primary', 'forums'), padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.base}` }}
                    >
                      Generate Transcript
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr 300px",
          gridTemplateRows: "1fr",
          gap: DESIGN_SYSTEM.spacing.xl,
          minHeight: "calc(100vh - 300px)"
        }}>
        {/* Left column: Project Details + Reminders */}
        <div style={{ 
          position: "sticky",
          top: DESIGN_SYSTEM.spacing.xl,
          display: "flex", 
          flexDirection: "column", 
          gap: DESIGN_SYSTEM.spacing.base,
          height: "calc(180vh - 320px)", // 50% longer
          overflowY: "auto"
        }}>

          {/* Project Details Section - 50% height */}
          <div style={{
            ...getCardStyle('forums'),
            height: "calc(50% - 8px)", // 50% minus half the gap
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{
              background: DESIGN_SYSTEM.pageThemes.forums.accent,
              color: DESIGN_SYSTEM.colors.text.inverse,
              padding: DESIGN_SYSTEM.spacing.base,
              borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`,
              flexShrink: 0
            }}>
              <h3 style={{
                margin: 0,
                fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold
              }}>
                Project Details
              </h3>
            </div>
            <div style={{ 
              flex: 1,
              overflow: "auto",
              padding: 0
            }}>
              {linkedProjectData ? (
                <div style={{ padding: '16px', height: '100%' }}>
                  <ProjectDetails 
                    project={linkedProjectData} 
                    readOnly={true}
                    noCard={true}
                  />
                </div>
              ) : (
                <div style={{
                  padding: DESIGN_SYSTEM.spacing.base,
                  textAlign: "center",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <p style={{ 
                    color: DESIGN_SYSTEM.colors.text.secondary, 
                    fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                    margin: 0
                  }}>
                    No project linked to this forum.
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Reminders Section - 50% height */}
          <div style={{
            ...getCardStyle('forums'),
            height: "calc(50% - 8px)", // 50% minus half the gap
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{
              background: DESIGN_SYSTEM.pageThemes.forums.accent,
              color: DESIGN_SYSTEM.colors.text.inverse,
              padding: DESIGN_SYSTEM.spacing.base,
              borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`,
              flexShrink: 0
            }}>
              <h3 style={{
                margin: 0,
                fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold
              }}>
                Reminders
              </h3>
            </div>
            <div style={{ 
              flex: 1,
              overflow: "auto",
              padding: 0
            }}>
              <ForumReminders forumId={forumId} autoOpenReminderId={autoOpenReminderId} />
            </div>
          </div>

          {/* Meeting Transcripts Section (below Reminders, taller) */}
          <div style={{
            ...getCardStyle('forums'),
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{
              background: DESIGN_SYSTEM.pageThemes.forums.accent,
              color: DESIGN_SYSTEM.colors.text.inverse,
              padding: DESIGN_SYSTEM.spacing.base,
              borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`,
              flexShrink: 0
            }}>
              <h3 style={{
                margin: 0,
                fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold
              }}>
                Meeting Transcripts
              </h3>
            </div>
            <div style={{ padding: DESIGN_SYSTEM.spacing.base, minHeight: 280, maxHeight: 520, overflowY: 'auto' }}>
              {meetingTranscriptsList.length === 0 ? (
                <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>No transcripts yet. Use Generate Transcript above.</div>
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
                      }} style={{ ...getButtonStyle('secondary', 'forums'), padding: '4px 8px', borderRadius: 9999, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, background: '#fff', color: '#111827', border: '1px solid #e5e7eb' }}>⬇️ Download</button>
                      <button onClick={() => { setAiModalTranscriptDoc(file); setAiModalOpen(true); setAiModalItems([]); setAiModalSelection({}); setAiModalTarget('tasks'); setAiModalError(''); }} style={{ ...getButtonStyle('secondary', 'forums'), padding: '4px 8px', borderRadius: 9999, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, background: '#111827', color: '#fff', border: '1px solid #111827' }}>🤖 AI Actions</button>
                      <button onClick={async () => { try { await deleteDoc(doc(db, 'forums', forumId, 'meetingTranscripts', file.id)); setMeetingTranscriptsList(prev => prev.filter(f => f.id !== file.id)); } catch { alert('Failed to delete'); } }} style={{ ...getButtonStyle('secondary', 'forums'), padding: '4px 8px', borderRadius: 9999, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' }}>🗑️ Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Leave Forum Button at bottom of left panel */}
          <div style={{
            marginTop: 'auto',
            padding: DESIGN_SYSTEM.spacing.base
          }}>
            <button
              onClick={() => {
                if (!currentUser || !forumData?.id) return;
                setConfirmModalConfig({
                  title: 'Leave Forum',
                  message: 'Leave this forum? You will no longer see it in your list.',
                  confirmText: 'Leave',
                  confirmButtonType: 'danger',
                  onConfirm: async () => {
                    setShowConfirmModal(false);
                    try {
                      await updateDoc(doc(db, 'forums', forumData.id), {
                        members: (forumData.members || []).filter(uid => uid !== currentUser.uid)
                      });
                      navigate('/forum');
                    } catch (e) {
                      alert('Failed to leave forum.');
                    }
                  }
                });
                setShowConfirmModal(true);
              }}
              style={{
                ...getButtonStyle('secondary', 'forums'),
                background: '#fee2e2',
                color: '#b91c1c',
                border: '1px solid #fecaca',
                width: '100%',
                padding: `${DESIGN_SYSTEM.spacing.base} ${DESIGN_SYSTEM.spacing.lg}`,
                fontSize: DESIGN_SYSTEM.typography.fontSize.base,
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold
              }}
            >
              Leave Forum
            </button>
          </div>
        </div>

        {/* Middle Column - Main Forum Content */}
        <div style={{ 
          display: "flex", 
          flexDirection: "column",
          minHeight: "calc(100vh - 320px)"
        }}>
          <ForumTabs 
            forumData={forumData} 
            posts={posts} 
            setPosts={setPosts} 
            forumId={forumId} // Pass forumId to ForumTabs
            updateForumLastActivity={updateForumLastActivity} // Pass function to update last activity
            updateForumPostCount={updateForumPostCount} // Pass the new function
            currentUser={currentUser} // Pass currentUser from useAuth to ForumTabs
            enrichedForumMembersDetails={enrichedForumMembersDetails} // Pass enriched member details to ForumTabs
          />
        </div>

        {/* Right column: Online Members + Trending Posts */}
        <div style={{ 
          position: "sticky",
          top: DESIGN_SYSTEM.spacing.xl,
          display: "flex", 
          flexDirection: "column", 
          gap: DESIGN_SYSTEM.spacing.base,
          height: "calc(150vh - 320px)", // 50% longer
          overflowY: "hidden"
        }}>
          {/* Active Users Section - 50% height */}
          <div style={{
            ...getCardStyle('forums'),
            height: "calc(50% - 8px)", // 50% minus half the gap
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{
              background: DESIGN_SYSTEM.pageThemes.forums.accent,
              color: DESIGN_SYSTEM.colors.text.inverse,
              padding: DESIGN_SYSTEM.spacing.base,
              borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`,
              flexShrink: 0
            }}>
              <h3 style={{
                margin: 0,
                fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold
              }}>
                Active Members
              </h3>
            </div>
            <div style={{ 
              flex: 1,
              overflow: "auto",
              padding: 0
            }}>
              <ActiveUsers members={enrichedForumMembersDetails} />
            </div>
          </div>
          
          {/* Starred Posts Section - 50% height */}
          <div style={{
            ...getCardStyle('forums'),
            height: "calc(50% - 8px)", // 50% minus half the gap
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{
              background: DESIGN_SYSTEM.pageThemes.forums.accent,
              color: DESIGN_SYSTEM.colors.text.inverse,
              padding: DESIGN_SYSTEM.spacing.base,
              borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`,
              flexShrink: 0
            }}>
              <h3 style={{
                margin: 0,
                fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold
              }}>
                Starred Posts
              </h3>
            </div>
            <div style={{ 
              flex: 1,
              overflow: "auto",
              padding: 0
            }}>
              <StarredPosts onPostClick={handleTrendingPostClick} forumId={forumId} currentUser={currentUser} />
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Floating Create Button */}
      <FloatingCreateButton onClick={() => setShowCreateModal(true)} />

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        forumId={forumId}
        updateForumLastActivity={updateForumLastActivity}
        updateForumPostCount={updateForumPostCount}
        currentUser={currentUser}
      />

      {/* Invite Member Modal */}
      <InviteMemberModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        members={enrichedForumMembersDetails} // Pass enriched member details to InviteMemberModal
        onAddMember={handleAddMember}
        onRemoveMember={handleRemoveMember} // This will be ignored by InviteMemberModal, but kept for consistency if needed later
        forumId={forumId}
        forumName={forumData?.name}
        currentUser={currentUser}
      />

      {/* AI Actions Modal */}
      {aiModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, width: 640, maxWidth: '95vw', boxShadow: '0 10px 25px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>AI Actions</div>
              <button onClick={() => setAiModalOpen(false)} style={{ ...getButtonStyle('secondary', 'forums') }}>Close</button>
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
              }} style={{ ...getButtonStyle('secondary', 'forums') }}>Analyze</button>
              <select value={aiModalTarget} onChange={(e) => setAiModalTarget(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 8px' }}>
                <option value="reminders">Add to Reminders</option>
              </select>
              <button disabled={aiModalLoading || aiModalItems.length === 0} onClick={async () => {
                try {
                  setAiModalLoading(true); setAiModalError('');
                  const selected = aiModalItems.filter(it => aiModalSelection[it.id]);
                  if (selected.length === 0) { setAiModalLoading(false); return; }
                  // Add to forum reminders
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
                    const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}:\d{2}))?/);
                    if (m) return { date: m[1], time: m[2] || '' };
                    return { date: '', time: '' };
                  };
                  const newRems = selected.map((it, idx) => {
                    const { date, time } = parseDeadline(it.deadline);
                    const finalDate = date || new Date().toISOString().slice(0,10);
                    return {
                      title: (it.displayTitle || it.title || it.name || `Reminder ${idx + 1}`).toString(),
                      note: it.description || '',
                      date: finalDate,
                      time,
                      type: 'meeting',
                      priority: 'medium'
                    };
                  });
                  for (const rem of newRems) {
                    const rref = await addDoc(collection(db, `forums/${forumId}/reminders`), { ...rem, timestamp: serverTimestamp() });
                    // Notification for forum reminder
                    try {
                      await addDoc(collection(db, 'users', currentUser.uid, 'notifications'), {
                        unread: true,
                        createdAt: serverTimestamp(),
                        origin: 'forum',
                        title: 'New Forum Reminder',
                        message: `${forumData?.name || 'Forum'}: ${rem.title} on ${rem.date}${rem.time ? ' ' + rem.time : ''}`,
                        refType: 'forumReminder',
                        forumId: forumId,
                        refId: rref.id
                      });
                    } catch {}
                  }
                  setAiModalOpen(false);
                } catch (e) {
                  setAiModalError(e.message || 'Failed to add reminders.');
                } finally {
                  setAiModalLoading(false);
                }
              }} style={{ ...getButtonStyle('primary', 'forums') }}>Add Selected</button>
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
