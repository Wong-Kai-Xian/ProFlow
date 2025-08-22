import React, { useState } from 'react';
import { COLORS, LAYOUT, BUTTON_STYLES, INPUT_STYLES } from '../profile-component/constants';

export default function AddGroupForumModal({ isOpen, onClose, onCreateNewForum, projects, defaultProjectId }) {
  const [newForumName, setNewForumName] = useState('');
  const [forumDescription, setForumDescription] = useState('');
  const [forumMembers, setForumMembers] = useState([]);
  const [newMember, setNewMember] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId || '');

  React.useEffect(() => {
    setSelectedProjectId(defaultProjectId || '');
  }, [defaultProjectId]);

  if (!isOpen) return null;

  const handleAddMember = () => {
    if (newMember.trim() && !forumMembers.includes(newMember.trim())) {
      setForumMembers([...forumMembers, newMember.trim()]);
      setNewMember('');
    }
  };

  const handleRemoveMember = (memberToRemove) => {
    setForumMembers(forumMembers.filter(member => member !== memberToRemove));
  };

  const handleCreateClick = () => {
    if (newForumName.trim()) {
      onCreateNewForum({
        name: newForumName.trim(),
        description: forumDescription.trim(),
        members: forumMembers,
        projectId: selectedProjectId === '' ? null : selectedProjectId, // Pass selected project ID
      });
      setNewForumName('');
      setForumDescription('');
      setForumMembers([]);
      setNewMember('');
      setSelectedProjectId(defaultProjectId || ''); // Reset to default on close
      onClose();
    }
  };

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
        background: COLORS.background,
        padding: LAYOUT.gap,
        borderRadius: LAYOUT.borderRadius,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        width: "400px",
        maxWidth: "90%",
        display: "flex",
        flexDirection: "column",
        gap: LAYOUT.gap,
      }}>
        <h3 style={{ margin: "0 0 10px 0", color: COLORS.text }}>Add Group Forum</h3>

        {/* Create New Forum Section */}
        <div style={{ 
          border: `1px solid ${COLORS.lightBorder}`, 
          borderRadius: LAYOUT.smallBorderRadius, 
          padding: LAYOUT.gap, 
          marginBottom: LAYOUT.smallGap 
        }}>
          <h4 style={{ margin: "0 0 15px 0", color: COLORS.dark, fontSize: "16px", fontWeight: "600" }}>Create New Forum</h4>
          
          {/* Project Selection */}
          <div style={{ marginBottom: "12px" }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px', 
              color: COLORS.dark,
              fontSize: '14px',
              fontWeight: '500'
            }}>
              Link to Project
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              style={{
                ...INPUT_STYLES.base,
                width: "100%",
                fontSize: '14px'
              }}
            >
              <option value="">-- Select Project --</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Forum Name */}
          <div style={{ marginBottom: "12px" }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px', 
              color: COLORS.dark,
              fontSize: '14px',
              fontWeight: '500'
            }}>
              Forum Name *
            </label>
            <input
              type="text"
              placeholder="Enter forum name"
              value={newForumName}
              onChange={(e) => setNewForumName(e.target.value)}
              style={{
                ...INPUT_STYLES.base,
                width: "100%",
                fontSize: '14px'
              }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: "12px" }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px', 
              color: COLORS.dark,
              fontSize: '14px',
              fontWeight: '500'
            }}>
              Description
            </label>
            <textarea
              placeholder="Enter forum description"
              value={forumDescription}
              onChange={(e) => setForumDescription(e.target.value)}
              style={{
                ...INPUT_STYLES.textarea,
                width: "100%",
                minHeight: "60px",
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Members */}
          <div style={{ marginBottom: "15px" }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px', 
              color: COLORS.dark,
              fontSize: '14px',
              fontWeight: '500'
            }}>
              Forum Members
            </label>
            
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <input
                type="text"
                value={newMember}
                onChange={(e) => setNewMember(e.target.value)}
                placeholder="Add member"
                style={{
                  ...INPUT_STYLES.base,
                  flex: 1,
                  fontSize: '14px'
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddMember();
                  }
                }}
              />
              <button
                onClick={handleAddMember}
                style={{
                  ...BUTTON_STYLES.secondary,
                  padding: '6px 12px',
                  fontSize: '12px'
                }}
              >
                Add
              </button>
            </div>

            {/* Display Added Members */}
            {forumMembers.length > 0 && (
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '6px',
                marginTop: '8px'
              }}>
                {forumMembers.map((member, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: COLORS.light,
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: COLORS.dark
                  }}>
                    <span>{member}</span>
                    <button
                      onClick={() => handleRemoveMember(member)}
                      style={{
                        background: 'none',
                        border: 'none',
                        marginLeft: '4px',
                        cursor: 'pointer',
                        color: COLORS.danger,
                        fontSize: '14px',
                        padding: '0',
                        lineHeight: '1'
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button 
            onClick={handleCreateClick} 
            disabled={!newForumName.trim()}
            style={{
              ...BUTTON_STYLES.primary,
              width: "100%",
              opacity: !newForumName.trim() ? 0.5 : 1,
              cursor: !newForumName.trim() ? 'not-allowed' : 'pointer'
            }}
          >
            Create Forum
          </button>
        </div>

        <button onClick={onClose} style={{
          ...BUTTON_STYLES.tertiary,
          marginTop: LAYOUT.smallGap,
        }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
