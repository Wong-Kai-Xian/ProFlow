import React, { useState, useEffect } from 'react';
import Card from '../profile-component/Card';
import { COLORS, LAYOUT, BUTTON_STYLES, INPUT_STYLES } from '../profile-component/constants';
import TaskFormModal from './TaskFormModal'; // Re-using TaskFormModal for adding and editing
import TaskChatModal from './TaskChatModal';
import AddSubtitleModal from './AddSubtitleModal';
import { db } from "../../firebase"; // Import db
import { doc, updateDoc } from "firebase/firestore"; // Import Firestore functions

// Helper to generate a consistent color from a string (e.g., for assigned user initials)
const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  let color = '#';
  for (let i = 0; i < 3; i++) {
    let value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).substr(-2);
  }
  return color;
};

// Helper to get initials
const getInitials = (name) => {
  if (!name) return '';
  const parts = name.split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

// TaskItem Sub-component
const TaskItem = ({ task, onToggle, onRemove, onShowComment, onStatusChange, onEdit }) => {
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High': return COLORS.danger;
      case 'Medium': return COLORS.warning;
      case 'Low': return COLORS.primary;
      default: return COLORS.lightText;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'stuck':
        return COLORS.danger; // Red
      case 'working on':
        return COLORS.warning; // Orange
      case 'complete':
        return COLORS.success; // Green
      default:
        console.log(`Task ID: ${task.id}, Status: ${task.status}, Background Color: ${COLORS.gray}`); // Debugging
        return COLORS.gray; // Default to grey if no status or unknown
    }
  };

  const getDeadlineStatusColor = (deadline) => {
    if (!deadline) return COLORS.lightText; // No deadline
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(deadline);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (task.done) return COLORS.success; // Completed tasks are green
    if (diffDays < 0) return COLORS.danger; // Overdue
    if (diffDays <= 3) return COLORS.warning; // Due soon
    return COLORS.lightText; // Not due soon
  };

  return (
    <li style={{
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "8px",
      background: task.done ? "#f0f8f0" : "#fff",
      border: `1px solid ${task.done ? "#27AE60" : COLORS.lightBorder}`,
      borderRadius: "6px",
      marginBottom: "6px",
      position: "relative",
    }}>
      <div style={{ width: "24px", display: "flex", justifyContent: "center", flexShrink: 0 }}>
        <input
          type="checkbox"
          checked={task.done}
          onChange={onToggle}
          style={{ cursor: "pointer" }}
        />
      </div>
      <strong style={{ 
        flex: 1, 
        textDecoration: task.done ? "line-through" : "none", 
        color: task.done ? COLORS.lightText : COLORS.dark,
        fontSize: "15px",
        fontWeight: "700",
        textAlign: "left"
      }}>{task.name}</strong>
      
      <div style={{
        width: "70px",
        display: "flex",
        justifyContent: "flex-start",
        alignItems: "center",
        flexShrink: 0
      }}>
        {task.assignedTo ? (
          <span style={{
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            background: stringToColor(task.assignedTo),
            color: "white",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontSize: "11px",
            fontWeight: "bold",
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
          }} title={`Assigned to: ${task.assignedTo}`}>
            {getInitials(task.assignedTo)}
          </span>
        ) : (
          <span style={{ color: COLORS.lightText, fontSize: "12px", fontStyle: "italic" }}>N/A</span>
        )}
      </div>

      <div style={{
        width: "80px",
        display: "flex",
        justifyContent: "flex-start", 
        alignItems: "center",
        gap: "3px",
        flexShrink: 0
      }}>
        <span style={{
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          backgroundColor: getPriorityColor(task.priority),
          flexShrink: 0
        }} title={`Priority: ${task.priority}`}></span>
        <span style={{ color: COLORS.dark, fontWeight: "600", fontSize: "14px" }}>{task.priority}</span>
      </div>

      <div style={{
        width: "120px",
        textAlign: "left",
        flexShrink: 0,
        color: getDeadlineStatusColor(task.deadline),
        fontWeight: "600",
        fontSize: "14px"
      }}>
        {task.deadline || 'N/A'}
      </div>

      {/* New: Task Status Dropdown */}
      <select
        value={task.status || 'working on'} // Default to 'working on' if not set
        onChange={(e) => onStatusChange(task.id, e.target.value)}
        style={{
          width: "100px",
          flexShrink: 0,
          padding: "4px",
          borderRadius: "4px",
          border: `1px solid ${COLORS.lightBorder}`,
          backgroundColor: getStatusColor(task.status),
          color: getStatusColor(task.status) === COLORS.warning ? COLORS.dark : COLORS.white,
          fontSize: "13px",
          fontWeight: "600",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <option value="stuck">Stuck</option>
        <option value="working on">Working On</option>
        <option value="complete">Complete</option>
      </select>
      
      <div style={{ display: "flex", gap: "4px", flexShrink: 0, width: "90px", justifyContent: "center" }}> {/* Container for action buttons */}
        <button
          onClick={onShowComment}
          style={{
            background: COLORS.primary,
            border: "none",
            color: COLORS.white,
            padding: "2px",
            fontSize: "14px",
            borderRadius: "6px",
            cursor: "pointer",
            width: "30px",
            height: "30px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
          title="Open Chat"
        >
          🗨️
        </button>

        <button
          onClick={() => onEdit(task)} // New: Edit button
          style={{
            background: COLORS.secondary,
            border: "none",
            color: COLORS.white,
            padding: "2px",
            fontSize: "16px",
            borderRadius: "6px",
            cursor: "pointer",
            width: "30px",
            height: "30px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
          title="Edit Task"
        >
          ⚙️
        </button>

        <button
          onClick={onRemove}
          style={{
            background: "none",
            border: "none",
            color: COLORS.danger,
            padding: "2px",
            fontSize: "16px",
            borderRadius: "3px",
            cursor: "pointer",
            width: "30px", // Fixed width for alignment
            height: "30px", // Make it square
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
          title="Remove task"
        >
          ×
        </button>
      </div>
    </li>
  );
};

export default function ProjectTaskPanel({ projectTasks, setProjectTasks, currentStage, projectId, setProjectData }) {
  const [panelTitle, setPanelTitle] = useState("Project Tasks");
  const [showTaskFormModal, setShowTaskFormModal] = useState(false); // Renamed from showAddTaskModal
  const [currentSubtitleIndex, setCurrentSubtitleIndex] = useState(null); // Renamed from currentSubtitleIndexForTask
  const [editingSubtitleIndex, setEditingSubtitleIndex] = useState(null);
  const [editedSubtitleName, setEditedSubtitleName] = useState("");
  const [showTaskChatModal, setShowTaskChatModal] = useState(false); // Renamed from showChatModal
  const [currentChatTask, setCurrentChatTask] = useState(null); // Renamed from currentChatTaskId and currentChatMessages
  const [showAddSubtitleModal, setShowAddSubtitleModal] = useState(false);
  const [currentEditTask, setCurrentEditTask] = useState(null); // Fix: Added missing useState declaration
  const [collapsedSubtitles, setCollapsedSubtitles] = useState(new Set()); // Track which subtitles are collapsed

  const updateProjectTasksInFirestore = async (updatedTasks) => {
    if (projectId) {
      try {
        const projectRef = doc(db, "projects", projectId);
        await updateDoc(projectRef, { tasks: updatedTasks });
        // After updating Firestore, update the parent's projectData state
        setProjectData(prevProjectData => ({
          ...prevProjectData,
          tasks: updatedTasks
        }));
        console.log("Project tasks updated in Firestore!");
      } catch (error) {
        console.error("Error updating project tasks in Firestore: ", error);
      }
    }
  };

  const handleAddSubtitle = (subtitleName, selectedColor) => {
    const newSubtitle = {
      id: Date.now() + Math.random(), // Unique ID for subtitle
      name: subtitleName,
      color: selectedColor, // Use the selected color
      tasks: [],
      stage: currentStage, // Assign new subtitles to the current stage
    };
    const updatedTasks = [...projectTasks, newSubtitle];
    setProjectTasks(updatedTasks); // Update local state
    updateProjectTasksInFirestore(updatedTasks); // Update Firestore
    setShowAddSubtitleModal(false);
  };

  // Function to add a new task
  const handleAddTask = (taskData) => {
    if (currentSubtitleIndex === null) {
      console.error("Cannot add task: no subtitle selected.");
      return;
    }

    const newTask = {
      id: Date.now() + Math.random(), // Unique ID
      done: false,
      status: taskData.status || 'working on', // Default status
      ...taskData,
    };

    const updatedTasks = projectTasks.map((subtitle, sIdx) => {
      if (sIdx === currentSubtitleIndex) {
        return {
          ...subtitle,
          tasks: [...subtitle.tasks, newTask],
        };
      }
      return subtitle;
    });
    setProjectTasks(updatedTasks);
    updateProjectTasksInFirestore(updatedTasks);
    setShowTaskFormModal(false);
    setCurrentSubtitleIndex(null); // Reset after adding task
  };

  // Function to edit an existing task
  const handleEditTask = (taskToEdit) => { // Now directly receives the task object
    setCurrentEditTask(taskToEdit);
    // Find the subtitleIndex of the task being edited
    const subtitleIndex = projectTasks.findIndex(section => 
      section.tasks.some(t => t.id === taskToEdit.id)
    );
    setCurrentSubtitleIndex(subtitleIndex); // Set the subtitle index for context
    setShowTaskFormModal(true); // Open the TaskFormModal for editing
  };

  const handleSaveEditedTask = (updatedTaskData) => {
    if (currentEditTask && currentSubtitleIndex !== null) {
      const updatedTasks = projectTasks.map((subtitle, sIdx) => {
        if (sIdx === currentSubtitleIndex) { // Using currentSubtitleIndex now
          return {
            ...subtitle,
            tasks: subtitle.tasks.map(task =>
              task.id === updatedTaskData.id ? { ...task, ...updatedTaskData } : task
            ),
          };
        }
        return subtitle;
      });
      setProjectTasks(updatedTasks);
      updateProjectTasksInFirestore(updatedTasks);
      setShowTaskFormModal(false);
      setCurrentEditTask(null);
      setCurrentSubtitleIndex(null);
    }
  };

  // Toggle task done status
  const toggleTask = (subtitleIndex, taskId) => {
    if (projectTasks[subtitleIndex]) {
      const updatedTasks = projectTasks.map((subtitle, sIdx) => {
        if (sIdx === subtitleIndex) {
          return {
            ...subtitle,
            tasks: subtitle.tasks.map(task => {
              if (task.id === taskId) {
                console.log(`  MATCH! Toggling done for task ID ${task.id} from ${task.done} to ${!task.done}`); // Debugging
                return { ...task, done: !task.done, status: task.done ? 'working on' : 'complete' }; // Also update status
              }
              return task;
            }),
          };
        }
        return subtitle;
      });
      setProjectTasks(updatedTasks);
      updateProjectTasksInFirestore(updatedTasks);
    } else {
      console.warn("Subtitle not found for toggling task.", subtitleIndex);
    }
    console.log(`---------------------`); // Debugging
  };

  // Handle task status change
  const handleTaskStatusChange = (subtitleIndex, taskId, newStatus) => {
    const updatedTasks = projectTasks.map((subtitle, sIdx) => {
      if (sIdx === subtitleIndex) {
        return {
          ...subtitle,
          tasks: subtitle.tasks.map(task =>
            task.id === taskId ? { ...task, status: newStatus } : task
          ),
        };
      }
      return subtitle;
    });
    setProjectTasks(updatedTasks);
    updateProjectTasksInFirestore(updatedTasks);
  };

  const handleRemoveTask = (subtitleIndex, taskId) => {
    const updatedTasks = projectTasks.map((subtitle, sIdx) => {
      if (sIdx === subtitleIndex) {
        return {
          ...subtitle,
          tasks: subtitle.tasks.filter(task => task.id !== taskId),
        };
      }
      return subtitle;
    });
    setProjectTasks(updatedTasks);
    updateProjectTasksInFirestore(updatedTasks);
  };

  const handleRemoveSubtitle = (subtitleIndex) => {
    const updatedSections = projectTasks.filter((_, index) => index !== subtitleIndex);
    setProjectTasks(updatedSections);
    updateProjectTasksInFirestore(updatedSections);
  };

  const handleEditSubtitleDoubleClick = (index, currentName) => {
    setEditingSubtitleIndex(index);
    setEditedSubtitleName(currentName);
  };

  const handleSaveSubtitleEdit = (index) => {
    if (editedSubtitleName.trim()) {
      const updatedSections = [...projectTasks];
      updatedSections[index].name = editedSubtitleName.trim(); // Changed from .subtitle to .name
      setProjectTasks(updatedSections);
      updateProjectTasksInFirestore(updatedSections);
    }
    setEditingSubtitleIndex(null);
    setEditedSubtitleName("");
  };

  const handleSubtitleKeyPress = (e, index) => {
    if (e.key === 'Enter') {
      handleSaveSubtitleEdit(index);
    } else if (e.key === 'Escape') {
      setEditingSubtitleIndex(null);
      setEditedSubtitleName("");
    }
  };

  const handleShowChatModal = (subtitleIndex, taskId) => {
    const subtitle = projectTasks[subtitleIndex];
    if (subtitle) {
      const task = subtitle.tasks.find(t => t.id === taskId);
      if (task) {
        setCurrentChatTask(task); // Set the entire task object for chat
        setShowTaskChatModal(true);
      }
    }
  };

  const handleShowTaskFormModal = (subtitleIndex) => {
    setCurrentSubtitleIndex(subtitleIndex); // Set the subtitle index for the new task
    setCurrentEditTask(null); // Ensure we are adding, not editing
    setShowTaskFormModal(true); // Open the TaskFormModal
  };

  const toggleSubtitleCollapse = (subtitleIndex) => {
    setCollapsedSubtitles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subtitleIndex)) {
        newSet.delete(subtitleIndex);
      } else {
        newSet.add(subtitleIndex);
      }
      return newSet;
    });
  };

  return (
    <Card style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Panel Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: LAYOUT.gap,
        paddingBottom: LAYOUT.smallGap,
        borderBottom: `1px solid ${COLORS.lightBorder}`,
      }}>
        <h3 style={{ margin: 0, color: COLORS.text }}>Project Tasks</h3>
        <div style={{ display: "flex", gap: LAYOUT.smallGap }}>
          {/* Add Subtitle Button - Moved to Top Right */}
          <button 
            onClick={() => setShowAddSubtitleModal(true)} 
            style={{
              ...BUTTON_STYLES.primary,
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: "600",
              borderRadius: "25px",
              background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.secondary} 100%)`,
              boxShadow: "0 3px 12px rgba(52, 152, 219, 0.3)",
              transition: "all 0.3s ease",
              border: "none",
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = "0 5px 20px rgba(52, 152, 219, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "0 3px 12px rgba(52, 152, 219, 0.3)";
            }}
          >
            Add Subtitle
          </button>
        </div>
      </div>



      {/* Task List */}
      <div style={{ overflowY: "auto", flexGrow: 1 }}>
        {projectTasks.length === 0 ? (
          <p style={{ color: COLORS.lightText, textAlign: "center", marginTop: LAYOUT.gap }}>
            No tasks for this stage yet. Add a subtitle to get started!
          </p>
        ) : (
          projectTasks.map((subtitle, subtitleIndex) => (
            <div key={subtitle.id} style={{ marginBottom: LAYOUT.gap }}>
              <h4 style={{
                margin: `0 0 ${LAYOUT.smallGap} 0`,
                color: COLORS.white,
                background: `linear-gradient(135deg, ${subtitle.color || COLORS.darkCardBackground} 0%, ${subtitle.color || COLORS.secondary} 100%)`,
                padding: `${LAYOUT.smallGap} ${LAYOUT.gap}`,
                borderRadius: LAYOUT.borderRadius,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                fontSize: "16px",
                fontWeight: "600",
                letterSpacing: "0.5px",
              }}>
                {editingSubtitleIndex === subtitleIndex ? (
                  <input
                    type="text"
                    value={editedSubtitleName}
                    onChange={(e) => setEditedSubtitleName(e.target.value)}
                    onBlur={() => handleSaveSubtitleEdit(subtitleIndex)}
                    onKeyPress={(e) => handleSubtitleKeyPress(e, subtitleIndex)}
                    style={{
                      ...INPUT_STYLES.base,
                      flex: 1,
                      fontSize: "16px",
                      fontWeight: "bold",
                      border: "none",
                      background: "transparent",
                      color: COLORS.text,
                      padding: "0"
                    }}
                    autoFocus
                  />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", flexGrow: 1, gap: LAYOUT.smallGap }}>
                    <button
                      onClick={() => toggleSubtitleCollapse(subtitleIndex)}
                      style={{
                        background: "rgba(255, 255, 255, 0.2)",
                        border: "1px solid rgba(255, 255, 255, 0.3)",
                        color: COLORS.white,
                        width: "24px",
                        height: "24px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        transition: "all 0.2s ease",
                      }}
                      title={collapsedSubtitles.has(subtitleIndex) ? "Expand tasks" : "Collapse tasks"}
                    >
                      {collapsedSubtitles.has(subtitleIndex) ? "▶" : "▼"}
                    </button>
                  <span
                    onDoubleClick={() => handleEditSubtitleDoubleClick(subtitleIndex, subtitle.name)} // Use subtitle.name
                    style={{ cursor: "pointer", flexGrow: 1 }}
                  >
                    {subtitle.name}
                  </span>
                  </div>
                )}
                {/* Add Task Button - Inside each subtitle */}
                <div style={{ display: "flex", gap: LAYOUT.smallGap, alignItems: "center" }}>
                <button 
                  onClick={() => handleShowTaskFormModal(subtitleIndex)} 
                    style={{
                      ...BUTTON_STYLES.success,
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: "600",
                      borderRadius: "6px",
                      background: COLORS.success,
                      color: COLORS.white,
                      border: "none",
                      boxShadow: "0 2px 8px rgba(39, 174, 96, 0.3)",
                      transition: "all 0.3s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = "#229954";
                      e.target.style.transform = "translateY(-1px)";
                      e.target.style.boxShadow = "0 4px 12px rgba(39, 174, 96, 0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = COLORS.success;
                      e.target.style.transform = "translateY(0)";
                      e.target.style.boxShadow = "0 2px 8px rgba(39, 174, 96, 0.3)";
                    }}
                >
                  Add Task
                </button>
                <button
                  onClick={() => handleRemoveSubtitle(subtitleIndex)}
                  style={{
                      background: "rgba(231, 76, 60, 0.2)",
                      border: "1px solid rgba(255, 255, 255, 0.3)",
                      color: COLORS.white,
                      padding: "4px 8px",
                      fontSize: "14px",
                      borderRadius: "50%",
                    cursor: "pointer",
                      width: "28px",
                      height: "28px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.3s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = "rgba(231, 76, 60, 0.4)";
                      e.target.style.transform = "scale(1.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = "rgba(231, 76, 60, 0.2)";
                      e.target.style.transform = "scale(1)";
                  }}
                  title="Remove subtitle"
                >
                  ×
                </button>
                </div>
              </h4>
              
              {/* Column Headers and Task List - Only show if not collapsed */}
              {!collapsedSubtitles.has(subtitleIndex) && (
                <>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    fontWeight: "700",
                    padding: `${LAYOUT.smallGap}`,
                    marginBottom: LAYOUT.smallGap,
                    color: COLORS.dark,
                    fontSize: "13px",
                    backgroundColor: COLORS.light,
                    borderRadius: LAYOUT.smallBorderRadius,
                    gap: "8px",
                  }}>
                    <span style={{ width: "24px", flexShrink: 0, textAlign: "center" }}>✓</span>
                    <span style={{ flex: 1, textAlign: "left" }}>Task Name</span>
                    <span style={{ width: "70px", flexShrink: 0, textAlign: "left" }}>Assigned</span>
                    <span style={{ width: "80px", flexShrink: 0, textAlign: "left" }}>Priority</span>
                    <span style={{ width: "120px", flexShrink: 0, textAlign: "left" }}>Deadline</span>
                    <span style={{ width: "100px", flexShrink: 0, textAlign: "left" }}>Status</span>
                    <span style={{ width: "90px", flexShrink: 0, textAlign: "center" }}>Actions</span>
                  </div>
                  
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {subtitle.tasks.length === 0 ? (
                  <p style={{ color: COLORS.lightText, fontSize: "14px", marginLeft: LAYOUT.smallGap }}>
                    No tasks in this section yet.
                  </p>
                ) : (
                  subtitle.tasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={() => toggleTask(subtitleIndex, task.id)}
                      onRemove={() => handleRemoveTask(subtitleIndex, task.id)}
                      onShowComment={() => handleShowChatModal(subtitleIndex, task.id)}
                      onStatusChange={(taskId, newStatus) => handleTaskStatusChange(subtitleIndex, taskId, newStatus)}
                      onEdit={(taskToEdit) => handleEditTask(taskToEdit)} // Pass the task object
                    />
                  ))
                )}
              </ul>
                </>
              )}
              
              {/* Show task count when collapsed */}
              {collapsedSubtitles.has(subtitleIndex) && subtitle.tasks.length > 0 && (
                <div style={{
                  padding: LAYOUT.smallGap,
                  color: COLORS.lightText,
                  fontSize: "12px",
                  fontStyle: "italic",
                  textAlign: "center"
                }}>
                  {subtitle.tasks.length} task{subtitle.tasks.length !== 1 ? 's' : ''} hidden
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Task Form Modal for Add/Edit */}
      <TaskFormModal
        isOpen={showTaskFormModal}
        onClose={() => {
          setShowTaskFormModal(false);
          setCurrentEditTask(null);
          setCurrentSubtitleIndex(null);
        }}
        onSaveTask={currentEditTask ? handleSaveEditedTask : handleAddTask}
        initialTaskData={currentEditTask}
      />

      {/* Task Chat Modal */}
      <TaskChatModal
        isOpen={showTaskChatModal}
        onClose={() => setShowTaskChatModal(false)}
        task={currentChatTask}
        projectId={projectId} // Pass projectId here
      />

      {/* Add Subtitle Modal */}
      <AddSubtitleModal
        isOpen={showAddSubtitleModal}
        onClose={() => setShowAddSubtitleModal(false)}
        onAddSubtitle={handleAddSubtitle}
      />
    </Card>
  );
}
