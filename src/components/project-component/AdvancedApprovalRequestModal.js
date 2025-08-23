import React, { useState, useEffect } from "react";
import { DESIGN_SYSTEM } from "../../styles/designSystem";
import { db, storage } from '../../firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getAcceptedTeamMembersForProject } from "../../services/teamService";

export default function AdvancedApprovalRequestModal({
  isOpen,
  onClose,
  onSuccess,
  projectId = null,
  projectName = "",
  customerId = null,
  customerName = "",
  currentUser,
  currentStage = "",
  nextStage = "",
  isStageAdvancement = true // New prop to determine if this is for stage advancement
}) {
  // Form data states
  const [requestTitle, setRequestTitle] = useState("");
  const [requestDescription, setRequestDescription] = useState("");
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [allRecipients, setAllRecipients] = useState([]);
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploading, setUploading] = useState(false);
  const [recipientSearchTerm, setRecipientSearchTerm] = useState("");
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);

  // Request type - Project or Customer
  const requestType = projectId ? 'Project' : 'Customer';
  const entityName = projectId ? projectName : customerName;
  const entityId = projectId || customerId;

  // Fetch available recipients when modal opens
  useEffect(() => {
    const fetchRecipients = async () => {
      if (!isOpen || !currentUser) return;

      try {
        let recipients = [];
        
        if (projectId) {
          // For projects, get accepted team members
          recipients = await getAcceptedTeamMembersForProject(currentUser, projectId);
        } else if (customerId) {
          // For customers, get team members from the user's teams
          const teamsQuery = query(
            collection(db, "teams"),
            where("members", "array-contains", currentUser.uid)
          );
          const teamsSnapshot = await getDocs(teamsQuery);
          const allMemberIds = new Set();
          
          teamsSnapshot.docs.forEach(doc => {
            const teamData = doc.data();
            teamData.acceptedMembers?.forEach(memberId => {
              if (memberId !== currentUser.uid) {
                allMemberIds.add(memberId);
              }
            });
          });

          // Get user details for each member
          const usersQuery = query(collection(db, "users"));
          const usersSnapshot = await getDocs(usersQuery);
          
          recipients = usersSnapshot.docs
            .filter(doc => allMemberIds.has(doc.id))
            .map(doc => ({
              id: doc.id,
              name: doc.data().name || doc.data().displayName || doc.data().email,
              email: doc.data().email,
            }));
        }

        setAllRecipients(recipients);
      } catch (error) {
        console.error("Error fetching recipients:", error);
        setAllRecipients([]);
      }
    };

    fetchRecipients();
  }, [isOpen, currentUser, projectId, customerId]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setRequestTitle("");
      setRequestDescription("");
      setAttachedFiles([]);
      setSelectedRecipients([]);
      setRecipientSearchTerm("");
      setShowRecipientDropdown(false);
      
      // Set default title based on type and purpose
      if (isStageAdvancement) {
        if (requestType === 'Project') {
          setRequestTitle(`Advance ${entityName} from ${currentStage} to ${nextStage}`);
        } else {
          setRequestTitle(`Advance ${entityName} to Next Stage`);
        }
      } else {
        if (requestType === 'Project') {
          setRequestTitle(`Approval Request for ${entityName}`);
        } else {
          setRequestTitle(`Customer Approval Request for ${entityName}`);
        }
      }
    }
  }, [isOpen, requestType, entityName, currentStage, nextStage]);

  if (!isOpen) return null;

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setAttachedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const toggleRecipient = (recipientId) => {
    setSelectedRecipients(prev => 
      prev.includes(recipientId)
        ? prev.filter(id => id !== recipientId)
        : [...prev, recipientId]
    );
  };

  const filteredRecipients = allRecipients.filter(recipient =>
    recipient.name.toLowerCase().includes(recipientSearchTerm.toLowerCase()) ||
    recipient.email.toLowerCase().includes(recipientSearchTerm.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!requestTitle.trim()) {
      alert("Please enter a request title.");
      return;
    }

    if (!requestDescription.trim()) {
      alert("Please enter a request description.");
      return;
    }

    if (selectedRecipients.length === 0) {
      alert("Please select at least one recipient.");
      return;
    }

    // Prevent sender from making decision for themselves
    if (selectedRecipients.includes(currentUser.uid)) {
      alert("You cannot select yourself as a decision maker.");
      return;
    }

    setLoading(true);
    setUploading(true);

    try {
      // Upload files first
      const fileUrls = [];
      const fileNames = [];

      for (let i = 0; i < attachedFiles.length; i++) {
        const file = attachedFiles[i];
        const storageRef = ref(storage, `approval_files/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        await new Promise((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(prev => ({ ...prev, [i]: progress }));
            },
            (error) => {
              console.error("File upload error:", error);
              reject(error);
            },
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              fileUrls.push(downloadURL);
              fileNames.push(file.name);
              resolve();
            }
          );
        });
      }

      setUploading(false);

      // Create approval requests for each recipient
      const approvalPromises = selectedRecipients.map(recipientId => {
        const recipient = allRecipients.find(r => r.id === recipientId);
        
        return addDoc(collection(db, "approvalRequests"), {
          // Request metadata
          requestTitle: requestTitle.trim(),
          requestDescription: requestDescription.trim(),
          requestType, // 'Project' or 'Customer'
          
          // Entity information
          entityId,
          entityName,
          projectId: projectId || null,
          projectName: projectName || "",
          customerId: customerId || null,
          customerName: customerName || "",
          
          // Stage information
          currentStage: currentStage || "",
          nextStage: isStageAdvancement ? (nextStage || "") : "",
          isStageAdvancement: isStageAdvancement,
          
          // File attachments
          attachedFiles: fileUrls,
          attachedFileNames: fileNames,
          
          // User information
          requestedBy: currentUser.uid,
          requestedByName: currentUser.name || currentUser.displayName || currentUser.email,
          requestedByEmail: currentUser.email,
          requestedTo: recipientId,
          requestedToName: recipient?.name || "Unknown",
          requestedToEmail: recipient?.email || "",
          
          // Status and timing
          status: "pending",
          dateRequested: serverTimestamp(),
          dueDate: null, // Can be enhanced later
          
          // Decision tracking
          decisionMade: false,
          decisionBy: null,
          decisionDate: null,
          decisionComment: "",
          decisionFiles: [],
          
          // Audit trail
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });

      await Promise.all(approvalPromises);

      // Success callback
      if (onSuccess) {
        onSuccess({
          type: requestType,
          entityName,
          recipientCount: selectedRecipients.length,
          title: requestTitle
        });
      }

      onClose();
    } catch (error) {
      console.error("Error creating approval request:", error);
      alert("Failed to send approval request. Please try again.");
    } finally {
      setLoading(false);
      setUploading(false);
      setUploadProgress({});
    }
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
      backdropFilter: "blur(4px)"
    }}>
      <div style={{
        backgroundColor: DESIGN_SYSTEM.colors.background.primary,
        borderRadius: DESIGN_SYSTEM.borderRadius.lg,
        width: "90%",
        maxWidth: "800px",
        maxHeight: "90vh",
        overflow: "hidden",
        boxShadow: DESIGN_SYSTEM.shadows.xl,
        display: "flex",
        flexDirection: "column"
      }}>
        {/* Header */}
        <div style={{
          padding: DESIGN_SYSTEM.spacing.lg,
          borderBottom: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`,
          background: requestType === 'Project' 
            ? DESIGN_SYSTEM.pageThemes.projects.cardGradient
            : DESIGN_SYSTEM.pageThemes.customers.cardGradient
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: DESIGN_SYSTEM.spacing.sm }}>
            <div style={{
              padding: DESIGN_SYSTEM.spacing.xs,
              borderRadius: DESIGN_SYSTEM.borderRadius.base,
              backgroundColor: requestType === 'Project' 
                ? DESIGN_SYSTEM.pageThemes.projects.accent
                : DESIGN_SYSTEM.pageThemes.customers.accent,
              color: DESIGN_SYSTEM.colors.text.inverse,
              fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
              fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
              minWidth: "80px",
              textAlign: "center"
            }}>
              {requestType}
            </div>
            <h2 style={{
              margin: 0,
              fontSize: DESIGN_SYSTEM.typography.fontSize.xl,
              fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold,
              color: DESIGN_SYSTEM.colors.text.primary
            }}>
              {isStageAdvancement ? "Request Approval & Advance Stage" : "Send Approval Request"}
            </h2>
          </div>
          <p style={{
            margin: `${DESIGN_SYSTEM.spacing.xs} 0 0 0`,
            fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
            color: DESIGN_SYSTEM.colors.text.secondary
          }}>
            {entityName} {isStageAdvancement && currentStage && nextStage && `• ${currentStage} → ${nextStage}`}
          </p>
        </div>

        {/* Content */}
        <div style={{
          padding: DESIGN_SYSTEM.spacing.lg,
          overflow: "auto",
          flex: 1
        }}>
          {/* Request Title */}
          <div style={{ marginBottom: DESIGN_SYSTEM.spacing.base }}>
            <label style={{
              display: "block",
              marginBottom: DESIGN_SYSTEM.spacing.xs,
              fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
              fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
              color: DESIGN_SYSTEM.colors.text.primary
            }}>
              Request Title *
            </label>
            <input
              type="text"
              value={requestTitle}
              onChange={(e) => setRequestTitle(e.target.value)}
              placeholder="Enter a clear, descriptive title for this request"
              style={{
                width: "100%",
                padding: DESIGN_SYSTEM.spacing.sm,
                border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                borderRadius: DESIGN_SYSTEM.borderRadius.base,
                fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                outline: "none",
                transition: "border-color 0.2s ease",
                ":focus": {
                  borderColor: DESIGN_SYSTEM.colors.primary[500]
                }
              }}
              disabled={loading}
              maxLength={200}
            />
          </div>

          {/* Request Description */}
          <div style={{ marginBottom: DESIGN_SYSTEM.spacing.base }}>
            <label style={{
              display: "block",
              marginBottom: DESIGN_SYSTEM.spacing.xs,
              fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
              fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
              color: DESIGN_SYSTEM.colors.text.primary
            }}>
              Description *
            </label>
            <textarea
              value={requestDescription}
              onChange={(e) => setRequestDescription(e.target.value)}
              placeholder="Provide detailed context about why this stage advancement is needed..."
              rows={4}
              style={{
                width: "100%",
                padding: DESIGN_SYSTEM.spacing.sm,
                border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                borderRadius: DESIGN_SYSTEM.borderRadius.base,
                fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                outline: "none",
                resize: "vertical",
                transition: "border-color 0.2s ease",
                fontFamily: DESIGN_SYSTEM.typography.fontFamily.primary
              }}
              disabled={loading}
              maxLength={1000}
            />
          </div>

          {/* File Attachments */}
          <div style={{ marginBottom: DESIGN_SYSTEM.spacing.base }}>
            <label style={{
              display: "block",
              marginBottom: DESIGN_SYSTEM.spacing.xs,
              fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
              fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
              color: DESIGN_SYSTEM.colors.text.primary
            }}>
              Attach Files (Optional)
            </label>
            <input
              type="file"
              multiple
              onChange={handleFileSelect}
              style={{
                width: "100%",
                padding: DESIGN_SYSTEM.spacing.sm,
                border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                borderRadius: DESIGN_SYSTEM.borderRadius.base,
                fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                backgroundColor: DESIGN_SYSTEM.colors.background.secondary
              }}
              disabled={loading}
            />
            
            {/* File List */}
            {attachedFiles.length > 0 && (
              <div style={{ marginTop: DESIGN_SYSTEM.spacing.sm }}>
                {attachedFiles.map((file, index) => (
                  <div key={index} style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: DESIGN_SYSTEM.spacing.xs,
                    backgroundColor: DESIGN_SYSTEM.colors.background.secondary,
                    borderRadius: DESIGN_SYSTEM.borderRadius.base,
                    marginBottom: DESIGN_SYSTEM.spacing.xs
                  }}>
                    <span style={{
                      fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                      color: DESIGN_SYSTEM.colors.text.secondary
                    }}>
                      {file.name}
                    </span>
                    {uploading && uploadProgress[index] !== undefined && (
                      <span style={{
                        fontSize: DESIGN_SYSTEM.typography.fontSize.xs,
                        color: DESIGN_SYSTEM.colors.primary[500]
                      }}>
                        {Math.round(uploadProgress[index])}%
                      </span>
                    )}
                    <button
                      onClick={() => removeFile(index)}
                      disabled={loading}
                      style={{
                        background: "none",
                        border: "none",
                        color: DESIGN_SYSTEM.colors.error,
                        cursor: "pointer",
                        fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                        padding: DESIGN_SYSTEM.spacing.xs
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recipients Selection */}
          <div style={{ marginBottom: DESIGN_SYSTEM.spacing.base }}>
            <label style={{
              display: "block",
              marginBottom: DESIGN_SYSTEM.spacing.xs,
              fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
              fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
              color: DESIGN_SYSTEM.colors.text.primary
            }}>
              Select Decision Makers * ({selectedRecipients.length} selected)
            </label>
            
            <div style={{ position: "relative" }}>
              <input
                type="text"
                value={recipientSearchTerm}
                onChange={(e) => {
                  setRecipientSearchTerm(e.target.value);
                  setShowRecipientDropdown(true);
                }}
                onFocus={() => setShowRecipientDropdown(true)}
                placeholder="Search team members..."
                style={{
                  width: "100%",
                  padding: DESIGN_SYSTEM.spacing.sm,
                  border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                  borderRadius: DESIGN_SYSTEM.borderRadius.base,
                  fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                  outline: "none"
                }}
                disabled={loading}
              />
              
              {showRecipientDropdown && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  backgroundColor: DESIGN_SYSTEM.colors.background.primary,
                  border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                  borderRadius: DESIGN_SYSTEM.borderRadius.base,
                  boxShadow: DESIGN_SYSTEM.shadows.lg,
                  maxHeight: "200px",
                  overflowY: "auto",
                  zIndex: 10,
                  marginTop: "2px"
                }}>
                  {filteredRecipients.length === 0 ? (
                    <div style={{
                      padding: DESIGN_SYSTEM.spacing.sm,
                      color: DESIGN_SYSTEM.colors.text.tertiary,
                      textAlign: "center"
                    }}>
                      No team members found
                    </div>
                  ) : (
                    filteredRecipients.map(recipient => (
                      <div
                        key={recipient.id}
                        onClick={() => toggleRecipient(recipient.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: DESIGN_SYSTEM.spacing.sm,
                          cursor: "pointer",
                          backgroundColor: selectedRecipients.includes(recipient.id)
                            ? DESIGN_SYSTEM.colors.primary[50]
                            : "transparent",
                          borderBottom: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedRecipients.includes(recipient.id)}
                          onChange={() => toggleRecipient(recipient.id)}
                          style={{ marginRight: DESIGN_SYSTEM.spacing.sm }}
                        />
                        <div>
                          <div style={{
                            fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                            color: DESIGN_SYSTEM.colors.text.primary,
                            fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium
                          }}>
                            {recipient.name}
                          </div>
                          <div style={{
                            fontSize: DESIGN_SYSTEM.typography.fontSize.xs,
                            color: DESIGN_SYSTEM.colors.text.tertiary
                          }}>
                            {recipient.email}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            
            {/* Selected Recipients */}
            {selectedRecipients.length > 0 && (
              <div style={{
                marginTop: DESIGN_SYSTEM.spacing.sm,
                display: "flex",
                flexWrap: "wrap",
                gap: DESIGN_SYSTEM.spacing.xs
              }}>
                {selectedRecipients.map(recipientId => {
                  const recipient = allRecipients.find(r => r.id === recipientId);
                  return (
                    <div key={recipientId} style={{
                      display: "flex",
                      alignItems: "center",
                      padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.sm}`,
                      backgroundColor: DESIGN_SYSTEM.colors.primary[100],
                      borderRadius: DESIGN_SYSTEM.borderRadius.full,
                      fontSize: DESIGN_SYSTEM.typography.fontSize.sm
                    }}>
                      <span>{recipient?.name || "Unknown"}</span>
                      <button
                        onClick={() => toggleRecipient(recipientId)}
                        style={{
                          background: "none",
                          border: "none",
                          marginLeft: DESIGN_SYSTEM.spacing.xs,
                          cursor: "pointer",
                          color: DESIGN_SYSTEM.colors.primary[700]
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: DESIGN_SYSTEM.spacing.lg,
          borderTop: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`,
          backgroundColor: DESIGN_SYSTEM.colors.background.secondary,
          display: "flex",
          justifyContent: "flex-end",
          gap: DESIGN_SYSTEM.spacing.sm
        }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: `${DESIGN_SYSTEM.spacing.sm} ${DESIGN_SYSTEM.spacing.base}`,
              border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
              borderRadius: DESIGN_SYSTEM.borderRadius.base,
              backgroundColor: DESIGN_SYSTEM.colors.background.primary,
              color: DESIGN_SYSTEM.colors.text.secondary,
              fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !requestTitle.trim() || !requestDescription.trim() || selectedRecipients.length === 0}
            style={{
              padding: `${DESIGN_SYSTEM.spacing.sm} ${DESIGN_SYSTEM.spacing.base}`,
              border: "none",
              borderRadius: DESIGN_SYSTEM.borderRadius.base,
              backgroundColor: requestType === 'Project' 
                ? DESIGN_SYSTEM.pageThemes.projects.accent
                : DESIGN_SYSTEM.pageThemes.customers.accent,
              color: DESIGN_SYSTEM.colors.text.inverse,
              fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
              fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading || !requestTitle.trim() || !requestDescription.trim() || selectedRecipients.length === 0 ? 0.6 : 1,
              minWidth: "120px"
            }}
          >
            {loading ? "Sending..." : uploading ? "Uploading..." : "Send Request"}
          </button>
        </div>
      </div>
    </div>
  );
}
