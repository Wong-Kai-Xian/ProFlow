// src/pages/CustomerProfile.js
import React, { useState } from "react";
import TopBar from "../components/TopBar";
import Card from "../components/profile-component/Card";
import StatusPanel from "../components/profile-component/StatusPanel";
import customerData from "../components/profile-component/customerData.json";

export default function CustomerProfile() {
  const [activities, setActivities] = useState(customerData.activities);
  const [newActivity, setNewActivity] = useState("");
  const [reminders, setReminders] = useState(customerData.reminders);
  const [newReminder, setNewReminder] = useState("");
  const [files] = useState(customerData.files);

  const stages = ["Working", "Qualified", "Converted"];
  const [currentStage, setCurrentStage] = useState("Working");
  const [stageData, setStageData] = useState({
    Working: { notes: "", tasks: [] },
    Qualified: { notes: "", tasks: [] },
    Converted: { notes: "", tasks: [] },
  });

  const handleAddActivity = () => {
    if (newActivity.trim()) {
      setActivities([...activities, `[${new Date().toLocaleString()}] ${newActivity}`]);
      setNewActivity("");
    }
  };

  const handleAddReminder = () => {
    if (newReminder.trim()) {
      setReminders([...reminders, `[${new Date().toLocaleTimeString()}] ${newReminder}`]);
      setNewReminder("");
    }
  };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", background: "#f4f6f8", minHeight: "100vh" }}>
      <TopBar />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: "20px", padding: "20px" }}>
        
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <Card>
            <h3>Customer Profile</h3>
            <p><strong>Name:</strong> {customerData.customerProfile.name}</p>
            <p><strong>Email:</strong> {customerData.customerProfile.email}</p>
            <p><strong>Phone:</strong> {customerData.customerProfile.phone}</p>
          </Card>

          <Card>
            <h3>Company Profile</h3>
            <p><strong>Company:</strong> {customerData.companyProfile.company}</p>
            <p><strong>Industry:</strong> {customerData.companyProfile.industry}</p>
            <p><strong>Location:</strong> {customerData.companyProfile.location}</p>
          </Card>

          <Card style={{ background: "#e8f0fe" }}>
            <h3>Company Reputation (AI-generated)</h3>
            <p>{"⭐".repeat(customerData.reputation.rating)}☆</p>
            <p>{customerData.reputation.summary}</p>
          </Card>
        </div>

        {/* Middle Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <StatusPanel
            stages={stages}
            currentStage={currentStage}
            setCurrentStage={setCurrentStage}
            stageData={stageData}
            setStageData={setStageData}
            renderStageContent={(stage, stageData, setStageData) => (
              <div style={{ marginTop: "10px" }}>
                <h5>Tasks</h5>
                <ul>
                  {(stageData[stage]?.tasks || []).map((task, i) => (
                    <li key={i}>
                      <input
                        type="checkbox"
                        checked={task.done}
                        onChange={() => {
                          const newTasks = [...stageData[stage].tasks];
                          newTasks[i].done = !newTasks[i].done;
                          setStageData({ ...stageData, [stage]: { ...stageData[stage], tasks: newTasks } });
                        }}
                      /> {task.name}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    const newTasks = [...(stageData[stage]?.tasks || []), { name: "New Task", done: false }];
                    setStageData({ ...stageData, [stage]: { ...stageData[stage], tasks: newTasks } });
                  }}
                  style={{
                    marginTop: "6px",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    background: "#3498DB",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  + Add Task
                </button>
              </div>
            )}
          />

          <Card style={{ minHeight: "300px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>Activity Record</h3>
              <button
                onClick={handleAddActivity}
                style={{ background: "#3498DB", color: "white", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer" }}
              >
                + Add
              </button>
            </div>
            <div style={{ marginTop: "10px", display: "flex", gap: "8px" }}>
              <input
                type="text"
                placeholder="New Activity"
                value={newActivity}
                onChange={(e) => setNewActivity(e.target.value)}
                style={{ flex: 1, padding: "6px", borderRadius: "6px", border: "1px solid #ccc" }}
              />
            </div>
            <ul style={{ marginTop: "15px", maxHeight: "200px", overflowY: "auto" }}>
              {activities.map((a, i) => (
                <li key={i} style={{ padding: "8px", background: "#f9f9f9", borderRadius: "6px", marginBottom: "6px" }}>
                  {a}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          {/* Reminder */}
          <Card style={{ minHeight: "180px" }}>
            <h3>Reminders</h3>
            <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
              <input
                type="text"
                placeholder="New Reminder"
                value={newReminder}
                onChange={(e) => setNewReminder(e.target.value)}
                style={{ flex: 1, padding: "6px", borderRadius: "6px", border: "1px solid #ccc" }}
              />
              <button
                onClick={handleAddReminder}
                style={{ padding: "6px 12px", borderRadius: "6px", background: "#3498DB", color: "white", border: "none" }}
              >
                Add
              </button>
            </div>
            <ul style={{ marginTop: "10px", maxHeight: "120px", overflowY: "auto" }}>
              {reminders.map((r, i) => (
                <li key={i} style={{ padding: "8px", background: "#f9f9f9", borderRadius: "6px", marginBottom: "6px" }}>
                  {r}
                </li>
              ))}
            </ul>
          </Card>

          {/* Attached Files */}
          <Card style={{ minHeight: "180px" }}>
            <h3>Attached Files</h3>
            <ul style={{ marginTop: "10px" }}>
              {files.map((file, i) => (
                <li key={i} style={{ padding: "8px", borderBottom: "1px solid #eee", fontSize: "14px" }}>
                  📎 {file}
                </li>
              ))}
            </ul>
          </Card>
        </div>

      </div>
    </div>
  );
}
