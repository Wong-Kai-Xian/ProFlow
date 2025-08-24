import React, { useState, useEffect } from 'react';
import Card from '../profile-component/Card';
import { COLORS, LAYOUT, BUTTON_STYLES, INPUT_STYLES } from '../profile-component/constants';

export default function ProjectDetails({ project, onSave, allProjectNames, readOnly, noCard }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editableProject, setEditableProject] = useState(project || {});
  const [showDescModal, setShowDescModal] = useState(false);

  // Debugging: Log onSave prop
  useEffect(() => {
    console.log("ProjectDetails: onSave prop type and value", typeof onSave, onSave);
    if (project) {
      setEditableProject(project);
    }
  }, [project, onSave]); // Add onSave to dependency array to log changes

  // Early return if no project data
  if (!project) {
    const loadingContent = (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
        <p style={{ color: COLORS.lightText }}>Loading project details...</p>
      </div>
    );
    
    if (noCard) {
      return <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>{loadingContent}</div>;
    }
    
    return (
      <Card style={{ height: "250px", minHeight: "250px", maxHeight: "250px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {loadingContent}
      </Card>
    );
  }

  const isWaitingForApproval = project.status === "Waiting for Approval";
  const effectiveReadOnly = readOnly || isWaitingForApproval; // Combine existing readOnly with new approval status

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

  const cardStyle = {
    height: noCard ? "100%" : "250px", 
    minHeight: noCard ? "auto" : "250px", 
    maxHeight: noCard ? "none" : "250px", 
    display: "flex", 
    flexDirection: "column", 
    overflow: (isEditing && !effectiveReadOnly) ? "hidden" : "hidden",
    position: "relative",
    opacity: isWaitingForApproval ? 0.6 : 1,
    pointerEvents: isWaitingForApproval ? "none" : "auto"
  };

  const content = (
    <>
      {isWaitingForApproval && (
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(255, 255, 255, 0.7)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 10,
          borderRadius: "12px",
          flexDirection: "column",
          gap: "10px",
          textAlign: "center"
        }}>
          <h4 style={{ color: COLORS.primary, margin: 0, fontSize: "18px" }}>Waiting for Approval</h4>
          <p style={{ color: COLORS.dark, margin: 0, fontSize: "14px" }}>This project is awaiting review and cannot be edited.</p>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: LAYOUT.smallGap }}>
        <h3 style={{ margin: 0, color: COLORS.dark, fontSize: "16px", fontWeight: "700" }}>Project Details</h3>
        {!effectiveReadOnly && typeof onSave === 'function' && (!isEditing ? (
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

      <div style={{ 
        flex: 1, 
        overflowY: (isEditing && !effectiveReadOnly) ? "auto" : "auto", 
        padding: "0px",
        display: "flex", 
        flexDirection: "column",
        gap: LAYOUT.smallGap
      }}>
        <div style={{ display: "flex", flexDirection: "row", gap: LAYOUT.smallGap }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={{ display: "block", marginBottom: "4px", color: COLORS.dark, fontSize: "12px", fontWeight: "600" }}>Project Name</label>
            {isEditing && !effectiveReadOnly ? (
              <input
                type="text"
                name="name"
                value={editableProject.name || ''}
                onChange={handleChange}
                style={{ ...INPUT_STYLES.base, width: "100%", fontSize: "12px", padding: "6px" }}
              />
            ) : (
              <div style={{ padding: "6px", fontSize: "12px", color: COLORS.text, fontWeight: "400", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {project.name || 'No name'}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 2, color: COLORS.lightText, fontSize: "11px", fontWeight: 600 }}>Customer</div>
        <div style={{ display: "flex", flexDirection: "row", gap: LAYOUT.smallGap }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={{ display: "block", marginBottom: "4px", color: COLORS.dark, fontSize: "12px", fontWeight: "600" }}>Customer Name</label>
            {isEditing && !effectiveReadOnly ? (
              <input
                type="text"
                name="companyInfo.customerName"
                value={editableProject.companyInfo?.customerName || ''}
                onChange={handleChange}
                style={{ ...INPUT_STYLES.base, width: "100%", fontSize: "12px", padding: "6px" }}
              />
            ) : (
              <div style={{ padding: "6px", fontSize: "12px", color: COLORS.text, fontWeight: "400", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {project.companyInfo?.customerName || 'No customer name'}
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={{ display: "block", marginBottom: "4px", color: COLORS.dark, fontSize: "12px", fontWeight: "600" }}>Customer Email</label>
            {isEditing && !effectiveReadOnly ? (
              <input
                type="email"
                name="companyInfo.customerEmail"
                value={editableProject.companyInfo?.customerEmail || ''}
                onChange={handleChange}
                style={{ ...INPUT_STYLES.base, width: "100%", fontSize: "12px", padding: "6px" }}
              />
            ) : (
              <div style={{ padding: "6px", fontSize: "12px", color: COLORS.text, fontWeight: "400", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {project.companyInfo?.customerEmail || 'No email'}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 4, color: COLORS.lightText, fontSize: "11px", fontWeight: 600 }}>Company</div>
        <div style={{ display: "flex", flexDirection: "row", gap: LAYOUT.smallGap }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={{ display: "block", marginBottom: "4px", color: COLORS.dark, fontSize: "12px", fontWeight: "600" }}>Company</label>
            {isEditing && !effectiveReadOnly ? (
              <input
                type="text"
                name="companyInfo.companyName"
                value={editableProject.companyInfo?.companyName || ''}
                onChange={handleChange}
                style={{ ...INPUT_STYLES.base, width: "100%", fontSize: "12px", padding: "6px" }}
              />
            ) : (
              <div style={{ padding: "6px", fontSize: "12px", color: COLORS.text, fontWeight: "400", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {project.companyInfo?.companyName || 'No company'}
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={{ display: "block", marginBottom: "4px", color: COLORS.dark, fontSize: "12px", fontWeight: "600" }}>Deadline</label>
            {isEditing && !effectiveReadOnly ? (
              <input
                type="date"
                name="deadline"
                value={editableProject.deadline || ''}
                onChange={handleChange}
                style={{ ...INPUT_STYLES.base, width: "100%", fontSize: "12px", padding: "6px" }}
              />
            ) : (
              <div style={{ padding: "6px", fontSize: "12px", color: COLORS.text, fontWeight: "400", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {project.deadline || 'No deadline'}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <label style={{ display: "block", marginBottom: "4px", color: COLORS.dark, fontSize: "12px", fontWeight: "600" }}>Description</label>
          {isEditing && !effectiveReadOnly ? (
            <textarea
              name="description"
              value={editableProject.description || ''}
              placeholder="Enter project description..."
              onChange={handleChange}
              style={{ ...INPUT_STYLES.textarea, width: "100%", flex: 1, resize: "none" }}
            />
          ) : (
            <div style={{ 
              flex: 1, 
              color: COLORS.lightText, 
              fontSize: "14px", 
              lineHeight: "1.6", 
              fontWeight: "400",
              overflowY: "auto",
              paddingRight: "5px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              marginTop: "4px"
            }}>
              {project.description || 'No description provided.'}
              {project.description && (
                <div style={{ marginTop: '6px' }}>
                  <button
                    onClick={() => setShowDescModal(true)}
                    style={{ ...BUTTON_STYLES.secondary, padding: '4px 8px', fontSize: '12px' }}
                  >
                    View Full
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );

  if (noCard) {
    return <div style={cardStyle}>{content}</div>;
  }

  return (
    <Card style={cardStyle}>
      {content}
      {showDescModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#fff', padding: '16px', borderRadius: '10px', width: '90%', maxWidth: '700px', maxHeight: '80vh', overflowY: 'auto' }}>
            <h4 style={{ margin: 0, color: COLORS.dark }}>Full Description</h4>
            <div style={{ marginTop: '8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.7', color: COLORS.text }}>
              {project.description}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button onClick={() => setShowDescModal(false)} style={BUTTON_STYLES.primary}>Close</button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
