import React, { useEffect, useState, useRef } from 'react';
import { DESIGN_SYSTEM, getCardStyle } from '../../styles/designSystem';
import AttachedFiles from './AttachedFiles';
import CustomerQuotesPanel from './CustomerQuotesPanel';
import ProjectReminders from '../project-component/Reminders';
import CustomerReminders from './Reminders';
import StatusPanel from './StatusPanel';
import TaskManager from './TaskManager';
import { db } from '../../firebase';
import { collection, onSnapshot } from 'firebase/firestore';

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
  onSendApprovalRequest,
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

  const tabs = ['Stages','Reminders','Transcripts','Files','Quotes','Actions'];

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
                />
              )}
            />
          ) : (
            (() => {
              const snap = projectSnapshots[selectedProjectId] || null;
              if (!snap) return <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontStyle: 'italic' }}>Open the project to manage stages.</div>;
              const snapStages = snap.stages || [];
              const snapStageData = snap.stageData || {};
              const snapCurrent = snap.currentStage || (snapStages[0] || '');
              return (
                <StatusPanel
                  stages={snapStages}
                  currentStage={snapCurrent}
                  setCurrentStage={() => {}}
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
                      <button onClick={async () => { try { const { deleteDoc, doc } = await import('firebase/firestore'); const { db } = await import('../../firebase'); await deleteDoc(doc(db, 'projects', selectedProjectId, 'meetingTranscripts', file.id)); } catch { alert('Failed to delete'); } }} style={{ padding: '4px 8px', borderRadius: 9999, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' }}>🗑️ Delete</button>
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
                      <button onClick={async () => { try { const { deleteDoc, doc } = await import('firebase/firestore'); const { db } = await import('../../firebase'); await deleteDoc(doc(db, 'customerProfiles', customerId, 'meetingTranscripts', file.id)); } catch { alert('Failed to delete'); } }} style={{ padding: '4px 8px', borderRadius: 9999, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' }}>🗑️ Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )
        )}

        {activeTab === 'Files' && (
          <AttachedFiles
            files={files}
            onFileAdd={onFileAdd}
            onFileRemove={onFileRemove}
            onFileRename={onFileRename}
            readOnly={readOnlyCustomer}
          />
        )}

        {activeTab === 'Quotes' && (
          <CustomerQuotesPanel
            customerId={customerId}
            projects={projects}
            customerProfile={customerProfile}
            readOnly={readOnlyCustomer}
          />
        )}

        {activeTab === 'Actions' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={onConvertToProject}
              style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
            >
              Convert to Project
            </button>
            <button
              onClick={onSendApprovalRequest}
              style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
            >
              Send Approval Request
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes proflow-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}


