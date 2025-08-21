import React from 'react';
import { COLORS, LAYOUT, BUTTON_STYLES } from '../profile-component/constants';

export default function StageIndicator({ currentStage, allStages, onAdvanceStage, onGoBackStage, isCurrentStageTasksComplete, onStageSelect }) {
  const currentStageIndex = allStages.indexOf(currentStage);
  const isLastStage = currentStageIndex === allStages.length - 1;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column", // Stack content vertically
      alignItems: "center", // Center horizontally
      background: COLORS.cardBackground,
      padding: LAYOUT.gap,
      borderRadius: LAYOUT.borderRadius,
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      marginBottom: LAYOUT.gap,
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        width: "100%",
        marginBottom: LAYOUT.smallGap, // Space between indicators and button
      }}>
        {allStages.map((stage, index) => {
          const isActive = stage === currentStage;
          const isCompleted = allStages.indexOf(currentStage) > index;

          const circleStyle = {
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: isCompleted ? COLORS.success : (isActive ? COLORS.primary : COLORS.lightBorder),
            color: isCompleted || isActive ? COLORS.white : COLORS.text,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontWeight: "bold",
            fontSize: "14px",
            border: `2px solid ${isActive ? COLORS.primary : COLORS.border}`,
            transition: "all 0.3s ease-in-out",
            position: "relative",
            zIndex: 1,
            cursor: (isCompleted || isActive) ? "pointer" : "default", // Clickable if completed or active
          };

          const labelStyle = {
            marginTop: LAYOUT.smallGap,
            fontSize: "12px",
            color: isActive ? COLORS.primary : COLORS.text,
            fontWeight: isActive ? "bold" : "normal",
            textAlign: "center",
          };

          const lineStyle = {
            flex: 1,
            height: "2px",
            background: isCompleted ? COLORS.success : COLORS.border,
            margin: "0 -10px",
            zIndex: 0,
          };

          return (
            <React.Fragment key={stage}>
              {index > 0 && <div style={lineStyle}></div>}
              <div 
                style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
                onClick={() => { if (isCompleted || isActive) onStageSelect(stage); }}
              >
                <div style={circleStyle}>
                  {index + 1}
                </div>
                <div style={labelStyle}>
                  {stage}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      
      {!isLastStage && ( // Only show button if not on the last stage
        <button 
          onClick={onAdvanceStage}
          style={{
            ...BUTTON_STYLES.primary,
            width: "100%",
            marginTop: LAYOUT.smallGap, // Space above button
            opacity: isCurrentStageTasksComplete ? 1 : 0.5,
            cursor: isCurrentStageTasksComplete ? "pointer" : "not-allowed"
          }}
          disabled={!isCurrentStageTasksComplete} // Disable button if not all tasks are complete
        >
          Get Approval & Advance Stage
        </button>
      )}
    </div>
  );
}
