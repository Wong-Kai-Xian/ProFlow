import React, { useState, useEffect } from 'react';
import Card from '../profile-component/Card';
import { COLORS, LAYOUT, BUTTON_STYLES, INPUT_STYLES } from '../profile-component/constants';

export default function ProjectDetails({ project, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editableProject, setEditableProject] = useState(project);

  // Update editableProject when project prop changes
  useEffect(() => {
    setEditableProject(project);
  }, [project]);

  const handleSave = () => {
    onSave(editableProject);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditableProject(project); // Revert changes
    setIsEditing(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith("companyInfo.")) {
      const field = name.split(".")[1];
      setEditableProject(prev => ({
        ...prev,
        companyInfo: {
          ...prev.companyInfo,
          [field]: value
        }
      }));
    } else {
      setEditableProject(prev => ({ ...prev, [name]: value }));
    }
  };

  return (
    <Card style={{ flexGrow: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: LAYOUT.smallGap }}>
        <h3 style={{ margin: 0, color: COLORS.text }}>Project Details</h3>
        {!isEditing ? (
          <button onClick={() => setIsEditing(true)} style={BUTTON_STYLES.secondary}>
            Edit
          </button>
        ) : (
          <div style={{ display: "flex", gap: LAYOUT.smallGap }}>
            <button onClick={handleSave} style={BUTTON_STYLES.primary}>
              Save
            </button>
            <button onClick={handleCancel} style={BUTTON_STYLES.secondary}>
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Editable Info at the top */}
      <div style={{ marginBottom: LAYOUT.smallGap }}>
        <p style={{ margin: "0 0 5px 0", color: COLORS.text, fontSize: "14px" }}>
          <strong>Project Name:</strong> {isEditing ? (
            <input type="text" name="name" value={editableProject.name || ''} onChange={handleChange} style={INPUT_STYLES.base} />
          ) : (
            project.name
          )}
        </p>
        <p style={{ margin: "0 0 5px 0", color: COLORS.text, fontSize: "14px" }}>
          <strong>Company:</strong> {isEditing ? (
            <input type="text" name="companyInfo.name" value={editableProject.companyInfo?.name || ''} onChange={handleChange} style={INPUT_STYLES.base} />
          ) : (
            project.companyInfo?.name || 'N/A'
          )}
        </p>
        <p style={{ margin: "0 0 5px 0", color: COLORS.text, fontSize: "14px" }}>
          <strong>Industry:</strong> {isEditing ? (
            <input type="text" name="companyInfo.industry" value={editableProject.companyInfo?.industry || ''} onChange={handleChange} style={INPUT_STYLES.base} />
          ) : (
            project.companyInfo?.industry || 'N/A'
          )}
        </p>
        <p style={{ margin: "0", color: COLORS.text, fontSize: "14px" }}>
          <strong>Contact:</strong> {isEditing ? (
            <input type="text" name="companyInfo.contact" value={editableProject.companyInfo?.contact || ''} onChange={handleChange} style={INPUT_STYLES.base} />
          ) : (
            project.companyInfo?.contact || 'N/A'
          )}
        </p>
      </div>

      {/* Description at the bottom */}
      <div>
        <p style={{ margin: "0 0 5px 0", color: COLORS.text, fontSize: "14px" }}>
          <strong>Description:</strong>
        </p>
        {isEditing ? (
          <textarea
            name="description"
            value={editableProject.description || ''}
            onChange={handleChange}
            style={{ ...INPUT_STYLES.textarea, width: "100%", minHeight: "80px" }}
          />
        ) : (
          <p style={{ margin: 0, color: COLORS.lightText, fontSize: "14px", lineHeight: "1.5" }}>
            {project.description || 'No description provided.'}
          </p>
        )}
      </div>
    </Card>
  );
}
