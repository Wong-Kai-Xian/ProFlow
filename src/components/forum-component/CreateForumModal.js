import React, { useState, useEffect } from 'react';
import { COLORS, BUTTON_STYLES, INPUT_STYLES } from '../profile-component/constants';
import { useAuth } from '../../contexts/AuthContext'; // Import useAuth
import { getAcceptedTeamMembers, getAcceptedTeamMembersForProject } from '../../services/teamService';

export default function CreateForumModal({ isOpen, onClose, onConfirm, editingForum, projects }) {
  const [forumName, setForumName] = useState('');
  const [description, setDescription] = useState('');
  const [members, setMembers] = useState([]);
  const [newMember, setNewMember] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(''); // New state for selected project
  const { currentUser } = useAuth(); // Get currentUser from AuthContext
  const [acceptedTeamMembers, setAcceptedTeamMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Fetch accepted team members when modal opens or project changes
  useEffect(() => {
    const fetchAcceptedMembers = async () => {
      if (!isOpen || !currentUser) return;
      
      setLoadingMembers(true);
      try {
        // For general forums, get all accepted team members
        // For project-specific forums, get project team members
        const teamMembers = selectedProjectId 
          ? await getAcceptedTeamMembersForProject(currentUser, selectedProjectId)
          : await getAcceptedTeamMembers(currentUser);
        setAcceptedTeamMembers(teamMembers);
      } catch (error) {
        console.error("Error fetching accepted team members:", error);
        setAcceptedTeamMembers([]);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchAcceptedMembers();
  }, [isOpen, currentUser, selectedProjectId]);

  // Populate form when editing
  React.useEffect(() => {
    if (editingForum) {
      setForumName(editingForum.name || '');
      setDescription(editingForum.description || '');
      setMembers(editingForum.members || []);
      setSelectedProjectId(editingForum.projectId || ''); // Set selected project if editing
    } else {
      setForumName('');
      setDescription('');
      setMembers([]);
      setNewMember('');
      setSelectedProjectId(''); // Reset for new forum
    }
  }, [editingForum]);

  const handleAddMember = () => {
    if (newMember && !members.includes(newMember)) {
      setMembers([...members, newMember]);
      setNewMember('');
    }
  };

  const handleRemoveMember = (memberToRemove) => {
    setMembers(members.filter(member => member !== memberToRemove));
  };

  const handleSubmit = () => {
    console.log("handleSubmit called.");
    if (forumName.trim() && currentUser) {
      console.log("Forum name is valid and currentUser exists.", { forumName: forumName.trim(), currentUser: currentUser });
      const initialMembers = editingForum ? members : (currentUser.uid ? [...members, currentUser.uid] : members);
      onConfirm({
        name: forumName.trim(),
        description: description.trim(),
        members: initialMembers,
        memberCount: initialMembers.length,
        notifications: 0,
        lastActivity: new Date().toISOString(), // This will be overwritten by serverTimestamp in ForumListPage
        projectId: selectedProjectId === '' ? null : selectedProjectId, // Pass selected project ID
        userId: currentUser.uid, // Associate forum with the current user
      });
      // Reset form
      setForumName('');
      setDescription('');
      setMembers([]);
      setNewMember('');
      setSelectedProjectId('');
    }
  };

  const handleCancel = () => {
    setForumName('');
    setDescription('');
    setMembers([]);
    setNewMember('');
    setSelectedProjectId(''); // Reset on cancel
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '30px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)'
      }}>
        <h2 style={{ 
          margin: '0 0 24px 0', 
          color: COLORS.dark,
          fontSize: '24px',
          fontWeight: '700',
          textAlign: 'center'
        }}>
          {editingForum ? 'Edit Forum' : 'Create New Forum'}
        </h2>

        {/* Forum Name */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            color: COLORS.dark,
            fontSize: '16px',
            fontWeight: '600'
          }}>
            Forum Name *
          </label>
          <input
            type="text"
            value={forumName}
            onChange={(e) => setForumName(e.target.value)}
            placeholder="Enter forum name"
            style={{
              ...INPUT_STYLES.base,
              width: '100%',
              fontSize: '16px',
              padding: '12px'
            }}
          />
        </div>

        {/* Project Selection */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            color: COLORS.dark,
            fontSize: '16px',
            fontWeight: '600'
          }}>
            Link to Project
          </label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            style={{
              ...INPUT_STYLES.base,
              width: '100%',
              fontSize: '16px',
              padding: '12px'
            }}
          >
            <option value="">-- No Project --</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            color: COLORS.dark,
            fontSize: '16px',
            fontWeight: '600'
          }}>
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter forum description"
            style={{
              ...INPUT_STYLES.textarea,
              width: '100%',
              fontSize: '16px',
              padding: '12px',
              minHeight: '80px',
              resize: 'vertical'
            }}
          />
        </div>

        {/* Members */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            color: COLORS.dark,
            fontSize: '16px',
            fontWeight: '600'
          }}>
            Forum Members
          </label>
          
          {loadingMembers ? (
            <p style={{ color: COLORS.lightText, fontSize: '14px' }}>Loading accepted team members...</p>
          ) : (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
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
                  .filter(member => !members.includes(member.id))
                  .map(member => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.email})
                    </option>
                  ))
                }
              </select>
              <button
                onClick={handleAddMember}
                disabled={!newMember}
                style={{
                  ...BUTTON_STYLES.secondary,
                  padding: '8px 16px',
                  fontSize: '14px',
                  opacity: !newMember ? 0.6 : 1,
                  cursor: !newMember ? 'not-allowed' : 'pointer'
                }}
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
          {members.length > 0 && (
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '8px',
              marginTop: '12px'
            }}>
              {members.map((memberId, index) => {
                const memberData = acceptedTeamMembers.find(m => m.id === memberId);
                const displayName = memberData ? memberData.name : memberId;
                return (
                  <div key={index} style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: COLORS.light,
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '14px',
                    color: COLORS.dark
                  }}>
                    <span>{displayName}</span>
                    <button
                      onClick={() => handleRemoveMember(memberId)}
                      style={{
                        background: 'none',
                        border: 'none',
                        marginLeft: '6px',
                        cursor: 'pointer',
                        color: COLORS.danger,
                        fontSize: '16px',
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

        {/* Buttons */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          justifyContent: 'flex-end',
          marginTop: '30px'
        }}>
          <button
            onClick={handleCancel}
            style={{
              ...BUTTON_STYLES.secondary,
              padding: '12px 24px',
              fontSize: '16px'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!forumName.trim()}
            style={{
              ...BUTTON_STYLES.primary,
              padding: '12px 24px',
              fontSize: '16px',
              opacity: !forumName.trim() ? 0.5 : 1,
              cursor: !forumName.trim() ? 'not-allowed' : 'pointer'
            }}
          >
            {editingForum ? 'Update Forum' : 'Create Forum'}
          </button>
        </div>
      </div>
    </div>
  );
}
