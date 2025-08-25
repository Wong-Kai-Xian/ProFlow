import React, { useState } from "react";
import { COLORS, BUTTON_STYLES, LAYOUT } from "./constants"; // Import LAYOUT

export default function TaskManager({ stage, stageData, setStageData, readOnly = false }) {
  const tasks = stageData[stage]?.tasks || [];
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");

  const confirmAddTask = () => {
    if (readOnly) return;
    const taskName = newTaskName;
    if (taskName && taskName.trim()) {
      const newTasks = [...tasks, { name: taskName.trim(), done: false }];
      setStageData({
        ...stageData,
        [stage]: {
          ...stageData[stage],
          tasks: newTasks
        }
      });
      setNewTaskName("");
      setShowAddModal(false);
    }
  };

  const toggleTask = (taskIndex) => {
    if (readOnly) return;
    const newTasks = [...tasks];
    newTasks[taskIndex].done = !newTasks[taskIndex].done;
    setStageData({ 
      ...stageData, 
      [stage]: { 
        ...stageData[stage], 
        tasks: newTasks 
      } 
    });
  };

  const removeTask = (taskIndex) => {
    if (readOnly) return;
    const newTasks = tasks.filter((_, index) => index !== taskIndex);
    setStageData({ 
      ...stageData, 
      [stage]: { 
        ...stageData[stage], 
        tasks: newTasks 
      } 
    });
  };

  return (
    <div>
      {!readOnly && (
        <div style={{ 
          display: "flex", 
          justifyContent: "flex-end",
          marginBottom: LAYOUT.smallGap
        }}>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              ...BUTTON_STYLES.primary,
              padding: "6px 12px",
              fontSize: "12px"
            }}
          >
            + Add Task
          </button>
        </div>
      )}

      {tasks.length === 0 ? (
        <p style={{ 
          color: COLORS.lightText, 
          fontSize: "14px", 
          fontStyle: "italic",
          margin: LAYOUT.smallGap + " 0"
        }}>
          No tasks yet. Add one to get started!
        </p>
      ) : (
        <ul style={{ 
          listStyle: "none", 
          padding: 0, 
          margin: 0,
          maxHeight: "200px",
          overflowY: "auto"
        }}>
          {tasks.map((task, index) => (
            <li key={index} style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px",
              background: task.done ? "#f0f8f0" : "#fff",
              border: `1px solid ${task.done ? "#27AE60" : COLORS.lightBorder}`,
              borderRadius: "6px",
              marginBottom: "6px"
            }}>
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => toggleTask(index)}
                disabled={readOnly}
                style={{ cursor: readOnly ? "default" : "pointer" }}
              />
              <span style={{
                flex: 1,
                textDecoration: task.done ? "line-through" : "none",
                color: task.done ? COLORS.success : COLORS.text,
                fontSize: "14px"
              }}>
                {task.name}
              </span>
              {!readOnly && (
                <button
                  onClick={() => removeTask(index)}
                  style={{
                    ...BUTTON_STYLES.secondary,
                    background: "none",
                    border: "none",
                    color: COLORS.danger,
                    padding: "2px",
                    fontSize: "16px",
                    borderRadius: "3px"
                  }}
                  title="Remove task"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {showAddModal && !readOnly && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
          <div style={{ background: "#fff", borderRadius: 8, padding: 16, width: 360, maxWidth: "95vw", boxShadow: "0 10px 25px rgba(0,0,0,0.15)" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Add Task</div>
            <input
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              placeholder="Task name"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') confirmAddTask(); }}
              style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 10px" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button onClick={() => { setShowAddModal(false); setNewTaskName(""); }} style={{ ...BUTTON_STYLES.secondary }}>Cancel</button>
              <button onClick={confirmAddTask} style={{ ...BUTTON_STYLES.primary }}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
