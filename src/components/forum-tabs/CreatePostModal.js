import React, { useState, useEffect } from "react";
import LocationModal from "./LocationModal";
import MeetingModal from "./MeetingModal";
import { db, storage } from '../../firebase'; // Import db and storage
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'; // Import Storage functions

export default function CreatePostModal({
  isOpen,
  onClose,
  forumId,
  updateForumLastActivity,
  updateForumPostCount,
  editingPost, // New prop for editing existing posts
  onConfirm, // Callback for when a post is created or updated
  currentUser // Pass currentUser to CreatePostModal
}) {
  const [postText, setPostText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false); // State for tracking file upload progress
  const [fileUploadProgress, setFileUploadProgress] = useState({}); // Track progress for each file
  const [isSubmitting, setIsSubmitting] = useState(false); // New state for overall submission status

  // Effect to populate form when editing an existing post
  useEffect(() => {
    if (isOpen && editingPost) {
      setPostText(editingPost.content || '');
      setSelectedFiles(editingPost.files || []);
      setSelectedLocation(editingPost.location || '');
      setSelectedMeeting(editingPost.meeting || null);
    } else if (isOpen) {
      // Reset form fields when opening for a new post
      setPostText('');
      setSelectedFiles([]);
      setSelectedLocation('');
      setSelectedMeeting(null);
    }
    // Also reset submission states when modal opens/closes
    setUploadingFiles(false);
    setFileUploadProgress({});
    setIsSubmitting(false);
  }, [isOpen, editingPost]);

  const handleImageUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*'; // Allows all image file types
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from(e.target.files);
      console.log("Image files selected:", files);
      setSelectedFiles(prev => [...prev, ...files]);
    };
    input.click();
  };

  const handleFileAttachment = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"; // Allows specified non-image file types
    input.onchange = (e) => {
      const files = Array.from(e.target.files);
      console.log("Files selected:", files);
      setSelectedFiles(prev => [...prev, ...files]);
    };
    input.click();
  };

  const handleLocationSave = (location) => {
    setSelectedLocation(location);
  };

  const handleMeetingSave = (meetingData) => {
    setSelectedMeeting(meetingData);
  };

  const clearLocation = () => {
    setSelectedLocation('');
  };

  const clearMeeting = () => {
    setSelectedMeeting(null);
  };

  const handleSubmit = async () => {
    if (!postText.trim() && selectedFiles.length === 0) return; // Prevent empty posts
    if (isSubmitting) return; // Prevent multiple submissions

    setIsSubmitting(true); // Set submitting state to true
    setUploadingFiles(true); // Indicate that file uploads are starting
    let uploadedFileMetadata = [];

    // Process files: Upload new files, retain existing file metadata
    if (selectedFiles.length > 0) {
      const uploadPromises = selectedFiles.map((file) => {
        if (file instanceof File) {
          // This is a new file to upload
          const storageRef = ref(storage, `forum_attachments/${forumId}/${file.name}`);
          const uploadTask = uploadBytesResumable(storageRef, file);

          return new Promise((resolve, reject) => {
            uploadTask.on('state_changed',
              (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setFileUploadProgress(prev => ({ ...prev, [file.name]: progress }));
              },
              (error) => {
                console.error("Upload failed for file", file.name, ":", error);
                reject(error);
              },
              () => {
                getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                  uploadedFileMetadata.push({
                    name: file.name,
                    url: downloadURL,
                    type: file.type,
                    size: file.size,
                  });
                  resolve();
                }).catch(reject);
              }
            );
          });
        } else {
          // This is an existing file (metadata), just retain it
          uploadedFileMetadata.push(file);
          return Promise.resolve();
        }
      });

      try {
        await Promise.all(uploadPromises);
        console.log("All files processed successfully!");
      } catch (error) {
        setUploadingFiles(false);
        setIsSubmitting(false); // Reset submitting state on file upload error
        console.error("Error during file uploads:", error);
        alert("Failed to process some files.");
        return; // Stop post creation/update if file processing fails
      }
    }

    const newPost = {
      type: 'message',
      author: currentUser?.name || currentUser?.displayName || currentUser?.email || "Anonymous", // Use currentUser.name
      authorId: currentUser?.uid,
      content: postText,
      likes: 0,
      comments: [],
      files: uploadedFileMetadata, // Store metadata, not raw File objects
      location: selectedLocation,
      meeting: selectedMeeting,
      starredBy: [], // Initialize starredBy for new posts
    };
    
    // Save to Firebase
    const postsRef = collection(doc(db, "forums", forumId), "posts");
    if (editingPost) {
      // Update existing post
      const postDocRef = doc(db, "forums", forumId, "posts", editingPost.id);
      await updateDoc(postDocRef, {
        content: newPost.content,
        files: newPost.files,
        location: newPost.location,
        meeting: newPost.meeting,
        timestamp: serverTimestamp(), // Update timestamp on edit
      })
      .then(() => {
        console.log("Post updated successfully!");
        updateForumLastActivity();
        setUploadingFiles(false);
        setFileUploadProgress({});
        setIsSubmitting(false);
        onClose();
        if (onConfirm) onConfirm(); // Notify parent of update
      })
      .catch((error) => {
        console.error("Error updating post:", error);
        setUploadingFiles(false);
        setIsSubmitting(false);
        alert("Failed to update post.");
      });
    } else {
      // Add new post
      addDoc(postsRef, {
        ...newPost,
        timestamp: serverTimestamp(),
        forumId: forumId
      })
      .then(() => {
        console.log("Post added successfully!");
        updateForumPostCount();
        updateForumLastActivity();
        setUploadingFiles(false);
        setFileUploadProgress({});
        setIsSubmitting(false);
        onClose();
        if (onConfirm) onConfirm(); // Notify parent of creation
      })
      .catch((error) => {
        console.error("Error adding post:", error);
        setUploadingFiles(false);
        setIsSubmitting(false);
        alert("Failed to create post.");
      });
    }
    
    // Reset form states (these will be cleared on success anyway, but good for immediate feedback)
    setPostText('');
    setSelectedFiles([]);
    setSelectedLocation('');
    setSelectedMeeting(null);
  };

  const handleClose = () => {
    // Reset form when closing
    setPostText('');
    setSelectedFiles([]);
    setSelectedLocation('');
    setSelectedMeeting(null);
    setUploadingFiles(false); // Ensure uploading state is reset on close
    setFileUploadProgress({}); // Clear progress on close
    setIsSubmitting(false); // Ensure submitting state is reset on close
    onClose();
    if (onConfirm) onConfirm(); // Call onConfirm to ensure parent state is reset (e.g., editingPost to null)
  };

  const actionButtonStyle = {
    padding: '8px 12px', // Adjusted padding
    margin: '0 5px', // Adjusted margin
    border: '1px solid #BDC3C7',
    backgroundColor: 'white',
    borderRadius: '6px', // Adjusted border radius
    cursor: 'pointer',
    fontSize: '13px', // Adjusted font size
    color: '#7F8C8D',
    transition: 'all 0.3s ease',
    fontWeight: '500'
  };

  if (!isOpen) return null;

  const isPostEmpty = !postText.trim() && selectedFiles.length === 0;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: "white",
        borderRadius: "10px",
        padding: "20px",
        width: "90%",
        maxWidth: "600px",
        maxHeight: "90vh",
        overflowY: "auto",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)"
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h3 style={{ 
            margin: 0, 
            color: '#2C3E50',
            fontSize: '18px'
          }}>
            Create New Post
          </h3>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#7F8C8D',
              padding: '0'
            }}
          >
            ×
          </button>
        </div>

        {/* Post Text Area */}
        <textarea
          value={postText}
          onChange={(e) => setPostText(e.target.value)}
          placeholder="What's on your mind?"
          style={{
            width: '100%',
            minHeight: '120px',
            padding: '15px',
            border: '1px solid #BDC3C7',
            borderRadius: '8px',
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box',
            marginBottom: '15px'
          }}
        />

        {/* Selected Files Display */}
        {selectedFiles.length > 0 && (
          <div style={{
            marginBottom: '15px',
            padding: '10px',
            backgroundColor: '#F8F9F9',
            borderRadius: '5px',
            border: '1px solid #ECF0F1'
          }}>
            <div style={{ fontSize: '12px', color: '#7F8C8D', marginBottom: '5px' }}>
              Selected files ({selectedFiles.length}):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {selectedFiles.map((file, index) => (
                <span key={index} style={{
                  fontSize: '11px',
                  padding: '2px 6px',
                  backgroundColor: '#3498DB',
                  color: 'white',
                  borderRadius: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}>
                  {file.name}
                  {uploadingFiles && fileUploadProgress[file.name] !== undefined && (
                    <span style={{ marginLeft: '5px' }}>({fileUploadProgress[file.name].toFixed(0)}%)</span>
                  )}
                  <button
                    onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '10px',
                      padding: '0'
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {isSubmitting && (
          <div style={{
            textAlign: 'center',
            padding: '10px 0',
            color: '#3498DB', // Using a color that matches the button
            fontSize: '14px',
            fontWeight: '500'
          }}>
            Posting...
          </div>
        )}

        {/* Selected Location Display */}
        {selectedLocation && (
          <div style={{
            marginBottom: '15px',
            padding: '10px',
            backgroundColor: '#E8F8F5',
            borderRadius: '5px',
            border: '1px solid #27AE60',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ fontSize: '12px', color: '#27AE60' }}>
              📍 Location: {selectedLocation}
            </div>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button
                onClick={() => setShowLocationModal(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#27AE60',
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: '2px'
                }}
                title="Edit location"
              >
                ✏️
              </button>
              <button
                onClick={clearLocation}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#27AE60',
                  cursor: 'pointer',
                  fontSize: '16px',
                  padding: '2px'
                }}
                title="Remove location"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Selected Meeting Display */}
        {selectedMeeting && (
          <div style={{
            marginBottom: '15px',
            padding: '10px',
            backgroundColor: '#FEF9E7',
            borderRadius: '5px',
            border: '1px solid #F39C12',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ fontSize: '12px', color: '#F39C12' }}>
              📅 Meeting: {selectedMeeting.type} on {selectedMeeting.fullDateTime} ({selectedMeeting.duration})
              {selectedMeeting.description && (
                <div style={{ marginTop: '4px', fontSize: '11px', color: '#D68910' }}>
                  {selectedMeeting.description}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button
                onClick={() => setShowMeetingModal(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#F39C12',
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: '2px'
                }}
                title="Edit meeting"
              >
                ✏️
              </button>
              <button
                onClick={clearMeeting}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#F39C12',
                  cursor: 'pointer',
                  fontSize: '16px',
                  padding: '2px'
                }}
                title="Remove meeting"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '20px' 
        }}>
          <div>
            <button 
              onClick={handleImageUpload}
              style={actionButtonStyle}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#ECF0F1'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
              disabled={isSubmitting || uploadingFiles}
            >
              📷 Picture
            </button>
            <button 
              onClick={handleFileAttachment}
              style={actionButtonStyle}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#ECF0F1'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
              disabled={isSubmitting || uploadingFiles}
            >
              📁 File
            </button>
            <button 
              onClick={() => setShowMeetingModal(true)}
              style={actionButtonStyle}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#ECF0F1'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
              disabled={isSubmitting}
            >
              📅 Schedule Meeting
            </button>
            <button 
              onClick={() => setShowLocationModal(true)}
              style={actionButtonStyle}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#ECF0F1'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
              disabled={isSubmitting}
            >
              📍 Location
            </button>
          </div>
        </div>

        {/* Submit Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px'
        }}>
          <button
            onClick={handleClose}
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              border: '1px solid #BDC3C7',
              backgroundColor: 'white',
              color: '#7F8C8D',
              cursor: 'pointer',
              fontSize: '14px'
            }}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPostEmpty || isSubmitting || uploadingFiles}
            style={{
              padding: '10px 20px',
              backgroundColor: (isPostEmpty || isSubmitting || uploadingFiles) ? '#BDC3C7' : '#3498DB',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: (isPostEmpty || isSubmitting || uploadingFiles) ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {isSubmitting ? 'Posting...' : 'Post'}
          </button>
        </div>

        {/* Location Modal */}
        <LocationModal
          isOpen={showLocationModal}
          onClose={() => setShowLocationModal(false)}
          onSave={handleLocationSave}
        />

        {/* Meeting Modal */}
        <MeetingModal
          isOpen={showMeetingModal}
          onClose={() => setShowMeetingModal(false)}
          onSave={handleMeetingSave}
        />
      </div>
    </div>
  );
}
