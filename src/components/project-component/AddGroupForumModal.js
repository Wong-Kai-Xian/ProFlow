import React, { useState } from 'react';
import { COLORS, LAYOUT, BUTTON_STYLES, INPUT_STYLES } from '../profile-component/constants';

export default function AddGroupForumModal({ isOpen, onClose, onCreateNewForum, onAddExistingForum }) {
  const [newForumName, setNewForumName] = useState('');
  const [selectedForumId, setSelectedForumId] = useState('');

  // Mock existing forums for demonstration
  const mockExistingForums = [
    { id: 'forum1', name: 'General Discussion' },
    { id: 'forum2', name: 'Technical Support' },
    { id: 'forum3', name: 'Feature Requests' },
  ];

  if (!isOpen) return null;

  const handleCreateClick = () => {
    if (newForumName.trim()) {
      onCreateNewForum(newForumName.trim());
      setNewForumName('');
      onClose();
    }
  };

  const handleAddExistingClick = () => {
    if (selectedForumId) {
      onAddExistingForum(selectedForumId);
      setSelectedForumId('');
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
        <div style={{ border: `1px solid ${COLORS.lightBorder}`, borderRadius: LAYOUT.smallBorderRadius, padding: LAYOUT.smallGap, marginBottom: LAYOUT.smallGap }}>
          <h4 style={{ margin: "0 0 10px 0", color: COLORS.text }}>Create New Forum</h4>
          <div style={{ display: "flex", gap: LAYOUT.smallGap }}>
            <input
              type="text"
              placeholder="New forum name"
              value={newForumName}
              onChange={(e) => setNewForumName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateClick()}
              style={{
                ...INPUT_STYLES.base,
                flex: 1,
              }}
            />
            <button onClick={handleCreateClick} style={BUTTON_STYLES.primary}>
              Create
            </button>
          </div>
        </div>

        {/* Add from Existing Forum Section */}
        <div style={{ border: `1px solid ${COLORS.lightBorder}`, borderRadius: LAYOUT.smallBorderRadius, padding: LAYOUT.smallGap }}>
          <h4 style={{ margin: "0 0 10px 0", color: COLORS.text }}>Add From Existing</h4>
          <select
            value={selectedForumId}
            onChange={(e) => setSelectedForumId(e.target.value)}
            style={{
              ...INPUT_STYLES.base,
              width: "100%",
              marginBottom: LAYOUT.smallGap,
            }}
          >
            <option value="">Select an existing forum</option>
            {mockExistingForums.map(forum => (
              <option key={forum.id} value={forum.id}>
                {forum.name}
              </option>
            ))}
          </select>
          <button onClick={handleAddExistingClick} style={BUTTON_STYLES.secondary}>
            Add Selected
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
