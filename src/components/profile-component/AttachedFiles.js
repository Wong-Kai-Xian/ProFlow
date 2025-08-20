// src/components/profile-component/AttachedFiles.js
import React, { useState, useRef } from "react";
import Card from "./Card";
import FileUploadModal from "./FileUploadModal"; // Import the new modal component
import { BUTTON_STYLES, COLORS, INPUT_STYLES, LAYOUT } from "./constants"; // Import constants

export default function AttachedFiles({ files, onFileAdd, onFileRemove, onFileRename }) {
  const [expandedFile, setExpandedFile] = useState(null);
  const [showModal, setShowModal] = useState(false); // State to control modal visibility
  const [editingFileIndex, setEditingFileIndex] = useState(null);
  const [newFileName, setNewFileName] = useState("");

  const handleModalUpload = (selectedFile, description, fileSize, addedTime) => {
    onFileAdd({
      name: selectedFile.name,
      type: 'document', // Always document type for file uploads
      description: description,
      url: '',
      size: fileSize, // Add file size
      uploadTime: addedTime, // Add upload time
    });
    setShowModal(false); // Close modal after upload
  };

  const toggleExpand = (index) => {
    setExpandedFile(expandedFile === index ? null : index);
  };

  const handleRenameClick = (index, currentName) => {
    setEditingFileIndex(index);
    setNewFileName(currentName);
  };

  const handleRenameChange = (event) => {
    setNewFileName(event.target.value);
  };

  const handleRenameSave = (index) => {
    if (newFileName.trim() && onFileRename) {
      onFileRename(index, newFileName.trim());
      setEditingFileIndex(null);
      setNewFileName("");
    }
  };

  const handleRenameCancel = () => {
    setEditingFileIndex(null);
    setNewFileName("");
  };

  const handleRenameKeyPress = (event, index) => {
    if (event.key === 'Enter') {
      handleRenameSave(index);
    } else if (event.key === 'Escape') {
      handleRenameCancel();
    }
  };

  const getFileIcon = (type) => {
    switch (type) {
      case 'document': return '📄';
      case 'image': return '🖼️';
      case 'link': return '🔗';
      default: return '📁';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card style={{ minHeight: "250px" }}>
      <h3>Attached Files</h3>
      <div style={{ marginBottom: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <button onClick={() => setShowModal(true)} style={{ ...BUTTON_STYLES.primary }}>
          Add Files
        </button>
      </div>
      <ul style={{ 
        marginTop: "10px", 
        maxHeight: "150px", 
        overflowY: "auto",
        listStyle: "none",
        padding: 0
      }}>
        {files.map((file, i) => (
          <li key={i} style={{ 
            padding: "8px", 
            borderBottom: "1px solid #eee", 
            fontSize: "14px",
            background: expandedFile === i ? "#f0f0f0" : "white",
            borderRadius: "6px",
            marginBottom: "5px"
          }}>
            <div 
              onClick={() => toggleExpand(i)} 
              style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}
            >
              <span style={{ flexGrow: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {getFileIcon(file.type)} 
                {editingFileIndex === i ? (
                  <input
                    type="text"
                    value={newFileName}
                    onChange={handleRenameChange}
                    onBlur={() => handleRenameSave(i)}
                    onKeyPress={(e) => handleRenameKeyPress(e, i)}
                    style={{ marginLeft: "5px", fontSize: "14px", padding: "2px", borderRadius: "4px", border: "1px solid #ccc" }}
                    autoFocus
                  />
                ) : (
                  <span onDoubleClick={() => handleRenameClick(i, file.name)}>
                    {file.name} 
                  </span>
                )}
              </span>
              <div style={{ flexShrink: 0, marginLeft: "10px" }}>
                {editingFileIndex !== i && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleRenameClick(i, file.name); }} 
                    style={{ ...BUTTON_STYLES.primary, background: COLORS.secondary, padding: "4px 8px", marginRight: "5px" }}
                  >
                    Rename
                  </button>
                )}
                <button 
                  onClick={(e) => { e.stopPropagation(); onFileRemove(i); }} 
                  style={{ ...BUTTON_STYLES.primary, background: COLORS.danger, padding: "4px 8px" }}
                >
                  Remove
                </button>
              </div>
            </div>
            {expandedFile === i && (
              <div style={{ marginTop: "10px", paddingLeft: "20px", borderLeft: "2px solid #ddd" }}>
                {file.description && <p style={{ margin: "5px 0" }}>**Description:** {file.description}</p>}
                {/* Removed direct link/image URL display as per new requirements */}
                {file.type === 'document' && (
                  <>
                    <p style={{ margin: "5px 0" }}>**Uploaded On:** {file.uploadTime ? new Date(file.uploadTime).toLocaleString() : 'N/A'}</p>
                    <p style={{ margin: "5px 0" }}>**Size:** {file.size ? formatFileSize(file.size) : 'N/A'}</p>
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      <FileUploadModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        onUpload={handleModalUpload}
      />
    </Card>
  );
}
