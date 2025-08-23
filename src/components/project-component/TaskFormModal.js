import React, { useState, useEffect } from 'react';
import { COLORS, LAYOUT, BUTTON_STYLES, INPUT_STYLES } from '../profile-component/constants';
import { storage } from '../../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export default function TaskFormModal({ isOpen, onClose, onSaveTask, initialTaskData, projectMembers = [], projectId }) {
  const [taskForm, setTaskForm] = useState({
    name: "",
    assignedTo: "",
    priority: "Low",
    deadline: "",
    status: "working on", // Default status for new tasks
    links: [], // Array of { label, url }
    attachments: [], // Array of { name, url }
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (isOpen && initialTaskData) {
      setTaskForm({
        ...initialTaskData,
        links: initialTaskData.links || [],
        attachments: initialTaskData.attachments || []
      });
    } else if (isOpen) {
      // Reset form for new task when modal opens without initial data
      setTaskForm({ name: "", assignedTo: "", priority: "Low", deadline: "", status: "working on", links: [], attachments: [] });
    }
  }, [isOpen, initialTaskData]);

  const handleSubmit = () => {
    if (taskForm.name.trim()) {
      onSaveTask(taskForm);
      onClose();
    }
  };

  const modalTitle = initialTaskData ? "Edit Task" : "Add New Task";
  const submitButtonText = initialTaskData ? "Save Changes" : "Add Task";

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000
    }}>
      <div style={{
        background: COLORS.background,
        padding: LAYOUT.gap,
        borderRadius: LAYOUT.borderRadius,
        boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
        width: "90%",
        maxWidth: "720px",
        maxHeight: "90vh",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: LAYOUT.smallGap,
      }}>
        <h3 style={{ margin: 0, color: COLORS.text }}>{modalTitle}</h3>
        
        <input
          type="text"
          placeholder="Task Name"
          value={taskForm.name}
          onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })}
          style={INPUT_STYLES.base}
        />
        <select
          value={taskForm.assignedTo}
          onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
          style={INPUT_STYLES.base}
        >
          <option value="">Select Team Member</option>
          {projectMembers.map((member, index) => (
            <option key={member.uid || member.id || index} value={member.name || member.displayName || member.email}>
              {member.name || member.displayName || member.email || 'Team Member'}
            </option>
          ))}
        </select>
        <select
          value={taskForm.priority}
          onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
          style={INPUT_STYLES.base}
        >
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </select>
        <input
          type="date"
          value={taskForm.deadline}
          onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })}
          style={INPUT_STYLES.base}
        />

        {/* Links */}
        <div>
          <label style={{ display: 'block', marginBottom: '4px', color: COLORS.dark, fontSize: '13px', fontWeight: 600 }}>Links</label>
          {taskForm.links.map((link, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
              <input
                type="text"
                placeholder="Label"
                value={link.label}
                onChange={(e) => {
                  const newLinks = [...taskForm.links];
                  newLinks[idx] = { ...newLinks[idx], label: e.target.value };
                  setTaskForm({ ...taskForm, links: newLinks });
                }}
                style={{ ...INPUT_STYLES.base, flex: 1 }}
              />
              <input
                type="url"
                placeholder="https://example.com"
                value={link.url}
                onChange={(e) => {
                  const newLinks = [...taskForm.links];
                  newLinks[idx] = { ...newLinks[idx], url: e.target.value };
                  setTaskForm({ ...taskForm, links: newLinks });
                }}
                style={{ ...INPUT_STYLES.base, flex: 2 }}
              />
              {link.url && (
                <a href={link.url} target="_blank" rel="noopener noreferrer" style={{
                  ...BUTTON_STYLES.text,
                  textDecoration: 'underline',
                  fontSize: '12px',
                  alignSelf: 'center'
                }}>Open</a>
              )}
              <button
                onClick={() => setTaskForm({ ...taskForm, links: taskForm.links.filter((_, i) => i !== idx) })}
                style={{ ...BUTTON_STYLES.secondary }}
              >
                Remove
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setTaskForm({ ...taskForm, links: [...taskForm.links, { label: '', url: '' }] })}
              style={{ ...BUTTON_STYLES.secondary, padding: '6px 10px' }}
            >
              + Add Link
            </button>
          </div>
        </div>

        {/* Attachments (URL-based) */}
        <div>
          <label style={{ display: 'block', marginBottom: '4px', color: COLORS.dark, fontSize: '13px', fontWeight: 600 }}>Attachments</label>
          {taskForm.attachments.map((att, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
              <input
                type="text"
                placeholder="File name"
                value={att.name}
                onChange={(e) => {
                  const newAtt = [...taskForm.attachments];
                  newAtt[idx] = { ...newAtt[idx], name: e.target.value };
                  setTaskForm({ ...taskForm, attachments: newAtt });
                }}
                style={{ ...INPUT_STYLES.base, flex: 1 }}
              />
              <input
                type="url"
                placeholder="https://file-url"
                value={att.url}
                onChange={(e) => {
                  const newAtt = [...taskForm.attachments];
                  newAtt[idx] = { ...newAtt[idx], url: e.target.value };
                  setTaskForm({ ...taskForm, attachments: newAtt });
                }}
                style={{ ...INPUT_STYLES.base, flex: 2 }}
              />
              {att.url && (
                <a href={att.url} target="_blank" rel="noopener noreferrer" style={{
                  ...BUTTON_STYLES.text,
                  textDecoration: 'underline',
                  fontSize: '12px',
                  alignSelf: 'center'
                }}>Open</a>
              )}
              <button
                onClick={() => setTaskForm({ ...taskForm, attachments: taskForm.attachments.filter((_, i) => i !== idx) })}
                style={{ ...BUTTON_STYLES.secondary }}
              >
                Remove
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                // Trigger native file picker via the input element above
                const inputs = document.querySelectorAll('input[type="file"]');
                const input = inputs[inputs.length - 1];
                if (input) input.click();
              }}
              style={{ ...BUTTON_STYLES.secondary, padding: '6px 10px' }}
              type="button"
            >
              + Add Attachment
            </button>
          </div>
          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="file" onChange={(e) => {
              const file = e.target.files && e.target.files[0];
              if (!file) return;
              setUploading(true);
              const path = `task_attachments/${projectId || 'general'}/${Date.now()}_${file.name}`;
              const storageRef = ref(storage, path);
              const uploadTask = uploadBytesResumable(storageRef, file);
              uploadTask.on('state_changed', (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
              }, (err) => {
                console.error('Upload error:', err);
                setUploading(false);
              }, async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                setTaskForm(prev => ({ ...prev, attachments: [...prev.attachments, { name: file.name, url }] }));
                setUploading(false);
              });
            }} style={{ display: 'none' }} />
            {uploading && <span style={{ fontSize: '12px', color: COLORS.primary }}>Uploading... {uploadProgress.toFixed(0)}%</span>}
          </div>
        </div>
        
        {/* Status dropdown only for editing, or if a new task should have a default status option visible */}
        {!initialTaskData && (
          <select
            value={taskForm.status}
            onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
            style={INPUT_STYLES.base}
          >
            <option value="working on">Working On</option>
            <option value="stuck">Stuck</option>
            <option value="complete">Complete</option>
          </select>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: LAYOUT.smallGap, marginTop: LAYOUT.smallGap }}>
          <button onClick={onClose} style={{ ...BUTTON_STYLES.secondary }}>
            Cancel
          </button>
          <button onClick={handleSubmit} style={{ ...BUTTON_STYLES.primary }}>
            {submitButtonText}
          </button>
        </div>
      </div>
    </div>
  );
}
