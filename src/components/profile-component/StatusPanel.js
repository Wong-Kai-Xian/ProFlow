import React, { useState, useRef, useEffect } from "react";
import Card from "./Card";
import { COLORS, INPUT_STYLES, BUTTON_STYLES } from "./constants";
import IncompleteStageModal from "./IncompleteStageModal"; // Import the new modal

// Define the stages for progress tracking

export default function StatusPanel({
  stages,
  currentStage,
  setCurrentStage,
  stageData,
  setStageData,
  renderStageContent,
  setStages, // Receive setStages prop
  onStagesUpdate, // New prop to update stages in parent and database
  onConvertToProject, // New prop to convert to project
  onRequestApproval, // New prop to request approval for stage advancement
  customerId, // Customer ID for approval requests
  customerName // Customer name for approval requests
}) {
  const [newNote, setNewNote] = useState("");
  const [newNoteType, setNewNoteType] = useState("Other");
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingNoteIndex, setEditingNoteIndex] = useState(null);
  const [editingStageIndex, setEditingStageIndex] = useState(null); // State for editing stage name
  const [newStageName, setNewStageName] = useState(""); // State for new stage name
  const [showIncompleteStageModal, setShowIncompleteStageModal] = useState(false); // State for modal visibility
  const [isEditingStages, setIsEditingStages] = useState(false);
  const [workingStages, setWorkingStages] = useState([]);
  const [originalStagesSnapshot, setOriginalStagesSnapshot] = useState([]);
  const [showStageSelectModal, setShowStageSelectModal] = useState(false);
  const editRowRef = useRef(null);
  const [showDeleteStageConfirm, setShowDeleteStageConfirm] = useState(false);
  const [deleteStageIndex, setDeleteStageIndex] = useState(null);
  const [deleteStageName, setDeleteStageName] = useState("");

  useEffect(() => {
    if (isEditingStages && editRowRef.current) {
      editRowRef.current.scrollLeft = editRowRef.current.scrollWidth;
    }
  }, [workingStages.length, isEditingStages]);

  // Helper to check if all stages are completed
  // const areAllStagesCompleted = () => {
  //   return stages.every(stage => isStageCompleted(stage));
  // };

  // Helper to check if a stage is completed
  const isStageCompleted = (stageName) => stageData[stageName]?.completed;

  // Helper to check if any previous stage is incomplete
  const isPreviousStageIncomplete = () => {
    const currentIndex = stages.indexOf(currentStage);
    for (let i = 0; i < currentIndex; i++) {
      if (!isStageCompleted(stages[i])) {
        return true;
      }
    }
    return false;
  };

  // Helper to check if any subsequent stage is completed
  const isNextStageCompleted = () => {
    const currentIndex = stages.indexOf(currentStage);
    for (let i = currentIndex + 1; i < stages.length; i++) {
      if (isStageCompleted(stages[i])) {
        return true;
      }
    }
    return false;
  };

  const handleAddNote = () => {
    if (newNote.trim()) {
      const noteToAdd = { type: newNoteType, text: newNote.trim(), createdAt: Date.now() };
      const existingNotes = stageData[currentStage]?.notes || [];
      const updatedNotes = [...existingNotes, noteToAdd];
      setStageData({
        ...stageData,
        [currentStage]: {
          ...stageData[currentStage],
          notes: updatedNotes,
        },
      });
      setNewNote("");
      setNewNoteType("Other");
      setShowNoteModal(false);
      setEditingNoteIndex(null);
    }
  };

  const openNewNoteModal = () => {
    setEditingNoteIndex(null);
    setNewNote("");
    setNewNoteType("Other");
    setShowNoteModal(true);
  };

  const openEditNoteModal = (index, note) => {
    setEditingNoteIndex(index);
    if (typeof note === "string") {
      setNewNote(note);
      setNewNoteType("Other");
    } else {
      setNewNote(note.text || "");
      setNewNoteType(note.type || "Other");
    }
    setShowNoteModal(true);
  };

  const handleUpdateNote = () => {
    if (editingNoteIndex === null || newNote.trim() === "") {
      setShowNoteModal(false);
      return;
    }
    setStageData(prev => {
      const existingNotes = prev[currentStage]?.notes || [];
      const updated = [...existingNotes];
      updated[editingNoteIndex] = { type: newNoteType, text: newNote.trim(), createdAt: existingNotes[editingNoteIndex]?.createdAt || Date.now() };
      return {
        ...prev,
        [currentStage]: {
          ...prev[currentStage],
          notes: updated
        }
      };
    });
    setShowNoteModal(false);
    setEditingNoteIndex(null);
    setNewNote("");
    setNewNoteType("Other");
  };

  const handleDeleteNote = (indexToDelete) => {
    setStageData(prevStageData => {
      const updatedNotes = prevStageData[currentStage].notes.filter((_, index) => index !== indexToDelete);
      return {
        ...prevStageData,
        [currentStage]: {
          ...prevStageData[currentStage],
          notes: updatedNotes,
        },
      };
    });
  };

  const handleMarkComplete = () => {
    const baseCurrentStage = stageData[currentStage] || { notes: [], tasks: [], completed: false };
    const updatedStageData = {
      ...stageData,
      [currentStage]: {
        ...baseCurrentStage,
        completed: true,
      },
    };
    setStageData(updatedStageData);

    // Automatically advance to the next stage
    const currentIndex = stages.indexOf(currentStage);
    if (currentIndex !== -1 && currentIndex < stages.length - 1) {
      const nextStage = stages[currentIndex + 1];
      setCurrentStage(nextStage);
      onStagesUpdate(stages, updatedStageData, nextStage); // Pass updated stages, stageData, and the new currentStage
    } else {
      // If it's the last stage or no next stage, just update stageData
      onStagesUpdate(stages, updatedStageData, currentStage); // Ensure currentStage is passed for the last stage as well
    }
  };

  const handleUncomplete = () => {
    const baseCurrentStage = stageData[currentStage] || { notes: [], tasks: [], completed: false };
    const updatedStageData = {
      ...stageData,
      [currentStage]: {
        ...baseCurrentStage,
        completed: false,
      },
    };
    setStageData(updatedStageData);
    onStagesUpdate(stages, updatedStageData, currentStage);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleAddNote();
    }
  };

  const handleStageNameDoubleClick = (index, stage) => {
    if (!isEditingStages) return;
    setEditingStageIndex(index);
    setNewStageName(stage);
  };

  const handleStageNameChange = (e) => {
    setNewStageName(e.target.value);
  };

  const handleStageNameSave = (index, oldStageName) => {
    if (newStageName.trim()) {
      const newName = newStageName.trim();
      
      if (oldStageName && oldStageName !== newName) {
        // Create a new updatedStages array with the renamed stage
        const updatedStages = stages.map((stage, i) => 
          i === index ? newName : stage
        );

        // Update stageData: move content from oldStageName to newName
        const updatedStageData = { ...stageData };
        if (updatedStageData[oldStageName]) {
          updatedStageData[newName] = updatedStageData[oldStageName];
          delete updatedStageData[oldStageName];
        }
        
        // Update currentStage if it was the renamed stage
        if (currentStage === oldStageName) {
          setCurrentStage(newName);
        }
        
        // Set state in parent component (CustomerProfile.js)
        setStages(updatedStages);
        setStageData(updatedStageData);
        // Pass the new currentStage name if it was renamed
        const newCurrentStageIfRenamed = (currentStage === oldStageName) ? newName : currentStage;
        onStagesUpdate(updatedStages, updatedStageData, newCurrentStageIfRenamed);
      }
    }
    setEditingStageIndex(null);
    setNewStageName("");
  };

  const handleStageNameKeyPress = (e, index, stage) => {
    if (e.key === 'Enter') {
      handleStageNameSave(index, stage);
    }
  };

  const enterEditStages = () => {
    setOriginalStagesSnapshot(stages);
    setWorkingStages(stages);
    setIsEditingStages(true);
  };

  const cancelEditStages = () => {
    setIsEditingStages(false);
    setWorkingStages(stages);
    setEditingStageIndex(null);
    setNewStageName("");
  };

  const handleAddStageEditing = () => {
    const newStage = `Stage ${workingStages.length + 1}`;
    setWorkingStages([...workingStages, newStage]);
  };

  const handleDeleteStageAtEditing = (index) => {
    if (workingStages.length <= 1) return;
    const stageName = workingStages[index];
    const stageContent = stageData[stageName] || {};
    const hasContent = (Array.isArray(stageContent.tasks) && stageContent.tasks.length > 0) || (Array.isArray(stageContent.notes) && stageContent.notes.length > 0);
    if (hasContent) {
      setDeleteStageIndex(index);
      setDeleteStageName(stageName);
      setShowDeleteStageConfirm(true);
      return;
    }
    setWorkingStages(workingStages.filter((_, i) => i !== index));
  };

  const handleRenameStageAtEditing = (index, newName) => {
    if (!newName || !newName.trim()) return;
    const trimmed = newName.trim();
    const duplicate = workingStages.some((s, i) => i !== index && s === trimmed);
    if (duplicate) return;
    setWorkingStages(workingStages.map((s, i) => i === index ? trimmed : s));
  };

  const handleMoveStageLeftEditing = (index) => {
    if (index <= 0) return;
    const next = [...workingStages];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setWorkingStages(next);
  };

  const handleMoveStageRightEditing = (index) => {
    if (index >= workingStages.length - 1) return;
    const next = [...workingStages];
    [next[index + 1], next[index]] = [next[index], next[index + 1]];
    setWorkingStages(next);
  };

  const handleSaveStages = () => {
    const newStages = [...workingStages];
    // Build new stageData based on original indices to carry notes/tasks when renamed
    const newStageData = {};
    newStages.forEach((stageName, idx) => {
      const originalName = originalStagesSnapshot[idx];
      if (originalName && stageData[originalName]) {
        newStageData[stageName] = stageData[originalName];
      } else if (stageData[stageName]) {
        newStageData[stageName] = stageData[stageName];
    } else {
        newStageData[stageName] = { notes: [], tasks: [], completed: false };
      }
    });
    // Apply locally; parent persists via onStagesUpdate
    setStages(newStages);
    setStageData(newStageData);
    const defaultStage = newStages[0];
    setCurrentStage(defaultStage);
    setIsEditingStages(false);
    setShowStageSelectModal(true);
  };

  const handleStageClick = (stage, clickedIndex) => {
    const currentIndex = stages.indexOf(currentStage);

    if (clickedIndex < currentIndex) {
      // Allow navigating to previous stages
      setCurrentStage(stage);
    } else if (clickedIndex === currentIndex) {
      // Allow staying on the current stage
      setCurrentStage(stage);
    } else {
      // Trying to navigate to a future stage
      let canProceed = true;
      for (let i = currentIndex; i < clickedIndex; i++) {
        if (!stageData[stages[i]]?.completed) {
          canProceed = false;
          break;
        }
      }

      if (canProceed) {
        setCurrentStage(stage);
      } else {
        setShowIncompleteStageModal(true);
      }
    }
  };

  const isStageClickable = (index) => {
    const currentIndex = stages.indexOf(currentStage);

    if (index <= currentIndex) {
      return true; // Always clickable if it's the current or a previous stage
    }

    // For stages ahead of the current one, check if all intermediate stages are completed
    for (let i = currentIndex; i < index; i++) {
      if (!stageData[stages[i]]?.completed) {
        return false; // Cannot proceed if any intermediate stage is not completed
      }
    }
    return true; // All intermediate stages are completed, so this stage is clickable
  };

  return (
    <Card>
      <div style={{ width: "100%", maxWidth: "100%", minWidth: 0, overflowX: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
        <h3 style={{ margin: "0", color: COLORS.text }}>Stage</h3>
        <div>
          {!isEditingStages ? (
            <button
              onClick={enterEditStages}
              style={{
                ...BUTTON_STYLES.primary
              }}
            >
              Edit
            </button>
          ) : (
            <>
          <button
                onClick={cancelEditStages}
            style={{
                  ...BUTTON_STYLES.secondary,
              marginRight: "10px"
            }}
          >
                Cancel
          </button>
          <button
                onClick={handleSaveStages}
            style={{
                  ...BUTTON_STYLES.primary
            }}
          >
                Save
          </button>
            </>
          )}
        </div>
      </div>
      
            {/* Stage Navigation */}
      <div style={{ width: "100%", maxWidth: "100%", minWidth: 0, overflowX: "hidden" }}>
      {!isEditingStages ? (
      <div style={{ 
        display: "flex", 
        justifyContent: "space-around", 
          marginBottom: "20px",
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          overflowX: "hidden"
      }}>
        {stages.map((stage, index) => (
          <div
            key={stage}
            onClick={() => handleStageClick(stage, index)}
            style={{ 
              cursor: "pointer", 
              textAlign: "center", 
              flex: 1,
              transition: "all 0.2s ease",
              opacity: isStageClickable(index) ? 1 : 0.5
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                margin: "0 auto 8px",
                background: stageData[stage]?.completed ? COLORS.success : (currentStage === stage ? COLORS.primary : COLORS.light),
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                color: stageData[stage]?.completed ? "white" : (currentStage === stage ? "white" : COLORS.lightText),
                fontWeight: "bold",
                fontSize: "16px",
                boxShadow: currentStage === stage ? "0 2px 4px rgba(52, 152, 219, 0.3)" : "none"
              }}
            >
              {index + 1}
            </div>
            <span
              style={{ 
                fontSize: "12px", 
                color: currentStage === stage ? COLORS.primary : COLORS.lightText,
                fontWeight: currentStage === stage ? "600" : "normal"
              }}
            >
                {stage}
            </span>
          </div>
        ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px", width: "100%", maxWidth: "100%", minWidth: 0, overflowX: "hidden" }}>
          <div ref={editRowRef} style={{ display: "block", overflowX: "auto", whiteSpace: "nowrap", width: "100%", minWidth: 0, paddingBottom: "4px", overscrollBehaviorX: "contain" }}>
            {workingStages.map((stage, index) => (
              <div key={index} style={{ display: "inline-flex", alignItems: "center", gap: "6px", verticalAlign: "top" }}>
                <button onClick={() => handleMoveStageLeftEditing(index)} disabled={index === 0} style={{ ...BUTTON_STYLES.secondary, padding: "2px 6px", fontSize: "12px" }}>{"◀"}</button>
                <input
                  value={stage}
                  onChange={(e) => handleRenameStageAtEditing(index, e.target.value)}
                  style={{ border: "1px solid #e5e7eb", background: "#fff", textAlign: "center", width: 120, outline: "none", borderRadius: 4, padding: "2px 4px", fontSize: 12 }}
                />
                <button onClick={() => handleMoveStageRightEditing(index)} disabled={index === workingStages.length - 1} style={{ ...BUTTON_STYLES.secondary, padding: "2px 6px", fontSize: "12px" }}>{"▶"}</button>
                <button onClick={() => handleDeleteStageAtEditing(index)} style={{ ...BUTTON_STYLES.secondary, padding: "2px 6px", fontSize: "12px", color: "#b91c1c", background: "#fee2e2" }}>{"✕"}</button>
              </div>
            ))}
          </div>
          <div>
            <button onClick={handleAddStageEditing} style={{ ...BUTTON_STYLES.secondary }}>Add Stage</button>
          </div>
        </div>
      )}
      </div>

      {/* Active Stage Content */}
      <div style={{
        padding: "15px",
        background: "#f8f9fa",
        borderRadius: "8px",
        border: `1px solid ${COLORS.lightBorder}`,
        maxHeight: "350px", // Added to constrain height
        overflowY: "auto"   // Added for vertical scrolling
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <h4 style={{ 
            margin: "0", 
            color: COLORS.text,
            fontSize: "16px"
          }}>
            {currentStage} Notes
          </h4>
          {isStageCompleted(currentStage) ? (
            <button
              onClick={handleUncomplete} // Implement handleUncomplete
              disabled={isNextStageCompleted()} // Disable if subsequent stages are completed
              style={{
                ...BUTTON_STYLES.secondary,
                background: COLORS.warning, // Orange for uncomplete
                padding: "4px 8px",
                fontSize: "12px",
              }}
            >
              Uncomplete
            </button>
          ) : (
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleMarkComplete}
                style={{
                  ...BUTTON_STYLES.primary, // Apply primary button styles
                  background: COLORS.success, // Green color for complete
                  padding: "4px 8px", // Smaller padding for this button
                  fontSize: "12px", // Smaller font size
                }}
              >
                Mark as Complete
              </button>
              {onRequestApproval && (
                <button
                  onClick={() => onRequestApproval(currentStage, stages[stages.indexOf(currentStage) + 1])}
                  style={{
                    ...BUTTON_STYLES.secondary,
                    background: COLORS.primary, // Blue for approval request
                    color: "white",
                    padding: "4px 8px",
                    fontSize: "12px",
                  }}
                >
                  Request Approval
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* Stack Notes above Tasks */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "1fr", 
          gap: "20px", 
          marginTop: "16px" 
        }}>
          {/* Working Notes Section */}
          <div style={{
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            padding: "16px",
            backgroundColor: "#f8f9fa"
          }}>
            <h4 style={{ 
              margin: "0 0 12px 0", 
              color: COLORS.dark, 
              fontSize: "16px", 
              fontWeight: "600",
              borderBottom: "2px solid #3498db",
              paddingBottom: "8px"
            }}>
              Notes
            </h4>
            
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <button
                onClick={openNewNoteModal}
                style={{
                  ...BUTTON_STYLES.primary,
                  padding: "8px 12px",
                  fontSize: "12px"
                }}
              >
                Add Note
              </button>
            </div>

            <div style={{ 
              maxHeight: "400px", 
              overflowY: "auto" 
            }}>
              {stageData[currentStage]?.notes?.length === 0 ? (
                <p style={{ 
                  color: COLORS.lightText, 
                  fontSize: "14px", 
                  fontStyle: "italic",
                  textAlign: "center",
                  margin: "20px 0"
                }}>
                  No notes yet. Add one to get started!
                </p>
              ) : (
                <ul style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0
                }}>
                  {stageData[currentStage]?.notes?.map((note, index) => (
                    <li key={index} onClick={() => openEditNoteModal(index, note)} style={{
                      padding: "8px",
                      background: "#ffffff",
                      borderRadius: "6px",
                      marginBottom: "6px",
                      fontSize: "14px",
                      color: COLORS.text,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                      border: "1px solid #e2e8f0",
                      cursor: "pointer"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
                        {typeof note === "string" ? (
                          <>
                            <span style={{
                              display: "inline-block",
                              fontSize: "11px",
                              background: "#EEF2FF",
                              color: COLORS.primary,
                              padding: "2px 6px",
                              borderRadius: "10px",
                              whiteSpace: "nowrap"
                            }}>Other</span>
                            <span style={{
                              display: "inline-block",
                              fontSize: "11px",
                              background: "#F3F4F6",
                              color: "#374151",
                              padding: "2px 6px",
                              borderRadius: "10px",
                              whiteSpace: "nowrap"
                            }}>{currentStage}</span>
                            <span style={{ 
                              flex: 1, 
                              minWidth: 0,
                              overflow: "hidden", 
                              display: "-webkit-box", 
                              WebkitBoxOrient: "vertical", 
                              WebkitLineClamp: 2,
                              wordBreak: "break-word"
                            }}>{note}</span>
                          </>
                        ) : (
                          <>
                            <span style={{
                              display: "inline-block",
                              fontSize: "11px",
                              background: note.type === "Email" ? "#E6FFFA" : note.type === "Phone Call" ? "#FFF5F5" : note.type === "Meeting" ? "#F0FFF4" : "#EEF2FF",
                              color: note.type === "Email" ? "#0D9488" : note.type === "Phone Call" ? "#B91C1C" : note.type === "Meeting" ? "#15803D" : COLORS.primary,
                              padding: "2px 6px",
                              borderRadius: "10px",
                              whiteSpace: "nowrap"
                            }}>{note.type || "Other"}</span>
                            <span style={{
                              display: "inline-block",
                              fontSize: "11px",
                              background: "#F3F4F6",
                              color: "#374151",
                              padding: "2px 6px",
                              borderRadius: "10px",
                              whiteSpace: "nowrap"
                            }}>{currentStage}</span>
                            <span style={{ 
                              flex: 1,
                              minWidth: 0, 
                              overflow: "hidden", 
                              display: "-webkit-box", 
                              WebkitBoxOrient: "vertical", 
                              WebkitLineClamp: 2,
                              wordBreak: "break-word"
                            }}>{note.text}</span>
                          </>
                        )}
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); openEditNoteModal(index, note); }}
                        style={{
                          background: "none",
                          border: "none",
                          color: COLORS.primary,
                          padding: "2px",
                          fontSize: "12px",
                          borderRadius: "3px",
                          cursor: "pointer",
                          flexShrink: 0
                        }}
                        title="View / Edit"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteNote(index); }}
                        style={{
                          background: "none",
                          border: "none",
                          color: COLORS.danger,
                          padding: "2px",
                          fontSize: "12px",
                          borderRadius: "3px",
                          cursor: "pointer",
                          flexShrink: 0
                        }}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {showNoteModal && (
              <div style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000
              }}>
                <div style={{
                  background: "white",
                  borderRadius: "8px",
                  padding: "16px",
                  width: "90%",
                  maxWidth: "600px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.15)"
                }}>
                  <h4 style={{ margin: 0, color: COLORS.dark, fontSize: "16px", marginBottom: "8px" }}>{editingNoteIndex === null ? "Add Note" : "Edit Note"}</h4>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                    <select
                      value={newNoteType}
                      onChange={(e) => setNewNoteType(e.target.value)}
                      style={{ ...INPUT_STYLES.base, width: "180px", fontSize: "14px" }}
                    >
                      <option value="Email">Email</option>
                      <option value="Phone Call">Phone Call</option>
                      <option value="Meeting">Meeting</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Type your note here..."
                    style={{
                      ...INPUT_STYLES.textarea,
                      width: "100%",
                      minHeight: "160px",
                      maxHeight: "50vh",
                      fontSize: "14px",
                      boxSizing: "border-box",
                      wordBreak: "break-word"
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
                    <button onClick={() => { setShowNoteModal(false); setEditingNoteIndex(null); }} style={{ ...BUTTON_STYLES.secondary }}>Cancel</button>
                    {editingNoteIndex === null ? (
                      <button onClick={handleAddNote} style={{ ...BUTTON_STYLES.primary }}>Add</button>
                    ) : (
                      <button onClick={handleUpdateNote} style={{ ...BUTTON_STYLES.primary }}>Save</button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tasks Section */}
          <div style={{
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            padding: "16px",
            backgroundColor: "#f8f9fa"
          }}>
            <h4 style={{ 
              margin: "0 0 12px 0", 
              color: COLORS.dark, 
              fontSize: "16px", 
              fontWeight: "600",
              borderBottom: "2px solid #2ecc71",
              paddingBottom: "8px"
            }}>
              Tasks
            </h4>
            
            {/* Custom Stage Content - Tasks */}
            <div style={{ marginTop: "0" }}>
              {renderStageContent && renderStageContent(currentStage, stageData, setStageData)}
            </div>
          </div>
        </div>
      </div>
      <IncompleteStageModal 
        isOpen={showIncompleteStageModal} 
        onClose={() => setShowIncompleteStageModal(false)} 
      />
      {showStageSelectModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 20, minWidth: 300, boxShadow: "0 10px 25px rgba(0,0,0,0.15)" }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>Select current stage</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto" }}>
              {workingStages.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setCurrentStage(s);
                    onStagesUpdate(workingStages, stageData, s);
                    setShowStageSelectModal(false);
                  }}
                  style={{ textAlign: "left", padding: "8px 10px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#f9fafb", cursor: "pointer" }}
                >{s}</button>
              ))}
            </div>
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <button onClick={() => setShowStageSelectModal(false)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}
      {showDeleteStageConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 20, minWidth: 320, maxWidth: 420, boxShadow: "0 10px 25px rgba(0,0,0,0.15)" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Delete stage "{deleteStageName}"?</div>
            <div style={{ color: '#374151', lineHeight: 1.4, marginBottom: 12 }}>This stage has content. Deleting will remove its tasks/notes. This action cannot be undone.</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => { setShowDeleteStageConfirm(false); setDeleteStageIndex(null); setDeleteStageName(""); }} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => {
                if (deleteStageIndex !== null) {
                  setWorkingStages(workingStages.filter((_, i) => i !== deleteStageIndex));
                }
                setShowDeleteStageConfirm(false);
                setDeleteStageIndex(null);
                setDeleteStageName("");
              }} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ef4444', background: '#fee2e2', color: '#b91c1c', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </Card>
  );
}