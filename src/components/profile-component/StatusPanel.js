import React from "react";
import Card from "./Card";
import { COLORS, INPUT_STYLES } from "./constants";

export default function StatusPanel({
  stages,
  currentStage,
  setCurrentStage,
  stageData,
  setStageData,
  renderStageContent
}) {
  return (
    <Card>
      <h3 style={{ margin: "0 0 15px 0", color: COLORS.text }}>Status</h3>
      
      {/* Stage Navigation */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-around", 
        marginBottom: "20px" 
      }}>
        {stages.map((stage, index) => (
          <div
            key={stage}
            onClick={() => setCurrentStage(stage)}
            style={{ 
              cursor: "pointer", 
              textAlign: "center", 
              flex: 1,
              transition: "all 0.2s ease"
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                margin: "0 auto 8px",
                background: currentStage === stage ? COLORS.primary : COLORS.light,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                color: currentStage === stage ? "white" : COLORS.lightText,
                fontWeight: "bold",
                fontSize: "16px",
                boxShadow: currentStage === stage ? "0 2px 4px rgba(52, 152, 219, 0.3)" : "none"
              }}
            >
              {index + 1}
            </div>
            <span style={{ 
              fontSize: "12px", 
              color: currentStage === stage ? COLORS.primary : COLORS.lightText,
              fontWeight: currentStage === stage ? "600" : "normal"
            }}>
              {stage}
            </span>
          </div>
        ))}
      </div>

      {/* Active Stage Content */}
      <div style={{
        padding: "15px",
        background: "#f8f9fa",
        borderRadius: "8px",
        border: `1px solid ${COLORS.lightBorder}`
      }}>
        <h4 style={{ 
          margin: "0 0 12px 0", 
          color: COLORS.text,
          fontSize: "16px"
        }}>
          {currentStage} Notes
        </h4>
        
        <textarea
          rows="3"
          value={stageData[currentStage]?.notes || ""}
          onChange={(e) =>
            setStageData({
              ...stageData,
              [currentStage]: { 
                ...stageData[currentStage], 
                notes: e.target.value 
              },
            })
          }
          style={{
            ...INPUT_STYLES.textarea,
            width: "100%",
            boxSizing: "border-box"
          }}
          placeholder={`Enter notes for ${currentStage} stage...`}
        />

        {/* Custom Stage Content */}
        {renderStageContent && renderStageContent(currentStage, stageData, setStageData)}
      </div>
    </Card>
  );
}