import React, { useState } from 'react';
import { COLORS, BUTTON_STYLES, INPUT_STYLES } from '../profile-component/constants';

export default function CreateForumModal({ isOpen, onClose, onConfirm, editingForum }) {
  const [forumName, setForumName] = useState('');
  const [description, setDescription] = useState('');
  const [members, setMembers] = useState([]);
  const [newMember, setNewMember] = useState('');

  // Populate form when editing
  React.useEffect(() => {
    if (editingForum) {
      setForumName(editingForum.name || '');
      setDescription(editingForum.description || '');
      setMembers(editingForum.members || []);
    } else {
      setForumName('');
      setDescription('');
      setMembers([]);
    }
  }, [editingForum]);

  const handleAddMember = () => {
    if (newMember.trim() && !members.includes(newMember.trim())) {
      setMembers([...members, newMember.trim()]);
      setNewMember('');
    }
  };

  const handleRemoveMember = (memberToRemove) => {
    setMembers(members.filter(member => member !== memberToRemove));
  };

  const handleSubmit = () => {
    if (forumName.trim()) {
      onConfirm({
        name: forumName.trim(),
        description: description.trim(),
        members: members,
        memberCount: members.length,
        notifications: 0,
        lastActivity: new Date().toISOString()
      });
      // Reset form
      setForumName('');
      setDescription('');
      setMembers([]);
      setNewMember('');
    }
  };

  const handleCancel = () => {
    setForumName('');
    setDescription('');
    setMembers([]);
    setNewMember('');
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
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
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
                padding: '8px 16px',
                fontSize: '14px'
              }}
            >
              Add
            </button>
          </div>

          {/* Display Added Members */}
          {members.length > 0 && (
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '8px',
              marginTop: '12px'
            }}>
              {members.map((member, index) => (
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
