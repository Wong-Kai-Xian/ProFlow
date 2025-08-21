import React, { useState, useEffect } from "react";
import { COLORS, BUTTON_STYLES, INPUT_STYLES, LAYOUT } from "../profile-component/constants";

export default function SendApprovalModal({
  isOpen,
  onClose,
  onSendApproval,
  defaultProject = null,
  defaultStatus = "",
}) {
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const [selectedAdmin, setSelectedAdmin] = useState("all"); // New state for admin selection
  const [showConfirmationModal, setShowConfirmationModal] = useState(false); // New state for confirmation modal

  // Mock list of admins
  const admins = [
    { id: "all", name: "Everyone" },
    { id: "admin1", name: "Admin One" },
    { id: "admin2", name: "Admin Two" },
  ];

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = () => {
    if (!message.trim() && !file) {
      alert("Please enter a message or upload a file.");
      return;
    }

    onSendApproval({
      projectId: defaultProject ? defaultProject.id : null,
      status: defaultStatus,
      message: message.trim(),
      file: file,
      toAdmin: selectedAdmin, // Include selected admin
    });
    setMessage("");
    setFile(null);
    setSelectedAdmin("all"); // Reset selected admin
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
        padding: "30px", // Increased padding
        borderRadius: LAYOUT.borderRadius,
        width: "95%", // Slightly increased width percentage
        maxWidth: "800px", // Keep max width the same for now
        maxHeight: "95vh", // Increased max height to give more vertical space
        overflowY: "auto", // Ensure scrolling is still available if content overflows
        boxShadow: "0 8px 30px rgba(0, 0, 0, 0.2)",
        display: "flex",
        flexDirection: "column",
        gap: "20px", // Increased gap between elements
      }}>
        <h2 style={{ margin: 0, color: COLORS.dark, fontSize: "22px", marginBottom: "15px" }}>Send Approval</h2> {/* Increased marginBottom */}
        
        {/* Admin selection dropdown */}
        <div style={{ marginBottom: "15px" }}> {/* Added marginBottom */}
          <label style={{ ...INPUT_STYLES.label, marginBottom: "10px", fontSize: "15px" }}>Send to Admin:</label> {/* Increased font size and margin */}
          <select
            value={selectedAdmin}
            onChange={(e) => setSelectedAdmin(e.target.value)}
            style={{
              ...INPUT_STYLES.base,
              width: "100%",
              padding: "12px", // Increased padding
              fontSize: "15px", // Increased font size
            }}
          >
            {admins.map(admin => (
              <option key={admin.id} value={admin.id}>{admin.name}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: "20px" }}> {/* Added marginBottom */}
          <label style={{ ...INPUT_STYLES.label, marginBottom: "10px", fontSize: "15px" }}>Message:</label> {/* Increased font size and margin */}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter your approval message..."
            rows="7" // Increased rows for more visible text area
            style={{
              ...INPUT_STYLES.base,
              width: "100%",
              resize: "vertical",
              minHeight: "120px", // Ensure a minimum height
              padding: "12px", // Increased padding
              fontSize: "15px",
            }}
          />
        </div>

        <div style={{ marginBottom: "10px" }}> {/* Added marginBottom for consistency */}
          <label style={{ ...INPUT_STYLES.label, marginBottom: "10px", fontSize: "15px" }}>Upload File:</label> {/* Increased font size and margin */}
          <input
            type="file"
            onChange={handleFileChange}
            style={{
              ...INPUT_STYLES.base,
              width: "100%",
              padding: "12px", // Increased padding
              border: `1px solid ${COLORS.border}`,
              fontSize: "15px",
            }}
          />
        </div>

        {/* Moved Send Approval and Cancel buttons to the bottom */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "15px", marginTop: "20px" }}> {/* Adjusted margin */}
          <button
            onClick={onClose}
            style={{ ...BUTTON_STYLES.secondary, padding: "12px 25px", fontSize: "15px" }}
          >
            Cancel
          </button>
          <button
            onClick={() => setShowConfirmationModal(true)} // Open confirmation modal
            style={{ ...BUTTON_STYLES.primary, padding: "12px 25px", fontSize: "15px" }}
          >
            Send Approval
          </button>
        </div>

        {/* Confirmation Modal */}
        {showConfirmationModal && (
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
            zIndex: 1001, // Higher z-index than main modal
          }}>
            <div style={{
              backgroundColor: COLORS.white,
              padding: "30px",
              borderRadius: LAYOUT.borderRadius,
              width: "90%",
              maxWidth: "400px",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              textAlign: "center",
            }}>
              <h3 style={{ margin: 0, color: COLORS.dark }}>Confirm Send Approval</h3>
              <p style={{ margin: 0, color: COLORS.text }}>Are you sure you want to send this approval?</p>
              <div style={{ display: "flex", justifyContent: "center", gap: "15px", marginTop: "10px" }}>
                <button
                  onClick={() => setShowConfirmationModal(false)}
                  style={{ ...BUTTON_STYLES.secondary, padding: "10px 20px", fontSize: "14px" }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => { handleSubmit(); setShowConfirmationModal(false); }} // Proceed with submission
                  style={{ ...BUTTON_STYLES.primary, padding: "10px 20px", fontSize: "14px" }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
