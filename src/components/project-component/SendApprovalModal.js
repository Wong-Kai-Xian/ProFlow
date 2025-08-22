import React, { useState, useEffect } from "react";
import { COLORS, BUTTON_STYLES, INPUT_STYLES, LAYOUT } from "../profile-component/constants";
import { db, storage } from '../../firebase'; // Import db and storage
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'; // Import Firestore functions
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'; // Import Storage functions
import { getAcceptedTeamMembersForProject } from "../../services/teamService";

export default function SendApprovalModal({
  isOpen,
  onClose,
  onSendApproval,
  defaultProject = null,
  defaultStatus = "",
  currentUser,
  teamMembers, // Expect teamMembers prop (will be replaced with accepted team members)
}) {
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const [selectedRecipient, setSelectedRecipient] = useState(null); // Selected team member for approval
  const [recipientSearchTerm, setRecipientSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [loading, setLoading] = useState(false); // New loading state
  const [uploadProgress, setUploadProgress] = useState(0); // For file upload progress
  const [uploading, setUploading] = useState(false); // For file upload status
  const [acceptedTeamMembers, setAcceptedTeamMembers] = useState([]); // Accepted team members only

  useEffect(() => {
    const fetchAcceptedTeamMembers = async () => {
      if (!isOpen || !currentUser) return;

      try {
        const members = await getAcceptedTeamMembersForProject(
          currentUser, 
          defaultProject?.id || null
        );
        setAcceptedTeamMembers(members);
      } catch (error) {
        console.error("Error fetching accepted team members:", error);
        setAcceptedTeamMembers([]);
      }
    };

    fetchAcceptedTeamMembers();
  }, [isOpen, currentUser, defaultProject?.id]);

  console.log("Team members fetched:", teamMembers);
  console.log("Team members length:", teamMembers.length);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async () => {
    console.log("handleSubmit called.");
    if (!message.trim() && !file) {
      alert("Please enter a message or upload a file.");
      return;
    }
    // No longer need this check if "all" is a valid option
    // if (!selectedAdmin) {
    //   alert("Please select an admin to send the approval to.");
    //   return;
    // }

    setLoading(true);
    let fileUrl = "";

    if (file) {
      console.log("File detected, starting upload.");
      setUploading(true);
      const storageRef = ref(storage, `approval_files/${file.name}_${Date.now()}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
          console.log('Upload is ' + progress + '% done');
        },
        (error) => {
          console.error("File upload error:", error);
          alert("Failed to upload file.");
          setLoading(false);
          setUploading(false);
          // It's important to return here or handle the error properly
        },
        async () => {
          console.log("File upload complete.");
          fileUrl = await getDownloadURL(uploadTask.snapshot.ref);
          console.log("File URL:", fileUrl);
          await saveApprovalRequest(fileUrl);
          setUploading(false);
          setLoading(false);
          onClose();
        }
      );
    } else {
      console.log("No file to upload, saving approval request directly.");
      await saveApprovalRequest(fileUrl);
      setLoading(false);
      onClose();
    }
  };

  const saveApprovalRequest = async (fileUrl) => {
    console.log("saveApprovalRequest called with fileUrl:", fileUrl);
    try {
      const requests = [];
      let recipientUids = [];
      let recipientNames = [];

      if (selectedRecipient) {
        const recipientData = acceptedTeamMembers.find(member => member.id === selectedRecipient);
        if (recipientData) {
          recipientUids.push(recipientData.id);
          recipientNames.push(recipientData.name);
        }
      } else if (acceptedTeamMembers.length > 0) {
        // Default to sending to all accepted team members if no specific recipient is selected
        recipientUids = acceptedTeamMembers.map(member => member.id);
        recipientNames = acceptedTeamMembers.map(member => member.name);
      } else {
        alert("No accepted team members available to send approval requests to.");
        setLoading(false);
        return;
      }

      for (let i = 0; i < recipientUids.length; i++) {
        requests.push(addDoc(collection(db, "approvalRequests"), {
          projectId: defaultProject ? defaultProject.id : null,
          projectName: defaultProject ? defaultProject.name : "",
          status: "pending",
          message: message.trim(),
          fileUrl: fileUrl,
          fileName: file ? file.name : "",
          requestedBy: currentUser ? currentUser.uid : "anonymous",
          requestedByName: currentUser ? currentUser.displayName || currentUser.email : "Anonymous",
          requestedTo: recipientUids[i],
          requestedToName: recipientNames[i],
          timestamp: serverTimestamp(),
        }));
      }
      console.log("Awaiting all approval requests to complete.");
      await Promise.all(requests); // Wait for all requests to complete
      console.log("Approval request(s) sent successfully.");

      if (onSendApproval) {
        onSendApproval(); 
      }
      setMessage("");
      setFile(null);
      setSelectedRecipient(null); 
      setRecipientSearchTerm('');
    } catch (error) {
      console.error("Error sending approval request(s):", error);
      alert("Failed to send approval request(s).");
    }
  };

  if (!isOpen) return null;

  console.log("SendApprovalModal is open. Current selectedRecipient:", selectedRecipient);
  const filteredSuggestions = acceptedTeamMembers.filter(member =>
    member.name.toLowerCase().includes(recipientSearchTerm.toLowerCase()) ||
    member.email.toLowerCase().includes(recipientSearchTerm.toLowerCase())
  );
  console.log("Recipient Search Term:", recipientSearchTerm);
  console.log("Filtered Suggestions (Accepted Team):", filteredSuggestions);

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
        backgroundColor: COLORS.white,
        padding: "30px",
        borderRadius: LAYOUT.borderRadius,
        width: "95%",
        maxWidth: "800px",
        maxHeight: "95vh",
        overflowY: "auto",
        boxShadow: "0 8px 30px rgba(0, 0, 0, 0.2)",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}>
        <h2 style={{ margin: 0, color: COLORS.dark, fontSize: "22px", marginBottom: "15px" }}>Send Approval</h2>
        
        {/* Recipient selection with suggestions */}
        <div style={{ marginBottom: "15px", position: 'relative' }}>
          <label style={{ ...INPUT_STYLES.label, marginBottom: "10px", fontSize: "15px" }}>Send to:</label>
          <input
            type="text"
            value={recipientSearchTerm}
            onChange={(e) => {
              setRecipientSearchTerm(e.target.value);
              setShowSuggestions(true);
              setSelectedRecipient(null); // Clear selected recipient if search term changes
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              // Delay hiding suggestions to allow click on a suggestion item
              setTimeout(() => {
                setShowSuggestions(false);
              }, 100);
            }}
            placeholder="Search for a team member..."
            style={{
              ...INPUT_STYLES.base,
              width: "100%",
              padding: "12px",
              fontSize: "15px",
            }}
            disabled={loading || uploading}
          />
          {showSuggestions && recipientSearchTerm && filteredSuggestions.length > 0 && (
            <ul style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              backgroundColor: COLORS.white,
              border: `1px solid ${COLORS.border}`,
              borderRadius: LAYOUT.borderRadius,
              maxHeight: '200px',
              overflowY: 'auto',
              zIndex: 10,
              listStyle: 'none',
              padding: 0,
              margin: '5px 0 0 0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}>
              {filteredSuggestions.map(member => (
                <li
                  key={member.id}
                  onMouseDown={() => {
                    setSelectedRecipient(member.id);
                    setRecipientSearchTerm(member.name);
                    setShowSuggestions(false);
                  }}
                  style={{
                    padding: '10px 15px',
                    cursor: 'pointer',
                    borderBottom: `1px solid ${COLORS.border}70`,
                    '&:hover': {
                      backgroundColor: COLORS.light,
                    },
                  }}
                >
                  {member.name} ({member.email})
                </li>
              ))}
            </ul>
          )}
          {showSuggestions && recipientSearchTerm && filteredSuggestions.length === 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              backgroundColor: COLORS.white,
              border: `1px solid ${COLORS.border}`,
              borderRadius: LAYOUT.borderRadius,
              padding: '10px 15px',
              zIndex: 10,
              color: COLORS.lightText,
              textAlign: 'center',
              margin: '5px 0 0 0',
            }}>
              No matching accepted team members found.
            </div>
          )}
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ ...INPUT_STYLES.label, marginBottom: "10px", fontSize: "15px" }}>Message:</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter your approval message..."
            rows="7"
            style={{
              ...INPUT_STYLES.base,
              width: "100%",
              resize: "vertical",
              minHeight: "120px",
              padding: "12px",
              fontSize: "15px",
            }}
            disabled={loading || uploading}
          />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label style={{ ...INPUT_STYLES.label, marginBottom: "10px", fontSize: "15px" }}>Upload File:</label>
          <input
            type="file"
            onChange={handleFileChange}
            style={{
              ...INPUT_STYLES.base,
              width: "100%",
              padding: "12px",
              border: `1px solid ${COLORS.border}`,
              fontSize: "15px",
            }}
            disabled={loading || uploading}
          />
          {uploading && (
            <div style={{ marginTop: '10px', fontSize: '14px', color: COLORS.primary }}>
              Uploading: {uploadProgress.toFixed(2)}%
            </div>
          )}
        </div>

        {/* Moved Send Approval and Cancel buttons to the bottom */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "15px", marginTop: "20px" }}>
          <button
            onClick={onClose}
            style={{ ...BUTTON_STYLES.secondary, padding: "12px 25px", fontSize: "15px" }}
            disabled={loading || uploading}
          >
            Cancel
          </button>
          <button
            onClick={() => { console.log("Send Approval button clicked."); setShowConfirmationModal(true); }}
            style={{ ...BUTTON_STYLES.primary, padding: "12px 25px", fontSize: "15px" }}
            disabled={loading || uploading || !selectedRecipient} // Disable if no recipient is selected
          >
            {loading ? 'Sending...' : 'Send Approval'}
          </button>
        </div>

        {/* Confirmation Modal */}
        {showConfirmationModal && (
          <>
            {console.log("Confirmation Modal is being rendered.")}
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
              zIndex: 1001,
            }}>
              <div style={{
                backgroundColor: COLORS.white,
                padding: "30px",
                borderRadius: LAYOUT.borderRadius,
                width: "90%",
                maxWidth: "400px",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
                textAlign: "center",
              }}>
                <h3 style={{ margin: 0, color: COLORS.dark }}>Confirm Send Approval</h3>
                <p style={{ margin: 0, color: COLORS.text }}>Are you sure you want to send this approval?</p>
                <div style={{ display: "flex", justifyContent: "center", gap: "15px", marginTop: "10px" }}>
                  <button
                    onClick={() => { console.log("Confirmation Cancel clicked."); setShowConfirmationModal(false); }}
                    style={{ ...BUTTON_STYLES.secondary, padding: "10px 20px", fontSize: "14px" }}
                    disabled={loading || uploading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { console.log("Confirmation Confirm clicked, calling handleSubmit."); handleSubmit(); setShowConfirmationModal(false); }} // Proceed with submission
                    style={{ ...BUTTON_STYLES.primary, padding: "10px 20px", fontSize: "14px" }}
                    disabled={loading || uploading}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
