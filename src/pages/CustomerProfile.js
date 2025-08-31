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
import { getAcceptedTeamMembers, getAcceptedTeamMembersForProject } from '../services/teamService';
import { doc, getDoc, updateDoc, collection, serverTimestamp, addDoc, query, where, getDocs, deleteDoc, onSnapshot, arrayUnion, arrayRemove } from "firebase/firestore";
import { useAuth } from '../contexts/AuthContext';
import { DESIGN_SYSTEM, getPageContainerStyle, getCardStyle, getPageHeaderStyle, getContentContainerStyle, getButtonStyle } from '../styles/designSystem';
import ConfirmationModal from '../components/common/ConfirmationModal';
import { recomputeAndSaveForCustomer, logLeadEvent } from '../services/leadScoreService';
import { listSopTemplates, applyCustomerSopTemplate, listUserSopTemplates, saveUserSopTemplate, updateUserSopTemplate, deleteUserSopTemplate } from '../utils/sopTemplates';

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
  const [showSopPicker, setShowSopPicker] = useState(false);
  const [sopChoice, setSopChoice] = useState('customer_general_v1');
  // Open SOP picker automatically after creation redirect
  useEffect(() => {
    try {
      const key = 'proflow_open_customer_sop_for';
      const target = localStorage.getItem(key);
      if (target && target === id) {
        setShowSopPicker(true);
        localStorage.removeItem(key);
      }
    } catch {}
  }, [id]);
  const [projectSnapshots, setProjectSnapshots] = useState({}); // Per-project saved data snapshots
  const [activeStageTab, setActiveStageTab] = useState('current');
  const [projectNames, setProjectNames] = useState({}); // Map of projectId -> name
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectMeetingTranscripts, setProjectMeetingTranscripts] = useState([]);
  const [lastContact, setLastContact] = useState("N/A"); // Default last contact
  const [customerTeamMembersDetails, setCustomerTeamMembersDetails] = useState([]); // State for enriched team member details
  const [approverMembers, setApproverMembers] = useState([]); // Team members for approver selection
  const [showConvertPanel, setShowConvertPanel] = useState(false);
  const [autoCreatedFromApproval, setAutoCreatedFromApproval] = useState(false);
  const [convertForm, setConvertForm] = useState({ name: '', description: '', startDate: '', endDate: '', budget: '', priority: 'Normal', recipientUids: [] });

  // Confirmation modal state (mirrors ProjectDetail)
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  // (moved below)
  const [confirmModalConfig, setConfirmModalConfig] = useState({
    title: '',
    message: '',
    onConfirm: () => setShowConfirmModal(false),
    confirmText: 'OK',
    confirmButtonType: 'primary'
  });

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
  const lastSavedFinalRef = useRef("");

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

  // Access management
  const [accessList, setAccessList] = useState([]); // [{ uid, name, email }]
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [sharing, setSharing] = useState(false);

  

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

  // Listen to add tasks/notes events from Email modal
  useEffect(() => {
    const onAddTasks = (e) => {
      try {
        const items = e?.detail?.items || [];
        if (!Array.isArray(items) || items.length === 0) return;
        const current = currentStage || STAGES[0];
        const prevStage = JSON.parse(JSON.stringify(stageData || {}));
        const prevTasks = (prevStage[current]?.tasks || []);
        const merged = [...prevTasks, ...items.map(t => ({ name: String(t), done: false }))];
        const next = { ...prevStage, [current]: { ...(prevStage[current] || {}), tasks: merged } };
        setStageData(next);
        if (id) { try { updateDoc(doc(db, 'customerProfiles', id), { stageData: next }); } catch {} }
      } catch {}
    };
    const onAddNotes = (e) => {
      try {
        const items = e?.detail?.items || [];
        if (!Array.isArray(items) || items.length === 0) return;
        const current = currentStage || STAGES[0];
        const prevStage = JSON.parse(JSON.stringify(stageData || {}));
        const prevNotes = (prevStage[current]?.notes || []);
        const merged = [...prevNotes, ...items.map(t => String(t))];
        const next = { ...prevStage, [current]: { ...(prevStage[current] || {}), notes: merged } };
        setStageData(next);
        if (id) { try { updateDoc(doc(db, 'customerProfiles', id), { stageData: next }); } catch {} }
      } catch {}
    };
    window.addEventListener('proflow-add-customer-tasks', onAddTasks);
    window.addEventListener('proflow-add-customer-notes', onAddNotes);
    return () => {
      window.removeEventListener('proflow-add-customer-tasks', onAddTasks);
      window.removeEventListener('proflow-add-customer-notes', onAddNotes);
    };
  }, [currentStage, stageData, id]);

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

  const SopPicker = ({ onClose }) => {
    const templates = listSopTemplates('customer');
    const selected = templates.find(t => t.id === sopChoice) || templates[0];
    const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(selected || {})));
    useEffect(() => { setDraft(JSON.parse(JSON.stringify(selected || {}))); }, [selected?.id]);
    const [tab, setTab] = useState('templates'); // 'templates' | 'ai' | 'my'
    const [aiDesc, setAiDesc] = useState('');
    const [aiIndustry, setAiIndustry] = useState('');
    const [aiCustomerType, setAiCustomerType] = useState('');
    const [aiRoles, setAiRoles] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState('');
    const [aiRaw, setAiRaw] = useState('');
    // My templates state
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
          // Replace single-quoted strings cautiously (common simple cases)
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
      // As last resort, attempt to find a top-level JSON-like block
      const match = t0.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = tryParse(match[0]) || tryParse(repairJson(match[0]));
        if (parsed) return parsed;
      }
      return null;
    };
    const normalizeCustomerTemplate = (obj) => {
      try {
        const t = typeof obj === 'object' && obj ? obj : {};
        const outlineStages = Array.isArray(t?.outline?.stages) ? t.outline.stages : [];
        const safeStages = outlineStages.map((s) => {
          const name = String(s?.name || s?.stage || 'Stage');
          const tasks = Array.isArray(s?.tasks) ? s.tasks : [];
          const safeTasks = tasks.map((tk) => ({ title: String(tk?.title || tk?.name || 'Task') }));
          return { name, tasks: safeTasks };
        });
        const defRems = Array.isArray(t.defaultReminders) ? t.defaultReminders : [];
        const defFiles = Array.isArray(t.defaultFiles) ? t.defaultFiles : [];
        return {
          id: String(t.id || `ai_customer_${Date.now()}`),
          type: 'customer',
          name: String(t.name || 'AI Customer SOP'),
          version: Number(t.version || 1),
          outline: { stages: safeStages },
          defaultReminders: defRems.map((r) => (typeof r === 'string' ? r : String(r?.title || 'Reminder'))),
          defaultFiles: defFiles.map((f) => (typeof f === 'string' ? f : String(f?.name || 'File')))
        };
      } catch { return { id: `ai_customer_${Date.now()}`, type: 'customer', name: 'AI Customer SOP', version: 1, outline: { stages: [] }, defaultReminders: [], defaultFiles: [] }; }
    };
    const buildLocalCustomerTemplate = () => {
      const name = `AI Customer SOP (${aiIndustry || 'General'})`;
      const toTasks = (arr) => arr.map(t => ({ title: t }));
      const stages = [
        { name: 'Inquiry Intake', tasks: toTasks([
          'Record inquiry details',
          `Identify decision-maker (${aiRoles || 'Sales'})`,
          'Capture project scope, budget, timeline'
        ]) },
        { name: 'Qualification', tasks: toTasks([
          'Validate requirements and fit',
          'Check credit terms and compliance',
          'Determine go/no-go'
        ]) },
        { name: 'Quotation Preparation', tasks: toTasks([
          'Estimate material quantities and costs',
          'Prepare quotation with terms',
          'Internal review (Pricing/Legal)'
        ]) },
        { name: 'Follow-up', tasks: toTasks([
          'Send quotation and confirm receipt',
          'Follow up within 3 business days',
          'Clarify questions and update quote if needed'
        ]) },
        { name: 'Conversion', tasks: toTasks([
          'Negotiate final terms',
          'Obtain signed acceptance / PO',
          'Create project record and handover'
        ]) }
      ];
      return {
        id: `ai_customer_${Date.now()}`,
        type: 'customer',
        name,
        version: 1,
        outline: { stages },
        defaultReminders: ['Follow-up in 3 days', 'Quote validity check in 7 days'],
        defaultFiles: ['Company Profile.pdf', 'Quotation Template.docx']
      };
    };
    // Load user templates when switching to 'my'
    useEffect(() => {
      const loadMy = async () => {
        if (!currentUser) return;
        setUserTemplatesLoading(true); setUserTemplatesError('');
        try {
          const list = await listUserSopTemplates({ userId: currentUser.uid, kind: 'customer' });
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
        id: `user_customer_${Date.now()}`,
        type: 'customer',
        name: templateName || 'My Customer Template',
        version: 1,
        outline: { stages: [ { name: 'Stage 1', tasks: [] } ] },
        defaultReminders: [],
        defaultFiles: []
      };
      setDraft(JSON.parse(JSON.stringify(blank)));
    };

    const handleUseCurrentProfileAsTemplate = () => {
      const stagesList = Array.isArray(stages) ? stages : [];
      const mappedStages = stagesList.map((stageName) => {
        const sd = stageData?.[stageName] || {};
        const tasks = Array.isArray(sd.tasks) ? sd.tasks : [];
        return { name: stageName, tasks: tasks.map(t => ({ title: String(t.name || t.title || '') })) };
      });
      const tpl = {
        id: `user_customer_${Date.now()}`,
        type: 'customer',
        name: templateName || 'My Customer Template',
        version: 1,
        outline: { stages: mappedStages },
        defaultReminders: Array.isArray(reminders) ? reminders.map(r => (typeof r === 'string' ? r : String(r?.title || 'Reminder'))) : [],
        defaultFiles: Array.isArray(files) ? files.map(f => (typeof f === 'string' ? f : String(f))) : []
      };
      setDraft(JSON.parse(JSON.stringify(tpl)));
    };

    const handleSaveDraftAsMyTemplate = async () => {
      if (!currentUser) return;
      const prepared = {
        ...draft,
        name: templateName || draft?.name || 'My Customer Template',
        type: 'customer',
        version: Number(draft?.version || 1)
      };
      const saved = await saveUserSopTemplate({ userId: currentUser.uid, template: prepared });
      if (saved) {
        try {
          const list = await listUserSopTemplates({ userId: currentUser.uid, kind: 'customer' });
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
          const list = await listUserSopTemplates({ userId: currentUser.uid, kind: 'customer' });
          setUserTemplates(list);
          if (selectedUserTemplateId === docId) setSelectedUserTemplateId('');
        } catch {}
      }
    };

    // Preview add/remove helpers (customer):
    const addStage = () => setDraft(d => {
      const next = JSON.parse(JSON.stringify(d||{}));
      const count = (next.outline?.stages || []).length;
      if (!next.outline) next.outline = { stages: [] };
      next.outline.stages.push({ name: `Stage ${count + 1}`, tasks: [] });
      return next;
    });
    const addTask = (sIdx) => setDraft(d => {
      const next = JSON.parse(JSON.stringify(d||{}));
      const tasks = next.outline?.stages?.[sIdx]?.tasks;
      if (Array.isArray(tasks)) tasks.push({ title: 'New Task' });
      return next;
    });
    const addReminder = () => setDraft(d => { const n = JSON.parse(JSON.stringify(d||{})); (n.defaultReminders||(n.defaultReminders=[])).push('New reminder'); return n; });
    const addFile = () => setDraft(d => { const n = JSON.parse(JSON.stringify(d||{})); (n.defaultFiles||(n.defaultFiles=[])).push('New file'); return n; });
    const generateAiCustomerTemplate = async () => {
      try {
        setAiLoading(true); setAiError('');
        const key = localStorage.getItem('gemini_api_key');
        if (!key) throw new Error('Missing GEMINI API key. Set it in Personal Assistant.');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${encodeURIComponent(key)}`;
        const sys = `You generate a customer SOP template as pure JSON only. Schema: { id:string, type:"customer", name:string, version:number, outline:{ stages:[ { name:string, tasks:[ { title:string, description?:string } ] } ] }, defaultReminders:(string|{title})[], defaultFiles:(string|{name})[] }. Constraints: 3-6 stages, 2-6 tasks/stage, concise titles. Do not include any text outside the JSON.`;
        const user = `Industry: ${aiIndustry||''}\nCustomer type: ${aiCustomerType||''}\nRoles involved: ${aiRoles||''}\nDescription: ${aiDesc||''}`;
        const body = {
          contents: [ { role: 'user', parts: [ { text: `${sys}\n\nContext:\n${user}` } ] } ],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1600, responseMimeType: 'application/json' },
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
        // Local fallback if model returns empty or unparsable
        const normalized = parsed ? normalizeCustomerTemplate(parsed) : buildLocalCustomerTemplate();
        setDraft(JSON.parse(JSON.stringify(normalized)));
        setTab('templates');
      } catch (e) {
        try {
          // Fallback to local template even on error
          const normalized = buildLocalCustomerTemplate();
          setDraft(JSON.parse(JSON.stringify(normalized)));
          setTab('templates');
          setAiError('');
        } catch {
          setAiError(e?.message || 'Failed to generate');
        }
      } finally {
        setAiLoading(false);
      }
    };
    const removeStage = (idx) => setDraft(d => { const next = JSON.parse(JSON.stringify(d||{})); (next.outline.stages||[]).splice(idx,1); return next; });
    const removeTask = (sIdx, tIdx) => setDraft(d => { const next = JSON.parse(JSON.stringify(d||{})); (next.outline.stages?.[sIdx]?.tasks||[]).splice(tIdx,1); return next; });
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 1040, maxWidth: '96%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: DESIGN_SYSTEM.spacing.base, background: DESIGN_SYSTEM.pageThemes.customers.gradient, color: DESIGN_SYSTEM.colors.text.inverse, borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`, marginBottom: DESIGN_SYSTEM.spacing.base }}>
            <div style={{ fontWeight: 700, fontSize: DESIGN_SYSTEM.typography.fontSize.lg }}>Choose SOP Template (Customer)</div>
            <button onClick={onClose} style={{ ...getButtonStyle('secondary', 'customers'), padding: '6px 10px' }}>Close</button>
          </div>
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
                      <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8, cursor: 'pointer', border: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`, marginBottom: 8, background: sopChoice === t.id ? '#fff' : '#fafafa' }}>
                        <input type="radio" name="sop" checked={sopChoice === t.id} onChange={() => { setSopChoice(t.id); setDraft(JSON.parse(JSON.stringify(t))); }} />
                        <span style={{ fontWeight: 600 }}>{t.name}</span>
                      </label>
                    ))}
                  </div>
                ) : tab === 'ai' ? (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: DESIGN_SYSTEM.spacing.base }}>
                      <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280' }}>
                        <span style={{ marginBottom: 4 }}>Industry</span>
                        <input value={aiIndustry} onChange={(e)=>setAiIndustry(e.target.value)} placeholder="e.g., Manufacturing" />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280' }}>
                        <span style={{ marginBottom: 4 }}>Customer type</span>
                        <input value={aiCustomerType} onChange={(e)=>setAiCustomerType(e.target.value)} placeholder="e.g., Distributor" />
                      </label>
                      <label style={{ gridColumn: '1 / span 2', display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280' }}>
                        <span style={{ marginBottom: 4 }}>Roles involved</span>
                        <input value={aiRoles} onChange={(e)=>setAiRoles(e.target.value)} placeholder="e.g., Sales; Pre-sales; Legal" />
                      </label>
                      <label style={{ gridColumn: '1 / span 2', display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280' }}>
                        <span style={{ marginBottom: 4 }}>Description</span>
                        <textarea value={aiDesc} onChange={(e)=>setAiDesc(e.target.value)} placeholder="Describe the onboarding/qualification process" style={{ minHeight: 70 }} />
                      </label>
                    </div>
                    <div style={{ display: 'flex', gap: DESIGN_SYSTEM.spacing.base, marginTop: DESIGN_SYSTEM.spacing.base }}>
                      <button onClick={generateAiCustomerTemplate} disabled={aiLoading} style={{ ...getButtonStyle('primary', 'customers'), opacity: aiLoading ? 0.7 : 1 }}>{aiLoading ? 'Generating…' : 'Generate AI Template'}</button>
                      {aiError && <span style={{ color: '#b91c1c', fontSize: 12 }}>{aiError}</span>}
                      {!!aiRaw && <button onClick={() => { try { alert(aiRaw.slice(0, 5000)); } catch {} }} style={{ ...getButtonStyle('secondary', 'customers') }}>View AI Output</button>}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: DESIGN_SYSTEM.spacing.base, marginBottom: DESIGN_SYSTEM.spacing.base }}>
                      <label style={{ gridColumn: '1 / span 2', display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280' }}>
                        <span style={{ marginBottom: 4 }}>Template name</span>
                        <input value={templateName} onChange={(e)=>setTemplateName(e.target.value)} placeholder="My Customer Template" />
                      </label>
                      <button onClick={handleNewTemplate} style={{ ...getButtonStyle('secondary', 'customers') }}>New Template</button>
                      <button onClick={handleUseCurrentProfileAsTemplate} style={{ ...getButtonStyle('secondary', 'customers') }}>Use Current Profile</button>
                      <button onClick={handleSaveDraftAsMyTemplate} style={{ ...getButtonStyle('primary', 'customers') }}>Save as My Template</button>
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
                              <input type="radio" name="my_tpl" checked={selectedUserTemplateId === ut._docId} onChange={() => handleSelectUserTemplate(ut._docId)} />
                              <span style={{ fontWeight: 600 }}>{ut.name}</span>
                            </label>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button onClick={() => handleSelectUserTemplate(ut._docId)} style={{ ...getButtonStyle('secondary', 'customers'), padding: '4px 8px' }}>Load</button>
                              <button onClick={() => handleDeleteUserTemplate(ut._docId)} style={{ ...getButtonStyle('secondary', 'customers'), padding: '4px 8px' }}>Delete</button>
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
                  <button onClick={addStage} style={{ ...getButtonStyle('secondary', 'customers'), padding: '4px 8px' }}>+ Add Stage</button>
                </div>
                {(draft?.outline?.stages || []).length === 0 ? (
                  <div style={{ color: '#6b7280', fontStyle: 'italic' }}>No stages.</div>
                ) : (
                  (draft.outline.stages || []).map((s, idx) => (
                    <div key={idx} style={{ border: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`, borderRadius: 8, padding: 8, background: '#fafafa' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <input value={s.name} onChange={(e)=>setDraft(d=>{ const n=JSON.parse(JSON.stringify(d||{})); n.outline.stages[idx].name = e.target.value; return n; })} style={{ fontWeight: 700, flex: 1 }} />
                        <button onClick={() => removeStage(idx)} style={{ ...getButtonStyle('secondary', 'customers'), padding: '4px 8px' }}>Remove Stage</button>
                      </div>
                      {Array.isArray(s.tasks) && s.tasks.length > 0 && (
                        <ul style={{ margin: '6px 0 0 16px' }}>
                          {s.tasks.map((t, i) => (
                            <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <input value={t.title || t.name} onChange={(e)=>setDraft(d=>{ const n=JSON.parse(JSON.stringify(d||{})); n.outline.stages[idx].tasks[i].title = e.target.value; return n; })} />
                              <button onClick={() => removeTask(idx, i)} style={{ ...getButtonStyle('secondary', 'customers'), padding: '2px 6px', fontSize: 11 }}>Remove</button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div style={{ marginTop: 6 }}>
                        <button onClick={() => addTask(idx)} style={{ ...getButtonStyle('secondary', 'customers'), padding: '2px 6px', fontSize: 12 }}>+ Add Task</button>
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
                        const label = (typeof r === 'string') ? r : String(r?.title || 'Reminder');
                        return (
                          <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{label}</span>
                            <button onClick={() => setDraft(d => { const n = JSON.parse(JSON.stringify(d||{})); (n.defaultReminders||[]).splice(i,1); return n; })} style={{ ...getButtonStyle('secondary', 'customers'), padding: '2px 6px', fontSize: 11 }}>Remove</button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <div style={{ marginTop: 6 }}>
                    <button onClick={addReminder} style={{ ...getButtonStyle('secondary', 'customers'), padding: '2px 6px', fontSize: 12 }}>+ Add Reminder</button>
                  </div>
                  <div style={{ fontWeight: 700, margin: '10px 0 6px' }}>Default Files</div>
                  {(draft.defaultFiles || []).length === 0 ? (
                    <div style={{ color: '#6b7280', fontStyle: 'italic' }}>None</div>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {(draft.defaultFiles || []).map((f, i) => (
                        <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{f}</span>
                          <button onClick={() => setDraft(d => { const n = JSON.parse(JSON.stringify(d||{})); (n.defaultFiles||[]).splice(i,1); return n; })} style={{ ...getButtonStyle('secondary', 'customers'), padding: '2px 6px', fontSize: 11 }}>Remove</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div style={{ marginTop: 6 }}>
                    <button onClick={addFile} style={{ ...getButtonStyle('secondary', 'customers'), padding: '2px 6px', fontSize: 12 }}>+ Add File</button>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: DESIGN_SYSTEM.spacing.base, display: 'flex', justifyContent: 'flex-end', gap: DESIGN_SYSTEM.spacing.base }}>
                <button onClick={onClose} style={{ ...getButtonStyle('secondary', 'customers') }}>Cancel</button>
                <button onClick={async () => { try { if (id) { await applyCustomerSopTemplate(id, draft); /* refresh local state */ setStages((draft.outline?.stages||[]).map(s=>s.name) || stages); const nextStageData = {}; (draft.outline?.stages||[]).forEach(s => { nextStageData[s.name] = { notes: [], tasks: (s.tasks||[]).map(t => ({ name: String(t.title||t.name||''), done: false })), completed: false }; }); setStageData(nextStageData); setCurrentStage(((draft.outline?.stages||[])[0]?.name) || stages[0]); setReminders(Array.isArray(draft.defaultReminders)?draft.defaultReminders:[]); setFiles(Array.isArray(draft.defaultFiles)?draft.defaultFiles:[]); } onClose(); } catch {} }} style={{ ...getButtonStyle('primary', 'customers') }}>Apply</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleConvertToProject = () => {
    // Open combined convert panel
    setShowConvertPanel(true);
  };

  const handleProjectConversionApprovalSuccess = (result) => {
    setShowProjectConversionApprovalModal(false);
    setHasPendingConversionRequest(true);
    // Show success modal instead of alert
    try {
      setConfirmModalConfig({
        title: 'Approval Sent',
        message: "Conversion approval request sent successfully! You'll be able to create the project once it's approved.",
        confirmText: 'OK',
        confirmButtonType: 'primary',
        onConfirm: () => setShowConfirmModal(false)
      });
      setShowConfirmModal(true);
    } catch (e) {
      console.log('Approval sent');
    }
    // Do NOT reset here; wait until approval is accepted and project is created
  };

  // Disabled auto-create on approval to prevent auto-linking customer to project

  const handleCreateProjectAfterApproval = () => {
    setShowConvertPanel(true);
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
    try {
      setConfirmModalConfig({
        title: 'Approval Sent',
        message: `Approval request sent successfully to ${result.recipientCount} team member(s)!\n\nTitle: ${result.title}\nType: ${result.type}\nEntity: ${result.entityName}`,
        confirmText: 'OK',
        confirmButtonType: 'primary',
        onConfirm: () => setShowConfirmModal(false)
      });
      setShowConfirmModal(true);
    } catch (e) {
      console.log('Approval sent');
    }
    // Lead score: approval requested
    try {
      if (id) {
        logLeadEvent(id, 'approvalRequested', { stage: currentStage });
        recomputeAndSaveForCustomer({ userId: currentUser?.uid, customerId: id, companyProfile });
      }
    } catch {}
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
          setLeadScoreData(data.leadScores?.noProject || null);
          // Load access list details
          try {
            const access = Array.isArray(data.access) ? data.access : (data.userId ? [data.userId] : []);
            const details = [];
            const chunkSize = 10;
            for (let i = 0; i < access.length; i += chunkSize) {
              const chunk = access.slice(i, i + chunkSize);
              const usersQuery = query(collection(db, "users"), where("uid", "in", chunk));
              const usersSnapshot = await getDocs(usersQuery);
              usersSnapshot.forEach(userDoc => {
                const u = userDoc.data();
                details.push({ uid: userDoc.id, name: u.name || u.email || 'User', email: u.email || '' });
              });
            }
            setAccessList(details);
          } catch {}
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

  // Note: Do not auto-recompute on load; recompute occurs on relevant events only.

  // Lead scoring states
  const [leadScoreData, setLeadScoreData] = useState(null); // No Project score
  const [projectLeadScore, setProjectLeadScore] = useState(null); // Frozen project score
  const [showLeadBreakdown, setShowLeadBreakdown] = useState(false);

  // Keep session id in ref
  useEffect(() => { meetingSessionIdRef.current = meetingSessionId; }, [meetingSessionId]);

  // Watch live meeting participants on the customer profile
  useEffect(() => {
    if (!id) return;
    const customerRef = doc(db, 'customerProfiles', id);
    const unsub = onSnapshot(customerRef, snap => {
      const data = snap.data();
      setMeetingParticipants(data?.meetingParticipants || []);
      try { setLeadScoreData(data?.leadScores?.noProject || null); } catch {}
      if ((data?.meetingParticipants || []).length > 0 && !showMeeting && !suppressMeetingBar) {
        setMeetingMinimized(true);
      }
    });
    return () => unsub();
  }, [id, showMeeting, suppressMeetingBar]);

  // Watch frozen score when a project is selected
  useEffect(() => {
    if (!selectedProjectId) { setProjectLeadScore(null); return; }
    const unsub = onSnapshot(doc(db, 'projects', selectedProjectId), snap => {
      const data = snap.data() || {};
      setProjectLeadScore(data.leadScore || null);
    });
    return () => unsub();
  }, [selectedProjectId]);

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
          // Do not persist interim chunks to avoid duplicates
        }
        if (finalText) {
          setLiveTranscript("");
          const clean = finalText.trim();
          transcriptBufferRef.current = `${transcriptBufferRef.current} ${clean}`.trim();
          const sessionId = meetingSessionIdRef.current;
          const prev = (lastSavedFinalRef.current || '').trim();
          const isDup = !!prev && (clean === prev || prev.endsWith(clean) || clean.endsWith(prev));
          if (sessionId && clean && !isDup) {
            await addDoc(collection(db, 'meetingSessions', sessionId, 'transcripts'), {
              text: clean,
              userId: currentUser?.uid || 'anon',
              createdAt: serverTimestamp(),
            });
            lastSavedFinalRef.current = clean;
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
      // Include remaining live text in buffer but do not persist as a separate line
      if (liveTranscript && liveTranscript.trim().length > 0) {
        transcriptBufferRef.current = `${transcriptBufferRef.current} ${liveTranscript.trim()}`.trim();
        setLiveTranscript("");
      }
      const buffered = transcriptBufferRef.current;
      const combined = [sessionTranscripts.map(l => l.text).join('\n'), buffered].filter(Boolean).join('\n').trim();
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

  // Load approver team members based on selected project (or all accepted team if none)
  useEffect(() => {
    let isCancelled = false;
    const load = async () => {
      try {
        const members = selectedProjectId
          ? await getAcceptedTeamMembersForProject(currentUser, selectedProjectId)
          : await getAcceptedTeamMembers(currentUser);
        if (!isCancelled) setApproverMembers(members || []);
      } catch {
        if (!isCancelled) setApproverMembers([]);
      }
    };
    load();
    return () => { isCancelled = true; };
  }, [selectedProjectId, currentUser]);

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
      
    } catch (error) {
      console.error("Error saving customer: ", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProjectFromConversion = async (projectData) => {
    setLoading(true);
    // Pre-fill fields from customerProfile and companyProfile
    const preFilledProjectData = {
      ...projectData,
      company: companyProfile.company || projectData.company || '',
      industry: companyProfile.industry || projectData.industry || '',
      contactPerson: customerProfile.name || projectData.contactPerson || '',
      contactEmail: customerProfile.email || projectData.contactEmail || '',
      contactPhone: customerProfile.phone || projectData.contactPhone || '',
      customerName: (projectData.customerName || customerProfile.name || ''),
      companyInfo: {
        companyName: (companyProfile.company || projectData.company || ''),
        customerEmail: (projectData.contactEmail || customerProfile.email || ''),
        customerName: (projectData.customerName || customerProfile.name || '')
      },
      status: "Active", // Set as active since approval was already given
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      customerId: id, // Link to the current customer
      convertedFromCustomer: true,
      description: projectData.description || '',
      startDate: projectData.startDate || '',
      endDate: projectData.endDate || '',
      budget: projectData.budget || '',
      priority: projectData.priority || 'Normal',
      
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
    let newProjectRef = null;
    // Remove undefined fields that Firestore disallows
    try {
      Object.keys(preFilledProjectData).forEach((k) => {
        if (preFilledProjectData[k] === undefined) delete preFilledProjectData[k];
      });
    } catch {}
    try {
      newProjectRef = await addDoc(projectsCollectionRef, preFilledProjectData);
    } catch (error) {
      console.error("Error creating project from conversion:", error);
      alert("Failed to create project.");
      setLoading(false);
      return;
    }

    try {
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
    } catch (e) {
      console.warn('Project created but failed to link to customer profile:', e);
    }

    // Open Project SOP picker immediately so user can choose Project SOP before tasks initialize
    try {
      navigate(`/project/${newProjectRef.id}?openSop=1`);
    } catch {}

      // Move attached files to the project record for project history visibility
      try {
        await updateDoc(doc(db, 'projects', newProjectRef.id), {
          files: Array.isArray(files) ? files : []
        });
      } catch {}

      // Optional quotation migration: keep only selected draft if provided; else delete all drafts
      try {
        const draftsSnap = await getDocs(collection(db, 'customerProfiles', id, 'quotesDrafts'));
        const selectedDraftId = projectData?.selectedDraftQuoteId || null;
        const ops = [];
        let addedQuoteId = null;
        draftsSnap.forEach(d => {
          const q = d.data() || {};
          if (q.projectId) return; // already moved elsewhere
          if (selectedDraftId) {
            // Migrate only the selected draft; delete others
            if (d.id === selectedDraftId) {
              const items = Array.isArray(q.items) ? q.items : [];
              const subtotal = Number(q.subtotal || items.reduce((a,it)=> a + (Number(it.qty||0)*Number(it.unitPrice||0)), 0));
              const taxRate = Number(q.taxRate || 0);
              const discount = Number(q.discount || 0);
              const taxAmount = Number(q.taxAmount || (subtotal * (taxRate/100)));
              const total = Number(q.total || (subtotal + taxAmount - discount));
              ops.push(
                addDoc(collection(db, 'projects', newProjectRef.id, 'quotes'), {
                  client: q.client || '',
                  validUntil: q.validUntil || '',
                  items,
                  subtotal,
                  taxRate,
                  discount,
                  taxAmount,
                  total,
                  currency: q.currency || undefined,
                  fxBase: q.fxBase || undefined,
                  fxRate: q.fxRate || undefined,
                  status: q.status || 'draft',
                  createdAt: serverTimestamp(),
                  movedFromCustomerId: id,
                }).then(ref => { addedQuoteId = ref.id; }).catch(() => {})
              );
              ops.push(updateDoc(doc(db, 'customerProfiles', id, 'quotesDrafts', d.id), { projectId: newProjectRef.id }).catch(() => {}));
            } else {
              ops.push(deleteDoc(doc(db, 'customerProfiles', id, 'quotesDrafts', d.id)).catch(() => {}));
            }
          } else {
            // No selection: delete all unassigned drafts
            ops.push(deleteDoc(doc(db, 'customerProfiles', id, 'quotesDrafts', d.id)).catch(() => {}));
          }
        });
        if (ops.length > 0) await Promise.all(ops);
        // Safety: ensure at most one quote exists under project
        if (selectedDraftId) {
          try {
            const projQuotesSnap = await getDocs(collection(db, 'projects', newProjectRef.id, 'quotes'));
            const deletes = [];
            let keepFound = false;
            projQuotesSnap.forEach(qdoc => {
              if (!keepFound && (addedQuoteId ? qdoc.id === addedQuoteId : true)) {
                keepFound = true;
                return;
              }
              deletes.push(deleteDoc(doc(db, 'projects', newProjectRef.id, 'quotes', qdoc.id)).catch(() => {}));
            });
            if (deletes.length > 0) await Promise.all(deletes);
          } catch {}
        }
      } catch {}

      // Move customer transcripts to the new project's transcripts collection
      try {
        const transcriptsSnap = await getDocs(collection(db, 'customerProfiles', id, 'meetingTranscripts'));
        const movePromises = [];
        transcriptsSnap.forEach(tdoc => {
          const t = tdoc.data() || {};
          movePromises.push(
            addDoc(collection(db, 'projects', newProjectRef.id, 'meetingTranscripts'), {
              ...t,
              migratedFromCustomerId: id,
              migratedAt: serverTimestamp()
            })
              .then(() => deleteDoc(doc(db, 'customerProfiles', id, 'meetingTranscripts', tdoc.id)))
              .catch(() => {})
          );
        });
        if (movePromises.length > 0) {
          await Promise.all(movePromises);
        }
      } catch {}

    try {
      console.log("Project created from conversion with ID:", newProjectRef.id);
      // Reset non-core panels for a clean state per requirement
      setActivities([]);
      setReminders([]);
      setFiles([]);
      // Reset stage content but keep structure
      const resetStageData = Object.fromEntries((stages || []).map(s => [s, { notes: [], tasks: [], completed: false }]));
      setStageData(resetStageData);
      try { await updateDoc(doc(db, 'customerProfiles', id), { activities: [], reminders: [], files: [], stageData: resetStageData }); } catch {}
      // Freeze current lead score into project snapshot and reset "No Project" lead score
      try {
        const snap = await getDoc(doc(db, 'customerProfiles', id));
        const data = snap.exists() ? (snap.data() || {}) : {};
        const frozen = data.leadScores?.noProject || null;
        if (frozen) {
          await updateDoc(doc(db, 'projects', newProjectRef.id), { leadScore: frozen });
        }
        // Reset customer-level noProject score for new cycle
        await updateDoc(doc(db, 'customerProfiles', id), { leadScores: { noProject: null, noProjectResetAt: Date.now() } });
        setLeadScoreData(null);
      } catch {}
    } catch {}

    setShowCreateProjectModal(false);
    navigate(`/project/${newProjectRef.id}`);
    setLoading(false);
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
        <div style={{ 
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center", 
          justifyContent: "center", 
          padding: "100px 20px",
          gap: DESIGN_SYSTEM.spacing.lg
        }}>
          <div style={{ 
            width: "60px", 
            height: "60px", 
            border: `4px solid ${DESIGN_SYSTEM.colors.secondary[200]}`,
            borderTop: `4px solid ${DESIGN_SYSTEM.colors.primary[500]}`, 
            borderRadius: "50%",
            animation: "spin 1.5s linear infinite"
          }} />
          <div style={{ 
            color: DESIGN_SYSTEM.colors.text.primary,
            fontSize: DESIGN_SYSTEM.typography.fontSize.xl,
            fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium
          }}>
            Loading Customer Profile
          </div>
          <div style={{ 
            color: DESIGN_SYSTEM.colors.text.secondary,
            fontSize: DESIGN_SYSTEM.typography.fontSize.base
          }}>
            Please wait while we retrieve the customer information...
          </div>
          <style>
            {`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}
          </style>
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

        {/* Middle + Right: Toolbar and Project Workspace (near TopBar) */}
        <div style={{ display: "grid", gridTemplateColumns: "350px 1fr 350px", gap: DESIGN_SYSTEM.spacing.xl, width: "100%", maxWidth: "100%", overflowX: "hidden" }}>
          {/* Middle + Right block */}
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
                <div style={{ width: 8 }} />
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 9999, padding: '4px 8px' }}>
                  <span style={{ fontSize: 12, opacity: 0.9 }}>Lead Score:</span>
                  <button
                    onClick={() => { setShowLeadBreakdown(true); }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 9999,
                      border: '1px solid rgba(255,255,255,0.4)',
                      background: '#fff',
                      color: '#111827',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                    title={(selectedProjectId ? (projectLeadScore?.band || '') : (leadScoreData?.band || '')) || 'Score'}
                  >
                    {selectedProjectId ? (projectLeadScore ? `${projectLeadScore.score} (${projectLeadScore.band})` : '—') : (leadScoreData ? `${leadScoreData.score} (${leadScoreData.band})` : '—')}
                  </button>
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowSopPicker(true)} style={{ ...getButtonStyle('secondary', 'customers') }}>Template</button>
                  <button
                    onClick={() => {
                      if (Boolean(selectedProjectId) || (hasPendingConversionRequest && !hasApprovedConversion)) return;
                      setApprovalModalType('general'); setShowProjectConversionApprovalModal(true);
                    }}
                    style={{ 
                      ...getButtonStyle('primary', 'customers'),
                      pointerEvents: (Boolean(selectedProjectId) || (hasPendingConversionRequest && !hasApprovedConversion)) ? 'none' : 'auto',
                      opacity: (Boolean(selectedProjectId) || (hasPendingConversionRequest && !hasApprovedConversion)) ? 0.6 : 1,
                      cursor: (Boolean(selectedProjectId) || (hasPendingConversionRequest && !hasApprovedConversion)) ? 'not-allowed' : 'pointer'
                    }}
                    disabled={Boolean(selectedProjectId) || (hasPendingConversionRequest && !hasApprovedConversion)}
                    aria-disabled={Boolean(selectedProjectId) || (hasPendingConversionRequest && !hasApprovedConversion)}
                    tabIndex={(Boolean(selectedProjectId) || (hasPendingConversionRequest && !hasApprovedConversion)) ? -1 : 0}
                  >
                    {selectedProjectId
                      ? 'Converted'
                      : ((hasApprovedConversion && (projects || []).length === 0)
                          ? 'Approved - Create Project'
                          : (hasPendingConversionRequest ? 'Awaiting Approval' : 'Convert to Project'))}
                  </button>
                  <button onClick={() => { setApprovalModalType('general'); setShowAdvancedApprovalModal(true); }} style={{ ...getButtonStyle('secondary', 'customers') }}>Send Approval</button>
                </div>
                <div style={{ width: 8 }} />
                <button
                  onClick={handleToggleMeeting}
                  style={{ ...getButtonStyle('secondary', 'customers'), background: 'rgba(255,255,255,0.15)', borderColor: 'transparent' }}
                >
                  {(showMeeting || meetingMinimized) ? 'Close Meeting' : 'Conduct Meeting'}
                </button>
              </div>
            </div>
            {/* Project Workspace */}
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
                companyProfile={companyProfile}
                onConvertToProject={handleConvertToProject}
                stages={stages}
                currentStage={currentStage}
                setCurrentStage={setCurrentStage}
                stageData={stageData}
                setStageData={setStageData}
                setStages={setStages}
                onStagesUpdate={handleStagesUpdate}
                hasApprovedConversion={hasApprovedConversion}
                onCreateProjectAfterApproval={handleCreateProjectAfterApproval}
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
          <div style={{ display: "flex", flexDirection: "column", gap: DESIGN_SYSTEM.spacing.lg, gridColumn: 1, gridRow: 1 }}>
            {/* Customer Info */}
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
                <CustomerInfo data={customerProfile} setCustomerProfile={setCustomerProfile} onSave={(updated) => handleSaveCustomer({ customerProfile: updated })} />
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
                    setCompanyProfile(updated);
                  }} 
                  onSave={(updated) => handleSaveCustomer({ companyProfile: updated })}
                />
              </div>
            </div>

            {/* Access Panel */}
            <div style={getCardStyle('customers')}>
              <div style={{
                background: DESIGN_SYSTEM.pageThemes.customers.gradient,
                color: DESIGN_SYSTEM.colors.text.inverse,
                padding: DESIGN_SYSTEM.spacing.base,
                borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`
              }}>
                <h2 style={{ margin: 0, fontSize: DESIGN_SYSTEM.typography.fontSize.lg, fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold }}>
                  Access
                </h2>
              </div>
              <div style={{ padding: DESIGN_SYSTEM.spacing.base, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
                  <input value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} placeholder="Share with email" style={{ flex: 1, padding: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, borderRadius: 8 }} />
                  {(() => {
                    try {
                      const q = (shareEmail || '').toLowerCase().trim();
                      if (!q) return null;
                      const matches = (customerTeamMembersDetails || []).filter(m => (m.email || '').toLowerCase().includes(q)).slice(0,5);
                      if (matches.length === 0) return null;
                      return (
                        <div style={{ position: 'absolute', top: 40, left: 0, right: 120, background: '#fff', border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, borderRadius: 8, zIndex: 20, maxHeight: 220, overflowY: 'auto' }}>
                          {matches.map(m => (
                            <div key={m.uid} onMouseDown={(ev) => { ev.preventDefault(); setShareEmail(m.email || ''); }} style={{ padding: 8, cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name || m.email}</div>
                              <div style={{ fontSize: 12, color: '#6b7280' }}>{m.email}</div>
                            </div>
                          ))}
                        </div>
                      );
                    } catch { return null; }
                  })()}
                  <button
                    onClick={async () => {
                      if (!id || !currentUser || !shareEmail.trim()) return;
                      setSharing(true);
                      try {
                        // Lookup user by email
                        const usersQuery = query(collection(db, 'users'), where('email', '==', shareEmail.trim()))
                        const snap = await getDocs(usersQuery);
                        let toUserId = null;
                        if (!snap.empty) toUserId = snap.docs[0].id;
                        // Create share request
                        await addDoc(collection(db, 'customerShares'), {
                          customerId: id,
                          customerName: getCustomerName(),
                          fromUserId: currentUser.uid,
                          fromUserEmail: currentUser.email || '',
                          toUserId: toUserId || null,
                          toUserEmail: shareEmail.trim(),
                          status: 'pending',
                          createdAt: serverTimestamp(),
                        });
                        setShareEmail('');
                        try {
                          setConfirmModalConfig({
                            title: 'Invitation Sent',
                            message: 'Share invitation sent successfully.',
                            confirmText: 'OK',
                            confirmButtonType: 'primary',
                            onConfirm: () => setShowConfirmModal(false)
                          });
                          setShowConfirmModal(true);
                        } catch {}
                      } catch (e) {
                        try {
                          setConfirmModalConfig({
                            title: 'Share Failed',
                            message: 'Failed to send share. Please try again.',
                            confirmText: 'OK',
                            confirmButtonType: 'secondary',
                            onConfirm: () => setShowConfirmModal(false)
                          });
                          setShowConfirmModal(true);
                        } catch {}
                      } finally {
                        setSharing(false);
                      }
                    }}
                    disabled={sharing}
                    style={{ ...getButtonStyle('primary', 'customers'), opacity: sharing ? 0.7 : 1, position: 'relative' }}
                  >
                    {sharing ? 'Sending…' : 'Share'}
                  </button>
                </div>
                <div style={{ fontSize: 12, color: DESIGN_SYSTEM.colors.text.secondary }}>People with access</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {accessList.length === 0 ? (
                    <div style={{ fontSize: 12, color: DESIGN_SYSTEM.colors.text.tertiary }}>Only you</div>
                  ) : (
                    accessList.map(u => (
                      <div key={u.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`, borderRadius: 8, padding: 8 }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{u.name}</div>
                          <div style={{ fontSize: 12, color: DESIGN_SYSTEM.colors.text.secondary }}>{u.email}</div>
                        </div>
                        {/* Optional: add remove button for owner to revoke others later */}
                      </div>
                    ))
                  )}
                </div>
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
          </div>
        </div>

        {showConvertPanel && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1600 }} onClick={() => setShowConvertPanel(false)}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: '92%', maxWidth: 720, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontWeight: 700 }}>Convert to Project</div>
                <button onClick={() => setShowConvertPanel(false)} style={{ ...getButtonStyle('secondary', 'customers') }}>Close</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151', opacity: (hasPendingConversionRequest && !hasApprovedConversion) ? 0.6 : 1 }}>
                    <input
                      type="checkbox"
                      disabled={hasPendingConversionRequest && !hasApprovedConversion}
                      onChange={(e) => {
                        if (hasPendingConversionRequest && !hasApprovedConversion) return;
                        if (e.target.checked) {
                          setShowConvertPanel(false);
                          setShowProjectConversionApprovalModal(true);
                        }
                      }}
                    />
                    No Approval Needed (create directly)
                  </label>
                </div>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Approval Request and Project Details</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280', flex: 1 }}>
                      <span style={{ marginBottom: 4 }}>Project Name</span>
                      <input value={convertForm.name} onChange={(e) => setConvertForm(f => ({ ...f, name: e.target.value }))} placeholder="Enter project name" />
                    </label>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280' }}>
                      <span style={{ marginBottom: 4 }}>Start Date</span>
                      <input type="date" value={convertForm.startDate} onChange={(e) => setConvertForm(f => ({ ...f, startDate: e.target.value }))} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280' }}>
                      <span style={{ marginBottom: 4 }}>End Date</span>
                      <input type="date" value={convertForm.endDate} onChange={(e) => setConvertForm(f => ({ ...f, endDate: e.target.value }))} />
                    </label>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280' }}>
                      <span style={{ marginBottom: 4 }}>Budget</span>
                      <input type="number" step="0.01" value={convertForm.budget} onChange={(e) => setConvertForm(f => ({ ...f, budget: e.target.value }))} placeholder="0.00" />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280' }}>
                      <span style={{ marginBottom: 4 }}>Priority</span>
                      <select value={convertForm.priority} onChange={(e) => setConvertForm(f => ({ ...f, priority: e.target.value }))}>
                        <option value="Low">Low</option>
                        <option value="Normal">Normal</option>
                        <option value="High">High</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </label>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280' }}>
                      <span style={{ marginBottom: 4 }}>Description</span>
                      <textarea value={convertForm.description} onChange={(e) => setConvertForm(f => ({ ...f, description: e.target.value }))} style={{ minHeight: 80 }} placeholder="Summary / scope" />
                    </label>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Approvers (select teammates)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                      {approverMembers.map(m => (
                        <label key={(m.id || m.uid)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                          <input type="checkbox" checked={(convertForm.recipientUids || []).includes(m.id || m.uid)} onChange={(e) => setConvertForm(f => ({ ...f, recipientUids: e.target.checked ? [ ...(f.recipientUids||[]), (m.id || m.uid) ] : (f.recipientUids||[]).filter(x => x !== (m.id || m.uid)) }))} />
                          <span>{m.name || m.email}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                    <button
                      onClick={() => { if (hasPendingConversionRequest && !hasApprovedConversion) return; setShowProjectConversionApprovalModal(true); }}
                      disabled={hasPendingConversionRequest && !hasApprovedConversion}
                      style={{ ...getButtonStyle('secondary', 'customers'), opacity: (hasPendingConversionRequest && !hasApprovedConversion) ? 0.6 : 1, cursor: (hasPendingConversionRequest && !hasApprovedConversion) ? 'not-allowed' : 'pointer' }}
                    >Send Approval Request</button>
                    <button
                      onClick={() => { if (hasPendingConversionRequest && !hasApprovedConversion) return; setShowConvertPanel(false); setShowProjectConversionApprovalModal(true); }}
                      disabled={hasPendingConversionRequest && !hasApprovedConversion}
                      style={{ ...getButtonStyle('primary', 'customers'), opacity: (hasPendingConversionRequest && !hasApprovedConversion) ? 0.6 : 1, cursor: (hasPendingConversionRequest && !hasApprovedConversion) ? 'not-allowed' : 'pointer' }}
                    >Create Project</button>
                  </div>
                  {hasPendingConversionRequest && !hasApprovedConversion && (
                    <div style={{ fontSize: 12, color: '#92400E', marginTop: 6 }}>Awaiting Approval</div>
                  )}
                  {hasApprovedConversion && (
                    <div style={{ fontSize: 12, color: '#065F46', marginTop: 6 }}>Approved – project will be created automatically.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
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
        onConfirm={handleSaveProjectFromConversion}
      />

      <AdvancedApprovalRequestModal
        isOpen={showAdvancedApprovalModal}
        onClose={() => setShowAdvancedApprovalModal(false)}
        onSuccess={handleApprovalRequestSuccess}
        customerId={id}
        customerName={getCustomerName()}
        currentUser={currentUser}
        currentStage={currentStage}
        nextStage={stages[stages.indexOf(currentStage) + 1] || ""}
        isStageAdvancement={approvalModalType === 'stage'}
        showCreateProjectFields={false}
        showNoApprovalToggle={false}
        customerProfileData={customerProfile}
        companyProfileData={companyProfile}
        />

      <AdvancedApprovalRequestModal
        isOpen={showProjectConversionApprovalModal}
        onClose={() => setShowProjectConversionApprovalModal(false)}
        onSuccess={handleProjectConversionApprovalSuccess}
        customerId={id}
        customerName={getCustomerName()}
        currentUser={currentUser}
        currentStage=""
        nextStage=""
        isStageAdvancement={false}
        autoAttachQuotation={true}
        showNoApprovalToggle={true}
        onCreateProject={(data) => handleSaveProjectFromConversion({ ...data, team: data.team || [] })}
        customerProfileData={customerProfile}
        companyProfileData={companyProfile}
        quoteProjectId={selectedProjectId || null}
        quoteProjectName={projectNames[selectedProjectId] || ''}
      />

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={confirmModalConfig.onConfirm}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        confirmText={confirmModalConfig.confirmText}
        confirmButtonType={confirmModalConfig.confirmButtonType}
        hideCancel={true}
      />

      {showLeadBreakdown && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1600 }} onClick={() => setShowLeadBreakdown(false)}>
          <div onClick={(e)=>e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 520, maxWidth: '92vw', maxHeight: '70vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>Lead Score Breakdown</div>
              <button onClick={() => setShowLeadBreakdown(false)} style={{ ...getButtonStyle('secondary', 'customers') }}>Close</button>
            </div>
            {(() => {
              const cur = selectedProjectId ? projectLeadScore : leadScoreData;
              if (!cur) return (<div style={{ color: DESIGN_SYSTEM.colors.text.secondary }}>No score yet.</div>);
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div><strong>Score:</strong> {cur.score} <span style={{ color: '#6b7280' }}>({cur.band})</span></div>
                  <div style={{ fontWeight: 600, marginTop: 6 }}>Contributors</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {(cur.breakdown || []).map((b, idx) => (
                      <li key={idx} style={{ fontSize: 13, color: '#374151' }}>{b}</li>
                    ))}
                  </ul>
                </div>
              );
            })()}
          </div>
        </div>
      )}
      {showSopPicker && <SopPicker onClose={() => setShowSopPicker(false)} />}
    </div>
  );
}
