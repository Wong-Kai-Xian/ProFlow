import React, { useState } from "react";

export default function MeetingModal({ isOpen, onClose, onSave }) {
  const [mode, setMode] = useState("internal"); // internal | external | physical
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("1 hour");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState(""); // for external
  const [place, setPlace] = useState(""); // for physical

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
        mode, // internal | external | physical
        type: mode === 'internal' ? 'Internal (Jitsi)' : mode === 'external' ? 'External (Link)' : 'In-Person',
        title: title.trim(),
        date,
        time,
        duration,
        description: description.trim(),
        link: mode === 'external' ? link.trim() : '',
        place: mode === 'physical' ? place.trim() : '',
        fullDateTime: `${formatDate(date)}, ${time}`
      };
      onSave(meetingData);
      resetForm();
      onClose();
    }
  };

  const resetForm = () => {
    setMode("internal");
    setTitle("");
    setDate("");
    setTime("");
    setDuration("1 hour");
    setDescription("");
    setLink("");
    setPlace("");
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
        
        {/* Meeting Mode */}
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
          <div style={{ display: "flex", gap: "10px", flexWrap: 'wrap' }}>
            <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
              <input
                type="radio"
                value="internal"
                checked={mode === "internal"}
                onChange={() => setMode('internal')}
                style={{ marginRight: "6px" }}
              />
              <span style={{ fontSize: "14px" }}>Internal (Jitsi)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
              <input
                type="radio"
                value="external"
                checked={mode === "external"}
                onChange={() => setMode('external')}
                style={{ marginRight: "6px" }}
              />
              <span style={{ fontSize: "14px" }}>External (Google Meet / Zoom / Other)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
              <input
                type="radio"
                value="physical"
                checked={mode === "physical"}
                onChange={() => setMode('physical')}
                style={{ marginRight: "6px" }}
              />
              <span style={{ fontSize: "14px" }}>In-Person (Physical)</span>
            </label>
          </div>
        </div>

        {/* Title */}
        <div style={{ marginBottom: "15px" }}>
          <label style={{
            display: "block",
            marginBottom: "8px",
            fontSize: "14px",
            fontWeight: "500",
            color: "#2C3E50"
          }}>
            Meeting Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Quarterly Planning, Client Sync, Design Review"
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

        {/* Mode-specific fields */}
        {mode === 'external' && (
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500, color: '#2C3E50' }}>Meeting Link</label>
            <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij or https://zoom.us/j/123..." style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #BDC3C7', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        )}
        {mode === 'physical' && (
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500, color: '#2C3E50' }}>Location</label>
            <input type="text" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Office HQ, Room 305, Kuala Lumpur, etc." style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #BDC3C7', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        )}

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
