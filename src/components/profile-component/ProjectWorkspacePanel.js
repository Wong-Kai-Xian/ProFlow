import React, { useEffect, useState, useRef } from 'react';
import { DESIGN_SYSTEM, getCardStyle } from '../../styles/designSystem';
import AttachedFiles from './AttachedFiles';
import CustomerQuotesPanel from './CustomerQuotesPanel';
import ProjectQuotesPanel from '../project-component/ProjectQuotesPanel';
import ProjectReminders from '../project-component/Reminders';
import CustomerReminders from './Reminders';
import StatusPanel from './StatusPanel';
import TaskManager from './TaskManager';
import { db } from '../../firebase';
import { collection, onSnapshot, deleteDoc, doc } from 'firebase/firestore';

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
              renderStageContent={(stage, currentStageData, setCurrentStageData) => (
                <TaskManager 
                  stage={stage}
                  stageData={currentStageData}
                  setStageData={setCurrentStageData}
                  readOnly={true}
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
              {projectFiles.length === 0 ? (
                <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontStyle: 'italic' }}>No files attached.</div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                  {projectFiles.map((f, idx) => (
                    <li key={idx} style={{ display: 'contents' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(f.type === 'image' ? '🖼️' : '📄')} {f.name || 'File'}
                      </div>
                      <div>
                        {f.url && (
                          <a href={f.url} target="_blank" rel="noreferrer" style={{ padding: '4px 8px', border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, borderRadius: 6, fontSize: 12 }}>Open</a>
                        )}
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
            <ProjectQuotesPanel projectId={selectedProjectId} />
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
    </div>
  );
}


