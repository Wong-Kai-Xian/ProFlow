import React, { useState, useEffect } from 'react';
import Card from '../profile-component/Card';
import { COLORS, LAYOUT, BUTTON_STYLES, INPUT_STYLES } from '../profile-component/constants';

export default function ProjectDetails({ project, onSave, allProjectNames, readOnly }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editableProject, setEditableProject] = useState(project || {});

  // Debugging: Log onSave prop
  useEffect(() => {
    console.log("ProjectDetails: onSave prop type and value", typeof onSave, onSave);
    if (project) {
      setEditableProject(project);
    }
  }, [project, onSave]); // Add onSave to dependency array to log changes

  // Early return if no project data
  if (!project) {
    return (
      <Card style={{ height: "250px", minHeight: "250px", maxHeight: "250px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
          <p style={{ color: COLORS.lightText }}>Loading project details...</p>
        </div>
      </Card>
    );
  }

  const handleSave = () => {
    if (typeof onSave === 'function') {
      onSave(editableProject);
    }
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
    } else if (name.startsWith("team.")) {
      // Handle team member changes if needed (e.g., editing existing member details)
      // For now, team members are managed separately, so this path might not be immediately used.
      console.warn("Team member editing not fully implemented via ProjectDetails.js");
    } else {
      setEditableProject(prev => ({ ...prev, [name]: value }));
    }
  };

  return (
    <Card style={{
      height: "250px", 
      minHeight: "250px", 
      maxHeight: "250px", 
      display: "flex", 
      flexDirection: "column", 
      overflow: (isEditing && !readOnly) ? "hidden" : "hidden" // Keep outer card hidden, inner div will scroll
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: LAYOUT.smallGap }}>
        <h3 style={{ margin: 0, color: COLORS.dark, fontSize: "16px", fontWeight: "700" }}>Project Details</h3>
        {!readOnly && typeof onSave === 'function' && (!isEditing ? (
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
        ))}
      </div>

      <div style={{ flex: 1, overflowY: (isEditing && !readOnly) ? "auto" : "hidden", paddingRight: "5px" }}> {/* Apply scroll here */}
        {/* Editable Info at the top */}
        <div style={{ marginBottom: LAYOUT.smallGap }}>
          <p style={{ margin: "0 0 8px 0", color: COLORS.dark, fontSize: "14px" }}>
            <strong style={{ fontWeight: "600" }}>Project Name:</strong> 
            <span style={{ marginLeft: "8px", fontWeight: "400" }}>
              {(isEditing && !readOnly) ? (
                <input 
                  type="text" 
                  name="name" 
                  value={editableProject.name || ''} 
                  onChange={handleChange} 
                  style={INPUT_STYLES.base} 
                />
              ) : (
                project.name || 'N/A'
              )}
            </span>
          </p>
          {/* Project ID (always read-only) */}
          <p style={{ margin: "0 0 8px 0", color: COLORS.dark, fontSize: "14px" }}>
            <strong style={{ fontWeight: "600" }}>Project ID:</strong> 
            <span style={{ marginLeft: "8px", fontWeight: "400", userSelect: "all" }}>
              {project.id || 'N/A'}
            </span>
          </p>
          <p style={{ margin: "0 0 8px 0", color: COLORS.dark, fontSize: "14px" }}>
            <strong style={{ fontWeight: "600" }}>Company:</strong> 
            <span style={{ marginLeft: "8px", fontWeight: "400" }}>
              {(isEditing && !readOnly) ? (
                <input type="text" name="companyInfo.name" value={editableProject.companyInfo?.name || ''} onChange={handleChange} style={INPUT_STYLES.base} />
              ) : (
                project.companyInfo?.name || 'N/A'
              )}
            </span>
          </p>
          <p style={{ margin: "0 0 8px 0", color: COLORS.dark, fontSize: "14px" }}>
            <strong style={{ fontWeight: "600" }}>Industry:</strong> 
            <span style={{ marginLeft: "8px", fontWeight: "400" }}>
              {(isEditing && !readOnly) ? (
                <input type="text" name="companyInfo.industry" value={editableProject.companyInfo?.industry || ''} onChange={handleChange} style={INPUT_STYLES.base} />
              ) : (
                project.companyInfo?.industry || 'N/A'
              )}
            </span>
          </p>
          <p style={{ margin: "0 0 8px 0", color: COLORS.dark, fontSize: "14px" }}>
            <strong style={{ fontWeight: "600" }}>Contact:</strong> 
            <span style={{ marginLeft: "8px", fontWeight: "400" }}>
              {(isEditing && !readOnly) ? (
                <input type="text" name="companyInfo.contact" value={editableProject.companyInfo?.contact || ''} onChange={handleChange} style={INPUT_STYLES.base} />
              ) : (
                project.companyInfo?.contact || 'N/A'
              )}
            </span>
          </p>
        </div>

        {/* Description at the bottom */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <p style={{ margin: "0 0 8px 0", color: COLORS.dark, fontSize: "14px", fontWeight: "600" }}>
            <strong>Description:</strong>
          </p>
          {(isEditing && !readOnly) ? (
            <textarea
              name="description"
              value={editableProject.description || ''}
              onChange={handleChange}
              style={{ ...INPUT_STYLES.textarea, width: "100%", flex: 1, resize: "none" }}
            />
          ) : (
            <div style={{ 
              flex: 1, 
              color: COLORS.lightText, 
              fontSize: "14px", 
              lineHeight: "1.4", 
              fontWeight: "400",
              overflowY: "auto",
              paddingRight: "5px"
            }}>
              {project.description || 'No description provided.'}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
