import React, { useState, useEffect } from "react";
import { COLORS, BUTTON_STYLES, INPUT_STYLES, LAYOUT } from "../profile-component/constants";

export default function SendApprovalModal({
  isOpen,
  onClose,
  onSendApproval,
  defaultProject = null,
  defaultStatus = "",
  allProjects = [] // For CustomerProfile to select from all available projects
}) {
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const [selectedProject, setSelectedProject] = useState(defaultProject ? defaultProject.id : '');
  const [selectedStatus, setSelectedStatus] = useState(defaultStatus);

  useEffect(() => {
    if (defaultProject) {
      setSelectedProject(defaultProject.id);
    }
    if (defaultStatus) {
      setSelectedStatus(defaultStatus);
    }
  }, [defaultProject, defaultStatus]);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = () => {
    if (!message.trim() && !file) {
      alert("Please enter a message or upload a file.");
      return;
    }
    if (!selectedProject || !selectedStatus) {
      alert("Please select a project and status.");
      return;
    }

    onSendApproval({
      projectId: selectedProject,
      status: selectedStatus,
      message: message.trim(),
      file: file,
    });
    setMessage("");
    setFile(null);
    setSelectedProject(defaultProject ? defaultProject.id : '');
    setSelectedStatus(defaultStatus);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: COLORS.white,
        padding: LAYOUT.padding,
        borderRadius: LAYOUT.borderRadius,
        width: "90%",
        maxWidth: "500px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        display: "flex",
        flexDirection: "column",
        gap: LAYOUT.gap,
      }}>
        <h2 style={{ margin: 0, color: COLORS.dark }}>Send Approval</h2>
        
        <div>
          <label style={{ ...INPUT_STYLES.label, marginBottom: "5px" }}>Message:</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter your approval message..."
            rows="4"
            style={{
              ...INPUT_STYLES.base,
              width: "100%",
              resize: "vertical",
            }}
          />
        </div>

        <div>
          <label style={{ ...INPUT_STYLES.label, marginBottom: "5px" }}>Upload File:</label>
          <input
            type="file"
            onChange={handleFileChange}
            style={{
              ...INPUT_STYLES.base,
              padding: "10px",
              border: `1px solid ${COLORS.border}`,
            }}
          />
        </div>

        {allProjects.length > 0 && (
          <div>
            <label style={{ ...INPUT_STYLES.label, marginBottom: "5px" }}>Select Project:</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              style={{
                ...INPUT_STYLES.base,
                width: "100%",
              }}
            >
              <option value="">Select a project</option>
              {allProjects.map(proj => (
                <option key={proj.id} value={proj.id}>{proj.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label style={{ ...INPUT_STYLES.label, marginBottom: "5px" }}>Select Status:</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{
              ...INPUT_STYLES.base,
              width: "100%",
            }}
          >
            <option value="">Select a status</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Pending">Pending</option>
          </select>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: LAYOUT.smallGap, marginTop: LAYOUT.gap }}>
          <button
            onClick={onClose}
            style={{ ...BUTTON_STYLES.secondary, padding: "10px 20px" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{ ...BUTTON_STYLES.primary, padding: "10px 20px" }}
          >
            Send Approval
          </button>
        </div>
      </div>
    </div>
  );
}
