import React from "react";
import { COLORS, BUTTON_STYLES, LAYOUT } from "./constants"; // Import LAYOUT

export default function TaskManager({ stage, stageData, setStageData }) {
  const tasks = stageData[stage]?.tasks || [];

  const addTask = () => {
    const taskName = prompt("Enter task name:");
    if (taskName && taskName.trim()) {
      const newTasks = [...tasks, { name: taskName.trim(), done: false }];
      setStageData({ 
        ...stageData, 
        [stage]: { 
          ...stageData[stage], 
          tasks: newTasks 
        } 
      });
    }
  };

  const toggleTask = (taskIndex) => {
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
    <div style={{ marginTop: LAYOUT.gap }}>
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: LAYOUT.smallGap
      }}>
        <h5 style={{ margin: 0, color: COLORS.text }}>Tasks</h5>
        <button
          onClick={addTask}
          style={{
            ...BUTTON_STYLES.primary,
            padding: "4px 8px",
            fontSize: "12px"
          }}
        >
          + Add Task
        </button>
      </div>

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
                style={{ cursor: "pointer" }}
              />
              <span style={{
                flex: 1,
                textDecoration: task.done ? "line-through" : "none",
                color: task.done ? COLORS.success : COLORS.text,
                fontSize: "14px"
              }}>
                {task.name}
              </span>
              <button
                onClick={() => removeTask(index)}
                style={{
                  ...BUTTON_STYLES.secondary,
                  background: "none", // No background for 'x' button
                  border: "none", // No border
                  color: COLORS.danger, // Red color for 'x'
                  padding: "2px", // Minimal padding
                  fontSize: "16px",
                  borderRadius: "3px"
                }}
                title="Remove task"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
