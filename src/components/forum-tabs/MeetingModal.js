import React, { useState } from "react";

export default function MeetingModal({ isOpen, onClose, onSave }) {
  const [meetingType, setMeetingType] = useState("Google Meet");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("1 hour");
  const [description, setDescription] = useState("");

  // Initialize with current time + 2 hours
  React.useEffect(() => {
    if (isOpen && !date && !time) {
      const now = new Date();
      now.setHours(now.getHours() + 2);
      
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().slice(0, 5);
      
      setDate(dateStr);
      setTime(timeStr);
    }
  }, [isOpen, date, time]);

  const handleSave = () => {
    if (date && time) {
      const meetingData = {
        type: meetingType,
        date,
        time,
        duration,
        description: description.trim(),
        fullDateTime: `${formatDate(date)}, ${time}`
      };
      onSave(meetingData);
      resetForm();
      onClose();
    }
  };

  const resetForm = () => {
    setMeetingType("Google Meet");
    setDate("");
    setTime("");
    setDuration("1 hour");
    setDescription("");
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    return date.toLocaleDateString('en-GB', options);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
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
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10000
    }}>
      <div style={{
        backgroundColor: "white",
        borderRadius: "10px",
        padding: "20px",
        width: "90%",
        maxWidth: "500px",
        maxHeight: "90vh",
        overflowY: "auto",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)"
      }}>
        <h3 style={{ 
          margin: "0 0 20px 0", 
          color: "#2C3E50",
          fontSize: "18px"
        }}>
          Schedule Meeting
        </h3>
        
        {/* Meeting Type */}
        <div style={{ marginBottom: "15px" }}>
          <label style={{
            display: "block",
            marginBottom: "8px",
            fontSize: "14px",
            fontWeight: "500",
            color: "#2C3E50"
          }}>
            Meeting Type
          </label>
          <div style={{ display: "flex", gap: "10px" }}>
            <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
              <input
                type="radio"
                value="Google Meet"
                checked={meetingType === "Google Meet"}
                onChange={(e) => setMeetingType(e.target.value)}
                style={{ marginRight: "6px" }}
              />
              <span style={{ fontSize: "14px" }}>Google Meet</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
              <input
                type="radio"
                value="Others"
                checked={meetingType === "Others"}
                onChange={(e) => setMeetingType(e.target.value)}
                style={{ marginRight: "6px" }}
              />
              <span style={{ fontSize: "14px" }}>Others</span>
            </label>
          </div>
        </div>

        {/* Date and Time */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
          <div style={{ flex: 1 }}>
            <label style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "14px",
              fontWeight: "500",
              color: "#2C3E50"
            }}>
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "6px",
                border: "1px solid #BDC3C7",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box"
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "14px",
              fontWeight: "500",
              color: "#2C3E50"
            }}>
              Time
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "6px",
                border: "1px solid #BDC3C7",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box"
              }}
            />
          </div>
        </div>

        {/* Duration */}
        <div style={{ marginBottom: "15px" }}>
          <label style={{
            display: "block",
            marginBottom: "8px",
            fontSize: "14px",
            fontWeight: "500",
            color: "#2C3E50"
          }}>
            Duration
          </label>
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "6px",
              border: "1px solid #BDC3C7",
              fontSize: "14px",
              outline: "none",
              boxSizing: "border-box"
            }}
          >
            <option value="30 minutes">30 minutes</option>
            <option value="1 hour">1 hour</option>
            <option value="2 hours">2 hours</option>
            <option value="3 hours">3 hours</option>
            <option value="4 hours">4 hours</option>
            <option value="5 hours">5 hours</option>
            <option value="6 hours">6 hours</option>
          </select>
        </div>

        {/* Description */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{
            display: "block",
            marginBottom: "8px",
            fontSize: "14px",
            fontWeight: "500",
            color: "#2C3E50"
          }}>
            Description (Optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter meeting details..."
            rows="3"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "6px",
              border: "1px solid #BDC3C7",
              fontSize: "14px",
              outline: "none",
              resize: "vertical",
              fontFamily: "Arial, sans-serif",
              boxSizing: "border-box"
            }}
          />
        </div>
        
        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "10px"
        }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 16px",
              borderRadius: "6px",
              border: "1px solid #BDC3C7",
              backgroundColor: "white",
              color: "#7F8C8D",
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!date || !time}
            style={{
              padding: "10px 16px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: (date && time) ? "#3498DB" : "#BDC3C7",
              color: "white",
              cursor: (date && time) ? "pointer" : "not-allowed",
              fontSize: "14px"
            }}
          >
            Schedule Meeting
          </button>
        </div>
      </div>
    </div>
  );
}
