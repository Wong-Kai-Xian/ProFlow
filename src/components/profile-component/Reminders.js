// src/components/profile-component/StatusPanel.js
import React from "react";

export default function StatusPanel({
  stages,
  currentStage,
  setCurrentStage,
  stageData,
  setStageData,
  renderStageContent, // new prop: function to render extra stage content
}) {
  return (
    <div
      style={{
        padding: "16px",
        borderRadius: "12px",
        background: "#fff",
        border: "1px solid #ddd",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      }}
    >
      <h3>Status</h3>
      <div style={{ display: "flex", justifyContent: "space-around", marginTop: "15px" }}>
        {stages.map((stage) => (
          <div
            key={stage}
            onClick={() => setCurrentStage(stage)}
            style={{ cursor: "pointer", textAlign: "center", flex: 1 }}
          >
            <div
              style={{
                width: "35px",
                height: "35px",
                borderRadius: "50%",
                margin: "0 auto",
                background: currentStage === stage ? "#3498DB" : "#ccc",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                color: "#fff",
                fontWeight: "bold",
              }}
            >
              {stages.indexOf(stage) + 1}
            </div>
            <span style={{ fontSize: "13px", marginTop: "6px", display: "block" }}>{stage}</span>
          </div>
        ))}
      </div>

      {/* Active Stage Panel */}
      <div
        style={{
          marginTop: "15px",
          padding: "10px",
          background: "#f9f9f9",
          borderRadius: "6px",
        }}
      >
        <h4 style={{ marginBottom: "8px" }}>{currentStage} Details</h4>

        {/* Notes */}
        <textarea
          rows="3"
          value={stageData[currentStage]?.notes || ""}
          onChange={(e) =>
            setStageData({
              ...stageData,
              [currentStage]: { ...stageData[currentStage], notes: e.target.value },
            })
          }
          style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
          placeholder={`Enter notes for ${currentStage}...`}
        />

        {/* Extra Stage Content */}
        {renderStageContent && renderStageContent(currentStage, stageData, setStageData)}
      </div>
    </div>
  );
}
