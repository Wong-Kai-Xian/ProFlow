import React, { useState } from "react";
import Card from "./Card";
import { COLORS, INPUT_STYLES, BUTTON_STYLES } from "./constants";
import IncompleteStageModal from "./IncompleteStageModal"; // Import the new modal
import { FaEdit } from 'react-icons/fa'; // Import FaEdit

// Define the stages for progress tracking
const STAGES = ["Working", "Qualified", "Converted"];

export default function StatusPanel({
  stages,
  currentStage,
  setCurrentStage,
  stageData,
  setStageData,
  renderStageContent,
  setStages, // Receive setStages prop
  onStagesUpdate, // New prop to update stages in parent and database
  onConvertToProject // New prop to convert to project
}) {
  const [newNote, setNewNote] = useState("");
  const [editingStageIndex, setEditingStageIndex] = useState(null); // State for editing stage name
  const [newStageName, setNewStageName] = useState(""); // State for new stage name
  const [showIncompleteStageModal, setShowIncompleteStageModal] = useState(false); // State for modal visibility

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
      const updatedNotes = [...(stageData[currentStage]?.notes || []), newNote];
      setStageData({
        ...stageData,
        [currentStage]: {
          ...stageData[currentStage],
          notes: updatedNotes,
        },
      });
      setNewNote("");
    }
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
    const updatedStageData = {
      ...stageData,
      [currentStage]: {
        ...stageData[currentStage],
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
    const updatedStageData = {
      ...stageData,
      [currentStage]: {
        ...stageData[currentStage],
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

  const handleAddStage = () => {
    const newStage = `Stage ${stages.length + 1}`;
    setStages([...stages, newStage]);
    setCurrentStage(newStage);
    setStageData({
      ...stageData,
      [newStage]: {
        notes: [],
        tasks: [],
        completed: false
      },
    });
    onStagesUpdate([...stages, newStage], { // Pass updated stages and stageData to parent
      ...stageData,
      [newStage]: {
        notes: [],
        tasks: [],
        completed: false
      },
    });
  };

  const handleDeleteStage = () => {
    if (stages.length === 1) {
      // Prevent deleting the last stage
      // alert("Cannot delete the last stage.");
      return;
    }
    const currentIndex = stages.indexOf(currentStage);
    const updatedStages = stages.filter(stage => stage !== currentStage);
    const updatedStageData = { ...stageData };
    delete updatedStageData[currentStage];
    
    setStages(updatedStages);
    
    // Better logic for setting the new current stage
    let newCurrentStage;
    if (currentIndex === 0) {
      // If we deleted the first stage, move to the new first stage
      newCurrentStage = updatedStages[0];
    } else if (currentIndex >= updatedStages.length) {
      // If we deleted the last stage, move to the new last stage
      newCurrentStage = updatedStages[updatedStages.length - 1];
    } else {
      // Otherwise, stay at the same index position
      newCurrentStage = updatedStages[currentIndex - 1];
    }
    
    setCurrentStage(newCurrentStage);
    setStageData(updatedStageData);
    onStagesUpdate(updatedStages, updatedStageData); // Pass updated stages and stageData to parent
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
        <h3 style={{ margin: "0", color: COLORS.text }}>Stage</h3>
        <div>
          <button
            onClick={handleAddStage}
            style={{
              ...BUTTON_STYLES.primary,
              marginRight: "10px"
            }}
          >
            Add Stage
          </button>
          <button
            onClick={handleDeleteStage}
            style={{
              ...BUTTON_STYLES.primary,
              background: COLORS.danger,
            }}
          >
            Del Stage
          </button>
        </div>
      </div>
      
            {/* Stage Navigation */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-around", 
        marginBottom: "20px" 
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
              onDoubleClick={() => handleStageNameDoubleClick(index, stage)}
              style={{ 
                fontSize: "12px", 
                color: currentStage === stage ? COLORS.primary : COLORS.lightText,
                fontWeight: currentStage === stage ? "600" : "normal"
              }}
            >
              {editingStageIndex === index ? (
                <input
                  type="text"
                  value={newStageName}
                  onChange={handleStageNameChange}
                  onBlur={() => handleStageNameSave(index, stage)}
                  onKeyPress={(e) => handleStageNameKeyPress(e, index, stage)}
                  style={{
                    width: "100%",
                    padding: "2px 4px",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                    fontSize: "12px",
                    textAlign: "center"
                  }}
                  autoFocus
                />
              ) : (
                stage
              )}
            </span>
          </div>
        ))}
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
            <button
              onClick={handleMarkComplete}
              disabled={isPreviousStageIncomplete()} // Disable if previous stages are incomplete
              style={{
                ...BUTTON_STYLES.primary, // Apply primary button styles
                background: COLORS.success, // Green color for complete
                padding: "4px 8px", // Smaller padding for this button
                fontSize: "12px", // Smaller font size
              }}
            >
              Mark as Complete
            </button>
          )}
        </div>
        
        <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
          <input
            type="text"
            placeholder="Add a new note..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyPress={handleKeyPress}
            style={{ 
              ...INPUT_STYLES.base, // Apply base input styles
              flex: 1,
            }}
          />
          <button
            onClick={handleAddNote}
            style={{
              ...BUTTON_STYLES.primary, // Apply primary button styles
            }}
          >
            Add Note
          </button>
        </div>

        <ul style={{
          listStyle: "none",
          padding: 0,
          margin: 0
        }}>
          {stageData[currentStage]?.notes?.map((note, index) => (
            <li key={index} style={{
              padding: "8px",
              background: "#e9ecef",
              borderRadius: "6px",
              marginBottom: "6px",
              fontSize: "14px",
              color: COLORS.text,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between", // Ensures content and button are spaced
              gap: "8px" // Consistent gap
            }}>
              {note}
              <button 
                onClick={() => handleDeleteNote(index)}
                style={{
                  background: "none", // No background
                  border: "none", // No border
                  color: COLORS.danger, // Red color
                  padding: "2px", // Consistent padding
                  fontSize: "10px", // Consistent font size
                  borderRadius: "3px", // Consistent border radius
                  cursor: "pointer",
                  flexShrink: 0 // Prevent button from shrinking
                }}
              >
                X
              </button>
            </li>
          ))}
        </ul>

        {/* Custom Stage Content */}
        {renderStageContent && renderStageContent(currentStage, stageData, setStageData)}
      </div>
      <IncompleteStageModal 
        isOpen={showIncompleteStageModal} 
        onClose={() => setShowIncompleteStageModal(false)} 
      />
    </Card>
  );
}