import React, { useEffect, useState, useRef } from 'react';
import { DESIGN_SYSTEM, getCardStyle } from '../../styles/designSystem';
import AttachedFiles from './AttachedFiles';
import CustomerQuotesPanel from './CustomerQuotesPanel';
import ProjectQuotesPanel from '../project-component/ProjectQuotesPanel';
import ProjectReminders from '../project-component/Reminders';
import CustomerReminders from './Reminders';
import StatusPanel from './StatusPanel';
import TaskManager from './TaskManager';
import { logLeadEvent, recomputeAndSaveForCustomer } from '../../services/leadScoreService';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { collection, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import GoogleEmbedModal from '../common/GoogleEmbedModal';
import { ensureDriveToken as ensureDriveTokenCentral, requestDriveConsent } from '../../utils/googleAuth';
import AttachDriveFileModal from '../common/AttachDriveFileModal';
import PreviewModal from '../common/PreviewModal';
import DriveShareModal from '../common/DriveShareModal';
import FileActionsModal from '../common/FileActionsModal';

export default function ProjectWorkspacePanel({
  selectedProjectId,
  projects = [],
  projectNames = {},
  files = [],
  onFileAdd,
  onFileRemove,
  onFileRename,
  customerId,
  customerProfile,
  companyProfile,
  onConvertToProject,
  // Stages (customer pipeline)
  stages,
  currentStage,
  setCurrentStage,
  stageData,
  setStageData,
  setStages,
  onStagesUpdate,
  hasApprovedConversion,
  onCreateProjectAfterApproval,
  onRequestApproval,
  customerName,
  projectSnapshots = {},
  // Customer-level reminders and transcripts (pre-project)
  customerReminders = [],
  onAddCustomerReminder,
  onCustomerReminderRemove,
  customerTranscripts = []
}) {
  const { currentUser } = useAuth();
  // Editable when no project is selected; read-only when a project is selected
  const readOnlyCustomer = Boolean(selectedProjectId);
  const [activeTab, setActiveTab] = useState('Stages'); // default to Stages per request
  const [transcripts, setTranscripts] = useState([]);
  const [isSwitching, setIsSwitching] = useState(false);
  const switchTimerRef = useRef(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // { scope: 'project'|'customer', file }
  const [confirmDeleteStep, setConfirmDeleteStep] = useState(0);
  const [projectFiles, setProjectFiles] = useState([]);
  const [snapshotViewStage, setSnapshotViewStage] = useState('');
  const [showGoogleViewer, setShowGoogleViewer] = useState(false);
  const [googleViewerType, setGoogleViewerType] = useState(''); // 'gdoc'|'gsheet'|'gslide'
  const [googleViewerId, setGoogleViewerId] = useState('');
  const [googleViewerTitle, setGoogleViewerTitle] = useState('');
  const [showAttachDrive, setShowAttachDrive] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [driveAuthNeeded, setDriveAuthNeeded] = useState(false);
  const [driveAuthError, setDriveAuthError] = useState('');
  const [actionsFile, setActionsFile] = useState(null);
  const [shareFile, setShareFile] = useState(null);

  const ensureDriveToken = async () => {
    try { const t = await ensureDriveTokenCentral(); return t || null; } catch { return null; }
  };

  const createGoogleFile = async (kind) => {
    try {
      if (!selectedProjectId) return;
      let token = await ensureDriveToken();
      if (!token) token = await requestDriveConsent();
      if (!token) { setDriveAuthNeeded(true); alert('Google Drive authorization required.'); return; }
      const mimeMap = {
        gdoc: 'application/vnd.google-apps.document',
        gsheet: 'application/vnd.google-apps.spreadsheet',
        gslide: 'application/vnd.google-apps.presentation'
      };
      const typeLabel = kind === 'gdoc' ? 'Document' : kind === 'gsheet' ? 'Spreadsheet' : 'Presentation';
      const defaultName = `${typeLabel} - ${customerName || 'Untitled'} - ${new Date().toLocaleDateString()}`;
      const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink,parents&supportsAllDrives=true', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: defaultName, mimeType: mimeMap[kind], parents: ['root'] })
      });
      if (!res.ok) {
        try {
          const err = await res.json();
          const msg = err?.error?.message || `HTTP ${res.status}`;
          if (res.status === 401 || res.status === 403) setDriveAuthNeeded(true);
          alert(`Failed to create file: ${msg}`);
        } catch {
          alert('Failed to create file.');
        }
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
      try {
        await updateDoc(doc(db, 'projects', selectedProjectId), { files: Array.isArray(projectFiles) ? [...projectFiles, entry] : [entry] });
      } catch {
        alert('File created but failed to save to project');
      }
      // Open in viewer immediately
      setGoogleViewerType(kind);
      setGoogleViewerId(driveId);
      setGoogleViewerTitle(entry.name);
      setShowGoogleViewer(true);
    } catch {
      alert('Failed to create Google file.');
    }
  };

  const copyLink = async (url) => {
    try { await navigator.clipboard.writeText(url || ''); } catch {}
  };

  const renameGoogleFile = async (file, providedName) => {
    try {
      if (!selectedProjectId || !file?.driveId) return;
      let nextName = providedName;
      if (!nextName) {
        nextName = window.prompt('Rename file to:', file.name || 'Untitled') || '';
      }
      if (!nextName || nextName === file.name) return;
      let token = await ensureDriveToken();
      if (!token) token = await requestDriveConsent();
      if (!token) { setDriveAuthNeeded(true); alert('Authorization required to rename.'); return; }
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.driveId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nextName })
      });
      if (!res.ok) { alert('Failed to rename on Drive'); return; }
      const next = (Array.isArray(projectFiles) ? projectFiles : []).map((f) => (f.driveId === file.driveId ? { ...f, name: nextName } : f));
      await updateDoc(doc(db, 'projects', selectedProjectId), { files: next });
    } catch {
      alert('Rename failed');
    }
  };

  const deleteGoogleFile = async (file) => {
    try {
      if (!selectedProjectId || !file?.driveId) return;
      const sure = window.confirm('Delete this file from Drive and remove from project?');
      if (!sure) return;
      let token = await ensureDriveToken();
      if (!token) token = await requestDriveConsent();
      if (!token) { setDriveAuthNeeded(true); alert('Authorization required to delete.'); return; }
      // Move to trash instead of permanent delete
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.driveId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ trashed: true })
      });
      if (!res.ok) { alert('Failed to delete on Drive'); return; }
      const next = (Array.isArray(projectFiles) ? projectFiles : []).filter((f) => f.driveId !== file.driveId);
      await updateDoc(doc(db, 'projects', selectedProjectId), { files: next });
    } catch {
      alert('Delete failed');
    }
  };

  const shareGoogleFile = async (file) => {
    try {
      if (!file?.driveId) return;
      let token = await ensureDriveToken();
      if (!token) token = await requestDriveConsent();
      if (!token) { setDriveAuthNeeded(true); alert('Authorization required to share.'); return; }
      // Create anyone-with-link reader permission
      const permRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.driveId}/permissions?supportsAllDrives=true`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'reader', type: 'anyone', allowFileDiscovery: false })
      });
      if (!permRes.ok) { alert('Failed to set sharing permission'); return; }
      // Fetch webViewLink
      const getRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.driveId}?fields=webViewLink&supportsAllDrives=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      let link = file.url || '';
      if (getRes.ok) {
        const j = await getRes.json();
        if (j.webViewLink) link = j.webViewLink;
      }
      try { await navigator.clipboard.writeText(link); alert('Share link copied'); } catch { alert('Share enabled'); }
    } catch {
      alert('Share failed');
    }
  };

  useEffect(() => {
    // Show loading indicator on project change
    setIsSwitching(true);
    if (switchTimerRef.current) { try { clearTimeout(switchTimerRef.current); } catch {} }
    switchTimerRef.current = setTimeout(() => setIsSwitching(false), 700);

    if (!selectedProjectId) { setTranscripts([]); return; }
    const colRef = collection(db, 'projects', selectedProjectId, 'meetingTranscripts');
    const unsub = onSnapshot(colRef, snap => {
      const files = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
      setTranscripts(files);
      // Data arrived; hide loading
      setIsSwitching(false);
    });
    return () => unsub();
  }, [selectedProjectId]);

  // Load project files when a project is selected
  useEffect(() => {
    if (!selectedProjectId) { setProjectFiles([]); return; }
    const unsub = onSnapshot(doc(db, 'projects', selectedProjectId), snap => {
      const data = snap.data() || {};
      setProjectFiles(Array.isArray(data.files) ? data.files : []);
    });
    return () => unsub();
  }, [selectedProjectId]);

  // Proactively check Drive auth when opening Files tab in a project
  useEffect(() => {
    if (activeTab !== 'Files' || !selectedProjectId) return;
    (async () => {
      try {
        const token = await ensureDriveToken();
        setDriveAuthNeeded(!token);
      } catch {
        setDriveAuthNeeded(true);
      }
    })();
  }, [activeTab, selectedProjectId]);

  const tabs = ['Stages','Reminders','Transcripts','Files','Quotes'];

  return (
    <div style={getCardStyle('customers')}>
      <div style={{
        background: DESIGN_SYSTEM.pageThemes.customers.gradient,
        color: DESIGN_SYSTEM.colors.text.inverse,
        padding: DESIGN_SYSTEM.spacing.base,
        borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: DESIGN_SYSTEM.typography.fontSize.lg, fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold }}>
            Customer Relationship Management
          </h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', background: DESIGN_SYSTEM.colors.background.primary, color: DESIGN_SYSTEM.colors.text.primary, padding: 6, borderRadius: 9999 }}>
            {tabs.map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{
                padding: '6px 10px',
                borderRadius: 9999,
                border: `1px solid ${activeTab === t ? DESIGN_SYSTEM.pageThemes.customers.accent : DESIGN_SYSTEM.colors.secondary[300]}`,
                background: activeTab === t ? DESIGN_SYSTEM.colors.secondary[200] : DESIGN_SYSTEM.colors.background.primary,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700
              }}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: DESIGN_SYSTEM.spacing.base, position: 'relative' }}>
        {isSwitching && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, borderRadius: 12 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '3px solid rgba(0,0,0,0.15)', borderTopColor: DESIGN_SYSTEM.pageThemes.customers.accent,
              animation: 'proflow-spin 0.8s linear infinite'
            }} />
          </div>
        )}
        {activeTab === 'Stages' && (
          !selectedProjectId ? (
            <StatusPanel
              stages={stages}
              currentStage={currentStage}
              setCurrentStage={setCurrentStage}
              stageData={stageData}
              setStageData={setStageData}
              setStages={setStages}
              onStagesUpdate={onStagesUpdate}
              onConvertToProject={onConvertToProject}
              onCreateProjectAfterApproval={onCreateProjectAfterApproval}
              hasApprovedConversion={hasApprovedConversion}
              onRequestApproval={onRequestApproval}
              customerId={customerId}
              customerName={customerName}
              companyProfile={companyProfile}
              renderStageContent={(stage, currentStageData, setCurrentStageData) => (
                <TaskManager 
                  stage={stage}
                  stageData={currentStageData}
                  setStageData={(next) => {
                    try { setCurrentStageData(next); } catch {}
                    try { if (customerId) updateDoc(doc(db, 'customerProfiles', customerId), { stageData: next }); } catch {}
                  }}
                  readOnly={false}
                  onTaskToggle={async ({ stage: st, taskName }) => {
                    try {
                      if (!customerId) return;
                      await logLeadEvent(customerId, 'taskCompleted', { stage: st, taskName });
                      // Recompute only for No Project (we are on No Project tab here)
                      const res = await recomputeAndSaveForCustomer({ userId: currentUser?.uid, customerId, companyProfile: (companyProfile || {}) });
                      try { const ev = new CustomEvent('proflow-leadscore-updated', { detail: { customerId, result: res } }); window.dispatchEvent(ev); } catch {}
                    } catch {}
                  }}
                />
              )}
            />
          ) : (
            (() => {
              const snap = projectSnapshots[selectedProjectId] || null;
              if (!snap) return <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontStyle: 'italic' }}>Open the project to manage stages.</div>;
              const snapStages = snap.stages || [];
              const snapStageData = snap.stageData || {};
              const snapCurrent = snapshotViewStage || snap.currentStage || (snapStages[0] || '');
              if (!snapshotViewStage && snapCurrent) setSnapshotViewStage(snapCurrent);
              return (
                <StatusPanel
                  stages={snapStages}
                  currentStage={snapCurrent}
                  setCurrentStage={setSnapshotViewStage}
                  stageData={snapStageData}
                  setStageData={() => {}}
                  setStages={() => {}}
                  onStagesUpdate={() => {}}
                  readOnly={true}
                  customerId={customerId}
                  customerName={customerName}
                  companyProfile={companyProfile}
                  renderStageContent={(stage, currentStageData) => (
                    <TaskManager 
                      stage={stage}
                      stageData={currentStageData}
                      setStageData={() => {}}
                      readOnly={true}
                    />
                  )}
                />
              );
            })()
          )
        )}

        {activeTab === 'Reminders' && (
          selectedProjectId ? (
            <ProjectReminders projectId={selectedProjectId} />
          ) : (
            <CustomerReminders
              reminders={customerReminders}
              onAddReminder={onAddCustomerReminder}
              onReminderRemove={onCustomerReminderRemove}
            />
          )
        )}

        {activeTab === 'Transcripts' && (
          selectedProjectId ? (
            transcripts.length === 0 ? (
              <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontStyle: 'italic' }}>No transcripts yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {transcripts.map(file => (
                  <div key={file.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`, borderRadius: 8, padding: 8, background: '#fff' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontWeight: 600 }}>{file.name}</div>
                      <div style={{ fontSize: DESIGN_SYSTEM.typography.fontSize.sm, color: DESIGN_SYSTEM.colors.text.secondary }}>{new Date((file.createdAt?.seconds||0)*1000).toLocaleString()}</div>
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
                      }} style={{ padding: '4px 8px', borderRadius: 9999, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, background: '#fff', color: '#111827', border: '1px solid #e5e7eb' }}>⬇️ Download</button>
                      <button onClick={() => { /* AI modal handled at page level; emit event */ try { const ev = new CustomEvent('proflow-ai-actions', { detail: { scope: 'project', transcript: file } }); window.dispatchEvent(ev); } catch {} }} style={{ padding: '4px 8px', borderRadius: 9999, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, background: '#111827', color: '#fff', border: '1px solid #111827' }}>🤖 AI Actions</button>
                      <button onClick={() => { setConfirmDelete({ scope: 'project', file }); setConfirmDeleteStep(1); }} style={{ padding: '4px 8px', borderRadius: 9999, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' }}>🗑️ Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            customerTranscripts.length === 0 ? (
              <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontStyle: 'italic' }}>No transcripts yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {customerTranscripts.map(file => (
                  <div key={file.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`, borderRadius: 8, padding: 8, background: '#fff' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontWeight: 600 }}>{file.name}</div>
                      <div style={{ fontSize: DESIGN_SYSTEM.typography.fontSize.sm, color: DESIGN_SYSTEM.colors.text.secondary }}>{new Date((file.createdAt?.seconds||0)*1000).toLocaleString()}</div>
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
                      }} style={{ padding: '4px 8px', borderRadius: 9999, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, background: '#fff', color: '#111827', border: '1px solid #e5e7eb' }}>⬇️ Download</button>
                      <button onClick={() => { try { const ev = new CustomEvent('proflow-ai-actions', { detail: { scope: 'customer', transcript: file } }); window.dispatchEvent(ev); } catch {} }} style={{ padding: '4px 8px', borderRadius: 9999, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, background: '#111827', color: '#fff', border: '1px solid #111827' }}>🤖 AI Actions</button>
                      <button onClick={() => { setConfirmDelete({ scope: 'customer', file }); setConfirmDeleteStep(1); }} style={{ padding: '4px 8px', borderRadius: 9999, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' }}>🗑️ Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )
        )}

        {activeTab === 'Files' && (
          selectedProjectId ? (
            <div>
              {driveAuthNeeded && (
                <div style={{ marginBottom: 10, padding: 10, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, borderRadius: 8, background: '#fffbe6', color: '#7c6f00', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div>Authorize Google Drive to create, attach, and share files.</div>
                    {driveAuthError && (<div style={{ color: '#b45309', fontSize: 12, marginTop: 4 }}>Error: {driveAuthError}</div>)}
                  </div>
                  <button onClick={async () => { const t = await requestDriveConsent(); if (t) { setDriveAuthNeeded(false); setDriveAuthError(''); } }} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: '#fff', cursor: 'pointer', fontSize: 12 }}>Authorize Google Drive</button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <button onClick={() => createGoogleFile('gdoc')} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: '#fff', cursor: 'pointer', fontSize: 12 }}>+ New Google Doc</button>
                <button onClick={() => createGoogleFile('gsheet')} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: '#fff', cursor: 'pointer', fontSize: 12 }}>+ New Google Sheet</button>
                <button onClick={() => createGoogleFile('gslide')} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: '#fff', cursor: 'pointer', fontSize: 12 }}>+ New Google Slides</button>
                <button onClick={() => setShowAttachDrive(true)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: '#fff', cursor: 'pointer', fontSize: 12 }}>Attach from Drive</button>
              </div>
              {projectFiles.length === 0 ? (
                <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontStyle: 'italic' }}>No files attached.</div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                  {projectFiles.map((f, idx) => (
                    <li key={idx} style={{ display: 'contents' }}>
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
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button onClick={() => setActionsFile(f)} style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: '#fff', fontSize: 12 }}>Edit</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <AttachedFiles
              files={files}
              onFileAdd={onFileAdd}
              onFileRemove={onFileRemove}
              onFileRename={onFileRename}
              readOnly={readOnlyCustomer}
            />
          )
        )}

        {activeTab === 'Quotes' && (
          selectedProjectId ? (
            <ProjectQuotesPanel projectId={selectedProjectId} hideConvert={true} />
          ) : (
            <CustomerQuotesPanel
              customerId={customerId}
              projects={projects}
              customerProfile={customerProfile}
              readOnly={readOnlyCustomer}
            />
          )
        )}

        
      </div>
      {/* Double-confirmation modals for transcript delete */}
      {confirmDelete && confirmDeleteStep === 1 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setConfirmDelete(null); setConfirmDeleteStep(0); }}>
          <div onClick={(e)=>e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 420, maxWidth: '92vw', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', padding: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Delete Transcript</div>
            <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, marginBottom: 12 }}>Delete "{confirmDelete.file?.name || 'this transcript'}"?</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => { setConfirmDelete(null); setConfirmDeleteStep(0); }} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
              <button onClick={() => setConfirmDeleteStep(2)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Continue</button>
            </div>
          </div>
        </div>
      )}
      {confirmDelete && confirmDeleteStep === 2 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setConfirmDelete(null); setConfirmDeleteStep(0); }}>
          <div onClick={(e)=>e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 420, maxWidth: '92vw', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', padding: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 8, color: '#b91c1c' }}>Are you absolutely sure?</div>
            <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, marginBottom: 12 }}>This action cannot be undone.</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => { setConfirmDelete(null); setConfirmDeleteStep(0); }} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
              <button onClick={async () => {
                try {
                  if (confirmDelete.scope === 'project' && selectedProjectId) {
                    await deleteDoc(doc(db, 'projects', selectedProjectId, 'meetingTranscripts', confirmDelete.file.id));
                  } else if (confirmDelete.scope === 'customer' && customerId) {
                    await deleteDoc(doc(db, 'customerProfiles', customerId, 'meetingTranscripts', confirmDelete.file.id));
                  }
                } catch {}
                setConfirmDelete(null);
                setConfirmDeleteStep(0);
              }} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #fecaca', background: '#fee2e2', cursor: 'pointer', fontSize: 12, color: '#b91c1c' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes proflow-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <GoogleEmbedModal isOpen={showGoogleViewer} onClose={() => setShowGoogleViewer(false)} fileType={googleViewerType} driveId={googleViewerId} title={googleViewerTitle} />
      <AttachDriveFileModal isOpen={showAttachDrive} onClose={() => setShowAttachDrive(false)} onSelect={async (file) => {
        try {
          if (!selectedProjectId) return;
          const next = Array.isArray(projectFiles) ? [...projectFiles, file] : [file];
          await updateDoc(doc(db, 'projects', selectedProjectId), { files: next });
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
        onDelete={async (f) => { setActionsFile(null); if (f.type === 'gdoc' || f.type === 'gsheet' || f.type === 'gslide') { await deleteGoogleFile(f); } else { alert('Delete non-Google from Project Detail page.'); } }}
      />
    </div>
  );
}


