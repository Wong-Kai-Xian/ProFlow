import React, { useState, useEffect } from 'react';
import { COLORS, LAYOUT, BUTTON_STYLES, INPUT_STYLES } from '../profile-component/constants';
import { getAcceptedTeamMembersForProject } from '../../services/teamService';
import { useAuth } from '../../contexts/AuthContext';

export default function AddGroupForumModal({ isOpen, onClose, onCreateNewForum, projects, defaultProjectId }) {
  const [newForumName, setNewForumName] = useState('');
  const [forumDescription, setForumDescription] = useState('');
  const [forumMembers, setForumMembers] = useState([]);
  const [newMember, setNewMember] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId || '');
  const [acceptedTeamMembers, setAcceptedTeamMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const { currentUser } = useAuth();

  React.useEffect(() => {
    setSelectedProjectId(defaultProjectId || '');
  }, [defaultProjectId]);

  // Fetch accepted team members when modal opens or project changes
  useEffect(() => {
    const fetchAcceptedMembers = async () => {
      if (!isOpen || !currentUser) return;
      
      setLoadingMembers(true);
      try {
        const members = await getAcceptedTeamMembersForProject(currentUser, selectedProjectId || null);
        setAcceptedTeamMembers(members);
      } catch (error) {
        console.error("Error fetching accepted team members:", error);
        setAcceptedTeamMembers([]);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchAcceptedMembers();
  }, [isOpen, currentUser, selectedProjectId]);

  if (!isOpen) return null;

  const handleAddMember = () => {
    if (newMember && !forumMembers.includes(newMember)) {
      const selectedMember = acceptedTeamMembers.find(member => member.id === newMember);
      if (selectedMember) {
        setForumMembers([...forumMembers, selectedMember.id]);
        setNewMember('');
      }
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
            <input
              type="text"
              value={projects.find(p => p.id === selectedProjectId)?.name || ''}
              readOnly
              style={{
                ...INPUT_STYLES.base,
                width: "100%",
                fontSize: '14px',
                background: '#f9fafb',
                color: COLORS.lightText
              }}
            />
            {!selectedProjectId && (
              <div style={{ color: COLORS.danger, fontSize: '12px', marginTop: '6px' }}>Project is required.</div>
            )}
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
            {!newForumName.trim() && (<div style={{ color: COLORS.danger, fontSize: '12px', marginTop: '6px' }}>Forum name is required.</div>)}
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
            {!forumDescription.trim() && (<div style={{ color: COLORS.danger, fontSize: '12px', marginTop: '6px' }}>Description is required.</div>)}
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
            
            {loadingMembers ? (
              <p style={{ color: COLORS.lightText, fontSize: '12px' }}>Loading accepted team members...</p>
            ) : (
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                <select
                  value={newMember}
                  onChange={(e) => setNewMember(e.target.value)}
                  style={{
                    ...INPUT_STYLES.base,
                    flex: 1,
                    fontSize: '14px'
                  }}
                >
                  <option value="">-- Select from accepted team --</option>
                  {acceptedTeamMembers
                    .filter(member => !forumMembers.includes(member.id))
                    .map(member => (
                      <option key={member.id} value={member.id}>
                        {member.name} ({member.email})
                      </option>
                    ))
                  }
                </select>
                <button
                  onClick={handleAddMember}
                  style={{
                    ...BUTTON_STYLES.secondary,
                    padding: '6px 12px',
                    fontSize: '12px'
                  }}
                  disabled={!newMember}
                >
                  Add
                </button>
              </div>
            )}
            
            {acceptedTeamMembers.length === 0 && !loadingMembers && (
              <p style={{ color: COLORS.lightText, fontSize: '12px' }}>
                No accepted team members available. Send invitations from the Team page first.
              </p>
            )}

            {/* Display Added Members */}
            {forumMembers.length > 0 && (
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '6px',
                marginTop: '8px'
              }}>
                {forumMembers.map((memberId, index) => {
                  const memberData = acceptedTeamMembers.find(m => m.id === memberId);
                  return (
                    <div key={index} style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: COLORS.light,
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: COLORS.dark
                    }}>
                      <span>{memberData ? memberData.name : 'Unknown Member'}</span>
                      <button
                        onClick={() => handleRemoveMember(memberId)}
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
                  );
                })}
              </div>
            )}
          </div>

          <button 
            onClick={handleCreateClick} 
            disabled={!newForumName.trim() || !forumDescription.trim() || !selectedProjectId}
            style={{
              ...BUTTON_STYLES.primary,
              width: "100%",
              opacity: (!newForumName.trim() || !forumDescription.trim() || !selectedProjectId) ? 0.5 : 1,
              cursor: (!newForumName.trim() || !forumDescription.trim() || !selectedProjectId) ? 'not-allowed' : 'pointer'
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
