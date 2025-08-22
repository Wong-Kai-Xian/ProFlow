import React, { useState } from "react";
import Card from "./Card";
import { COLORS, INPUT_STYLES, BUTTON_STYLES } from "./constants";
import IncompleteStageModal from "./IncompleteStageModal"; // Import the new modal
import { FaEdit } from 'react-icons/fa'; // Import FaEdit

export default function StatusPanel({
  stages,
  currentStage,
  setCurrentStage,
  stageData,
  setStageData,
  renderStageContent,
  setStages // Receive setStages prop
}) {
  const [newNote, setNewNote] = useState("");
  const [editingStageIndex, setEditingStageIndex] = useState(null); // New state for editing index
  const [newStageName, setNewStageName] = useState(""); // New state for new stage name
  const [showIncompleteStageModal, setShowIncompleteStageModal] = useState(false); // State for modal visibility

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
    setStageData(prevStageData => ({
      ...prevStageData,
      [currentStage]: {
        ...prevStageData[currentStage],
        completed: true,
      },
    }));
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

  const handleStageNameSave = (index) => {
    if (newStageName.trim()) {
      const updatedStages = [...stages];
      updatedStages[index] = newStageName;
      setStages(updatedStages);
    }
    setEditingStageIndex(null);
    setNewStageName("");
  };

  const handleStageNameKeyPress = (e, index) => {
    if (e.key === 'Enter') {
      handleStageNameSave(index);
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
        tasks: [] // Initialize tasks for new stage
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
    const updatedStageData = { ...stageData }; // Copy existing stageData
    delete updatedStageData[currentStage]; // Delete data for the current stage
    
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
    setStageData(updatedStageData); // Update stageData with the deleted stage removed
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
        // alert("Please complete the current and all preceding stages before proceeding to this stage.");
        setShowIncompleteStageModal(true); // Show the modal instead of alert
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
        <h3 style={{ margin: "0", color: COLORS.text }}>Status</h3>
        <div>
          <button
            onClick={handleAddStage}
            style={{
              ...BUTTON_STYLES.primary, // Apply primary button styles
              marginRight: "10px" // Added margin-right
            }}
          >
            Add Stage
          </button>
          <button
            onClick={handleDeleteStage}
            style={{
              ...BUTTON_STYLES.primary, // Apply primary button styles
              background: COLORS.danger, // Red color for delete
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
              opacity: isStageClickable(index) ? 1 : 0.5 // Dim if not clickable
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
                  onBlur={() => handleStageNameSave(index)}
                  onKeyPress={(e) => handleStageNameKeyPress(e, index)}
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
          {stageData[currentStage]?.completed ? (
            <span style={{ color: COLORS.success, fontWeight: "bold" }}>COMPLETED</span>
          ) : (
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