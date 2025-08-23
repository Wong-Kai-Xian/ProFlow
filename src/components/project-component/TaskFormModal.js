import React, { useState, useEffect } from 'react';
import { COLORS, LAYOUT, BUTTON_STYLES, INPUT_STYLES } from '../profile-component/constants';

export default function TaskFormModal({ isOpen, onClose, onSaveTask, initialTaskData, projectMembers = [] }) {
  const [taskForm, setTaskForm] = useState({
    name: "",
    assignedTo: "",
    priority: "Low",
    deadline: "",
    status: "working on", // Default status for new tasks
  });

  useEffect(() => {
    if (isOpen && initialTaskData) {
      setTaskForm(initialTaskData);
    } else if (isOpen) {
      // Reset form for new task when modal opens without initial data
      setTaskForm({ name: "", assignedTo: "", priority: "Low", deadline: "", status: "working on" });
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
        width: "400px",
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
