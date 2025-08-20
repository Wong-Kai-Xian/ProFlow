// src/components/profile-component/StatusPanel.js
import React from "react";
import Card from "./Card";

export default function StatusPanel({
  stages,
  currentStage,
  setCurrentStage,
  stageData,
  setStageData,
  renderStageContent,
}) {
  return (
    <Card>
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

      <div
        style={{
          marginTop: "15px",
          padding: "10px",
          background: "#f9f9f9",
          borderRadius: "6px",
        }}
      >
        <h4 style={{ marginBottom: "8px" }}>{currentStage} Notes</h4>
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

        {renderStageContent && renderStageContent(currentStage, stageData, setStageData)}
      </div>
    </Card>
  );
}
