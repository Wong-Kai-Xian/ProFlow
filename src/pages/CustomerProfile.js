// src/pages/CustomerProfile.js
import React, { useState } from "react";
import TopBar from "../components/TopBar";

export default function CustomerProfile() {
  const [notes, setNotes] = useState("");
  const [reminders, setReminders] = useState([]);
  const [newReminder, setNewReminder] = useState("");
  const [files, setFiles] = useState(["Contract.pdf", "Invoice.xlsx"]);

  const handleAddReminder = () => {
    if (newReminder.trim()) {
      setReminders([...reminders, newReminder]);
      setNewReminder("");
    }
  };

  return (
    <div style={{ fontFamily: "Arial, sans-serif" }}>
      <TopBar />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr 1fr",
          gridTemplateRows: "auto 1fr",
          gap: "20px",
          padding: "10px",
          minHeight: "90vh",
        }}
      >
        {/* Left: Customer + Company Profile + AI Reputation */}
        <div style={{ gridColumn: 1, gridRow: "1 / span 2", display: "flex", flexDirection: "column", gap: "15px" }}>
          <div style={{ padding: "10px", border: "1px solid #ccc", borderRadius: "8px" }}>
            <h3>Customer Profile</h3>
            <p>Name: John Doe</p>
            <p>Email: john@example.com</p>
            <p>Phone: +60123456789</p>
          </div>

          <div style={{ padding: "10px", border: "1px solid #ccc", borderRadius: "8px" }}>
            <h3>Company Profile</h3>
            <p>Company: Acme Corp</p>
            <p>Industry: Tech</p>
            <p>Location: Kuala Lumpur</p>
          </div>

          <div style={{ padding: "10px", border: "1px solid #ccc", borderRadius: "8px", background: "#f9f9f9" }}>
            <h3>Company Reputation (AI-generated)</h3>
            <p>⭐⭐⭐⭐☆</p>
            <p>Reliable company with consistent performance...</p>
          </div>
        </div>

        {/* Middle Top: Status */}
        <div style={{ gridColumn: 2, gridRow: 1, padding: "10px", border: "1px solid #ccc", borderRadius: "8px" }}>
          <h3>Status</h3>
          <ul>
            <li>Lead not converted</li>
            <li>Appointment pending</li>
            <li>Follow-up email scheduled</li>
          </ul>
        </div>

        {/* Middle Bottom: Activity Record */}
        <div style={{ gridColumn: 2, gridRow: 2, padding: "10px", border: "1px solid #ccc", borderRadius: "8px" }}>
          <h3>Activity Record</h3>
          <textarea
            placeholder="Add notes from email/phone call..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ width: "100%", height: "120px", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
          />
        </div>

        {/* Upper Right: Reminders */}
        <div style={{ gridColumn: 3, gridRow: 1, padding: "10px", border: "1px solid #ccc", borderRadius: "8px" }}>
          <h3>Reminders</h3>
          <input
            type="text"
            placeholder="New Reminder"
            value={newReminder}
            onChange={(e) => setNewReminder(e.target.value)}
            style={{ width: "100%", padding: "6px", marginBottom: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
          />
          <button onClick={handleAddReminder} style={{ padding: "6px 12px", borderRadius: "6px", background: "#3498DB", color: "white" }}>
            Add
          </button>
          <ul style={{ marginTop: "10px" }}>
            {reminders.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>

        {/* Bottom Right: Attached Files */}
        <div style={{ gridColumn: 3, gridRow: 2, padding: "10px", border: "1px solid #ccc", borderRadius: "8px", background: "#f9f9f9" }}>
          <h3>Attached Files</h3>
          <ul>
            {files.map((file, i) => <li key={i}>{file}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
