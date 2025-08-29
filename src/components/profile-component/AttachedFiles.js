// src/components/profile-component/AttachedFiles.js
import React, { useState, useRef } from "react";
import Card from "./Card";
import FileUploadModal from "./FileUploadModal"; // Import the new modal component
import { BUTTON_STYLES, COLORS, INPUT_STYLES, LAYOUT } from "./constants"; // Import constants
import { FaPlus, FaEdit, FaTrash, FaDownload } from 'react-icons/fa'; // Import icons
import { storage } from '../../firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import AttachDriveFileModal from '../common/AttachDriveFileModal';
import { ensureDriveToken, requestDriveConsent } from '../../utils/googleAuth';

export default function AttachedFiles({ files, onFileAdd, onFileRemove, onFileRename, readOnly = false }) {
  const [expandedFile, setExpandedFile] = useState(null);
  const [showModal, setShowModal] = useState(false); // State to control modal visibility
  const [editingFileIndex, setEditingFileIndex] = useState(null);
  const [newFileName, setNewFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [showAttachDrive, setShowAttachDrive] = useState(false);
  const [driveAuthNeeded, setDriveAuthNeeded] = useState(false);
  const [driveAuthError, setDriveAuthError] = useState("");
  
  const createGoogleFile = async (kind) => {
    try {
      let token = await ensureDriveToken();
      if (!token) { setDriveAuthNeeded(true); setDriveAuthError('Authorization required.'); return; }
      const mimeMap = {
        gdoc: 'application/vnd.google-apps.document',
        gsheet: 'application/vnd.google-apps.spreadsheet',
        gslide: 'application/vnd.google-apps.presentation'
      };
      const typeLabel = kind === 'gdoc' ? 'Document' : kind === 'gsheet' ? 'Spreadsheet' : 'Presentation';
      const defaultName = `${typeLabel} - ${new Date().toLocaleDateString()}`;
      const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink,parents&supportsAllDrives=true', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: defaultName, mimeType: mimeMap[kind], parents: ['root'] })
      });
      if (!res.ok) {
        try { const err = await res.json(); alert(`Failed to create file: ${err?.error?.message || res.status}`); } catch { alert('Failed to create file.'); }
        return;
      }
      const json = await res.json();
      const entry = {
        name: json.name || defaultName,
        type: kind,
        driveId: json.id,
        url: json.webViewLink || (kind === 'gdoc' ? `https://docs.google.com/document/d/${json.id}/edit` : kind === 'gsheet' ? `https://docs.google.com/spreadsheets/d/${json.id}/edit` : `https://docs.google.com/presentation/d/${json.id}/edit`),
        createdAt: Date.now()
      };
      onFileAdd(entry);
    } catch {
      alert('Failed to create Google file.');
    }
  };

  const handleModalUpload = async (selectedFile, description, fileSize, addedTime) => {
    setUploadError("");
    try {
      setUploading(true);
      const path = `customer_files/${Date.now()}_${selectedFile.name}`;
      const ref = storageRef(storage, path);
      await uploadBytes(ref, selectedFile);
      const url = await getDownloadURL(ref);
      onFileAdd({
        name: selectedFile.name,
        type: (selectedFile.type && selectedFile.type.startsWith('image')) ? 'image' : 'document',
        description: description,
        url,
        size: fileSize,
        uploadTime: addedTime,
      });
      setShowModal(false);
    } catch (e) {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
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

  const authorizeDrive = async () => {
    // Open the attach modal immediately so the user can see the Authorize button there
    setShowAttachDrive(true);
    try {
      const token = await ensureDriveToken();
      if (!token) { setDriveAuthNeeded(true); return; }
      setDriveAuthNeeded(false);
      setDriveAuthError("");
    } catch {
      setDriveAuthNeeded(true);
      setDriveAuthError('Authorization failed');
    }
  };

  return (
    <Card style={{ minHeight: "250px" }}>
      <h3>Attached Files</h3>
      {!readOnly && (
        <div style={{ marginBottom: "10px", display: "flex", flexDirection: "row", gap: "8px", alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setShowModal(true)} style={{ 
            ...BUTTON_STYLES.primary, 
            padding: "4px 8px", // Smaller padding
            fontSize: "14px" // Adjust font size for the icon
          }}>
            <FaPlus /> Upload
          </button>
          <button onClick={() => createGoogleFile('gdoc')} style={{ ...BUTTON_STYLES.secondary, padding: '4px 8px', fontSize: '14px' }}>+ New Google Doc</button>
          <button onClick={() => createGoogleFile('gsheet')} style={{ ...BUTTON_STYLES.secondary, padding: '4px 8px', fontSize: '14px' }}>+ New Google Sheet</button>
          <button onClick={() => createGoogleFile('gslide')} style={{ ...BUTTON_STYLES.secondary, padding: '4px 8px', fontSize: '14px' }}>+ New Google Slides</button>
          <button onClick={authorizeDrive} style={{ 
            ...BUTTON_STYLES.secondary,
            padding: "4px 8px",
            fontSize: "14px"
          }}>
            Attach from Drive
          </button>
          {driveAuthNeeded && (
            <>
              <button onClick={async () => { const t = await requestDriveConsent(); if (t) { setDriveAuthNeeded(false); setDriveAuthError(''); setShowAttachDrive(true); } }} style={{ ...BUTTON_STYLES.secondary, padding: '4px 8px' }}>Authorize Drive</button>
              <span style={{ color: COLORS.lightText, fontSize: 12 }}>Authorization required to use Drive features.</span>
            </>
          )}
          {driveAuthError && (<span style={{ color: COLORS.danger, fontSize: 12 }}>{driveAuthError}</span>)}
        </div>
      )}
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
                {files[i]?.url && (
                  <a
                    href={files[i].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => { e.stopPropagation(); }}
                    style={{ 
                      ...BUTTON_STYLES.primary, 
                      background: '#fff',
                      color: '#111827',
                      border: '1px solid #e5e7eb',
                      padding: "4px 8px",
                      fontSize: "14px",
                      marginRight: "5px",
                      borderRadius: "3px",
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                    download
                    title="Download"
                  >
                    <FaDownload /> <span>Download</span>
                  </a>
                )}
                {!readOnly && editingFileIndex !== i && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleRenameClick(i, file.name); }} 
                    style={{ 
                      ...BUTTON_STYLES.primary, 
                      background: COLORS.secondary, 
                      padding: "4px 8px", // Consistent padding
                      fontSize: "14px", // Consistent font size
                      marginRight: "5px",
                      borderRadius: "3px"
                    }}
                  >
                    <FaEdit />
                  </button>
                )}
                {!readOnly && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onFileRemove(i); }} 
                    style={{ 
                      ...BUTTON_STYLES.primary, 
                      background: COLORS.danger, 
                      padding: "4px 8px", // Consistent padding
                      fontSize: "14px", // Consistent font size
                      borderRadius: "3px"
                    }}
                  >
                    <FaTrash />
                  </button>
                )}
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
                    {file.url && (
                      <p style={{ margin: "5px 0" }}>
                        <a href={file.url} target="_blank" rel="noopener noreferrer" download style={{ color: COLORS.primary, textDecoration: 'underline' }}>Download</a>
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {!readOnly && (
        <FileUploadModal 
          isOpen={showModal} 
          onClose={() => setShowModal(false)} 
          onUpload={handleModalUpload}
        />
      )}
      {uploading && (
        <div style={{ marginTop: 8, fontSize: 12, color: COLORS.lightText }}>Uploading…</div>
      )}
      {uploadError && (
        <div style={{ marginTop: 8, fontSize: 12, color: COLORS.danger }}>{uploadError}</div>
      )}
      <AttachDriveFileModal
        isOpen={showAttachDrive}
        onClose={() => setShowAttachDrive(false)}
        onSelect={(file) => {
          try {
            onFileAdd({ name: file.name, type: file.type, driveId: file.driveId, url: file.url, createdAt: Date.now() });
            setShowAttachDrive(false);
          } catch {}
        }}
      />
    </Card>
  );
}
