import React, { useState, useEffect } from 'react';
import { COLORS, LAYOUT, BUTTON_STYLES, INPUT_STYLES } from "../profile-component/constants";

const EditProjectDetailsModal = ({ isOpen, onClose, project, onSave }) => {
  const [editedProject, setEditedProject] = useState(project || {});

  useEffect(() => {
    setEditedProject(project || {});
  }, [project]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditedProject(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = () => {
    onSave(editedProject);
    onClose();
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <h3 style={{ color: COLORS.dark, marginBottom: LAYOUT.gap }}>Edit Project Details</h3>
        
        <label style={{ display: "block", marginBottom: LAYOUT.smallGap, color: COLORS.dark, fontWeight: "600" }}>
          Project Name:
          <input
            type="text"
            name="name"
            value={editedProject.name || ''}
            onChange={handleChange}
            style={{ ...INPUT_STYLES.base, width: "100%", marginTop: "5px" }}
          />
        </label>

        <label style={{ display: "block", marginBottom: LAYOUT.gap, color: COLORS.dark, fontWeight: "600" }}>
          Description:
          <textarea
            name="description"
            value={editedProject.description || ''}
            onChange={handleChange}
            style={{ ...INPUT_STYLES.textarea, width: "100%", minHeight: "100px", marginTop: "5px" }}
          />
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: LAYOUT.smallGap }}>
          <button onClick={onClose} style={BUTTON_STYLES.secondary}>
            Cancel
          </button>
          <button onClick={handleSave} style={BUTTON_STYLES.primary}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

const modalOverlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalContentStyle = {
  backgroundColor: COLORS.white,
  padding: LAYOUT.gap,
  borderRadius: LAYOUT.borderRadius,
  boxShadow: LAYOUT.shadow,
  width: "90%",
  maxWidth: "500px",
  textAlign: "left",
};

export default EditProjectDetailsModal;
