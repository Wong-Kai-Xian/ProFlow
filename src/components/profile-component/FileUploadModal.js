import React, { useState, useRef } from 'react';
import { COLORS, LAYOUT, BUTTON_STYLES, INPUT_STYLES, CARD_STYLES } from './constants'; // Import constants

const FileUploadModal = ({ isOpen, onClose, onUpload }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [description, setDescription] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      setSelectedFile(event.dataTransfer.files[0]);
    }
  };

  const handleUploadClick = () => {
    if (selectedFile) {
      onUpload(selectedFile, description, selectedFile.size, new Date().toISOString());
      setSelectedFile(null);
      setDescription('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        ...CARD_STYLES.base,
        width: '400px',
        maxWidth: '90%',
        gap: LAYOUT.smallGap,
        display: 'flex',
        flexDirection: 'column',
        padding: LAYOUT.gap // Adjusted padding to use LAYOUT.gap
      }}>
        <h3 style={{ margin: 0, color: COLORS.text }}>Upload File</h3>
        
        <div 
          style={{
            border: `2px dashed ${COLORS.border}`,
            padding: LAYOUT.gap,
            textAlign: 'center',
            cursor: 'pointer',
            borderRadius: LAYOUT.smallBorderRadius,
            backgroundColor: COLORS.light,
            color: COLORS.lightText,
            fontSize: "14px"
          }}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current.click()}
        >
          {selectedFile ? selectedFile.name : "Drag & Drop your file here or Click to Browse"}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            style={{ display: "none" }}
          />
        </div>

        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows="3"
          style={{
            ...INPUT_STYLES.textarea,
            width: '100%',
            boxSizing: 'border-box',
          }}
        ></textarea>

        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: LAYOUT.smallGap,
        }}>
          <button onClick={onClose} style={{ ...BUTTON_STYLES.secondary }}>Cancel</button>
          <button onClick={handleUploadClick} style={{ ...BUTTON_STYLES.primary }}>Done</button>
        </div>
      </div>
    </div>
  );
};

export default FileUploadModal;
