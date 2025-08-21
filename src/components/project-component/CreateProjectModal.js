import React, { useState } from 'react';
import { COLORS, BUTTON_STYLES, INPUT_STYLES } from '../profile-component/constants';

export default function CreateProjectModal({ isOpen, onClose, onConfirm, editingProject }) {
  const [projectName, setProjectName] = useState('');
  const [teamMembers, setTeamMembers] = useState([]);
  const [newMember, setNewMember] = useState('');
  const [selectedStage, setSelectedStage] = useState('Proposal');

  const projectStages = ['Proposal', 'Negotiation', 'Complete'];

  // Populate form when editing
  React.useEffect(() => {
    if (editingProject) {
      setProjectName(editingProject.name || '');
      setTeamMembers(editingProject.team || []);
      setSelectedStage(editingProject.stage || 'Proposal');
    } else {
      setProjectName('');
      setTeamMembers([]);
      setSelectedStage('Proposal');
    }
  }, [editingProject]);

  const handleAddMember = () => {
    if (newMember.trim() && !teamMembers.includes(newMember.trim())) {
      setTeamMembers([...teamMembers, newMember.trim()]);
      setNewMember('');
    }
  };

  const handleRemoveMember = (memberToRemove) => {
    setTeamMembers(teamMembers.filter(member => member !== memberToRemove));
  };

  const handleSubmit = () => {
    if (projectName.trim()) {
      onConfirm({
        name: projectName.trim(),
        team: teamMembers,
        stage: selectedStage,
        tasks: 0,
        completedTasks: 0
      });
      // Reset form
      setProjectName('');
      setTeamMembers([]);
      setNewMember('');
      setSelectedStage('Proposal');
    }
  };

  const handleCancel = () => {
    setProjectName('');
    setTeamMembers([]);
    setNewMember('');
    setSelectedStage('Proposal');
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
          {editingProject ? 'Edit Project' : 'Create New Project'}
        </h2>

        {/* Project Name */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            color: COLORS.dark,
            fontSize: '16px',
            fontWeight: '600'
          }}>
            Project Name *
          </label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Enter project name"
            style={{
              ...INPUT_STYLES.base,
              width: '100%',
              fontSize: '16px',
              padding: '12px'
            }}
          />
        </div>

        {/* Team Members */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            color: COLORS.dark,
            fontSize: '16px',
            fontWeight: '600'
          }}>
            Team Members
          </label>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              type="text"
              value={newMember}
              onChange={(e) => setNewMember(e.target.value)}
              placeholder="Add team member"
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
                padding: '8px 16px',
                fontSize: '14px'
              }}
            >
              Add
            </button>
          </div>

          {/* Display Added Members */}
          {teamMembers.length > 0 && (
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '8px',
              marginTop: '12px'
            }}>
              {teamMembers.map((member, index) => (
                <div key={index} style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: COLORS.light,
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '14px',
                  color: COLORS.dark
                }}>
                  <span>{member}</span>
                  <button
                    onClick={() => handleRemoveMember(member)}
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
              ))}
            </div>
          )}
        </div>

        {/* Project Stage */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            color: COLORS.dark,
            fontSize: '16px',
            fontWeight: '600'
          }}>
            Project Stage
          </label>
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            style={{
              ...INPUT_STYLES.base,
              width: '100%',
              fontSize: '16px',
              padding: '12px'
            }}
          >
            {projectStages.map(stage => (
              <option key={stage} value={stage}>{stage}</option>
            ))}
          </select>
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
            disabled={!projectName.trim()}
            style={{
              ...BUTTON_STYLES.primary,
              padding: '12px 24px',
              fontSize: '16px',
              opacity: !projectName.trim() ? 0.5 : 1,
              cursor: !projectName.trim() ? 'not-allowed' : 'pointer'
            }}
          >
            {editingProject ? 'Update Project' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}
