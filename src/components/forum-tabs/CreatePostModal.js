import React, { useState } from "react";
import LocationModal from "./LocationModal";
import MeetingModal from "./MeetingModal";

export default function CreatePostModal({ isOpen, onClose, onSubmit }) {
  const [postText, setPostText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);

  const handleImageUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
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

  const handleSubmit = () => {
    if (postText.trim()) {
      const newPost = {
        type: 'message',
        author: 'Current User',
        timestamp: 'Just now',
        content: postText,
        likes: 0,
        comments: [],
        files: selectedFiles,
        location: selectedLocation,
        meeting: selectedMeeting
      };
      
      onSubmit(newPost);
      
      // Reset form
      setPostText('');
      setSelectedFiles([]);
      setSelectedLocation('');
      setSelectedMeeting(null);
      onClose();
    }
  };

  const handleClose = () => {
    // Reset form when closing
    setPostText('');
    setSelectedFiles([]);
    setSelectedLocation('');
    setSelectedMeeting(null);
    onClose();
  };

  const actionButtonStyle = {
    padding: '10px 16px',
    margin: '0 8px',
    border: '1px solid #BDC3C7',
    backgroundColor: 'white',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    color: '#7F8C8D',
    transition: 'all 0.3s ease',
    fontWeight: '500'
  };

  if (!isOpen) return null;

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
            >
              📷 Picture
            </button>
            <button 
              onClick={handleFileAttachment}
              style={actionButtonStyle}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#ECF0F1'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
            >
              📎 Attachment
            </button>
            <button 
              onClick={() => setShowMeetingModal(true)}
              style={actionButtonStyle}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#ECF0F1'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
            >
              📅 Schedule Meeting
            </button>
            <button 
              onClick={() => setShowLocationModal(true)}
              style={actionButtonStyle}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#ECF0F1'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
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
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!postText.trim()}
            style={{
              padding: '10px 20px',
              backgroundColor: postText.trim() ? '#3498DB' : '#BDC3C7',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: postText.trim() ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Post
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
