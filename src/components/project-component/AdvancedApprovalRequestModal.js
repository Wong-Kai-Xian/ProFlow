import React, { useState, useEffect } from "react";
import { DESIGN_SYSTEM } from "../../styles/designSystem";
import { db, storage } from '../../firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
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
  const [selectedDecisionMaker, setSelectedDecisionMaker] = useState(null);
  const [selectedViewers, setSelectedViewers] = useState([]);
  const [allRecipients, setAllRecipients] = useState([]);
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploading, setUploading] = useState(false);
  const [decisionMakerSearchTerm, setDecisionMakerSearchTerm] = useState("");
  const [viewersSearchTerm, setViewersSearchTerm] = useState("");
  const [showDecisionMakerDropdown, setShowDecisionMakerDropdown] = useState(false);
  const [showViewersDropdown, setShowViewersDropdown] = useState(false);
  const [noApprovalNeeded, setNoApprovalNeeded] = useState(false);

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
          // For customers, get team members using the same logic as TeamPage
          const uniqueMemberEmails = new Set();

          // Get current user's projects
          const projectsQuery = query(
            collection(db, "projects"),
            where("userId", "==", currentUser.uid)
          );
          const projectsSnapshot = await getDocs(projectsQuery);

          // For each project, find team members
          for (const projectDoc of projectsSnapshot.docs) {
            const projectData = projectDoc.data();
            if (projectData.team && Array.isArray(projectData.team)) {
              // Get user details for team members
              const teamUids = projectData.team.filter(uid => uid !== currentUser.uid);
              if (teamUids.length > 0) {
                const chunkSize = 10;
                for (let i = 0; i < teamUids.length; i += chunkSize) {
                  const chunk = teamUids.slice(i, i + chunkSize);
                  const usersQuery = query(collection(db, "users"), where("uid", "in", chunk));
                  const usersSnapshot = await getDocs(usersQuery);
                  usersSnapshot.forEach(userDoc => {
                    const userData = userDoc.data();
                    if (userData.email) {
                      uniqueMemberEmails.add(userData.email);
                    }
                  });
                }
              }
            }
          }

          // Get accepted invitations (team members through invitations)
          const acceptedInvitationsQuery = query(
            collection(db, "invitations"),
            where("fromUserId", "==", currentUser.uid),
            where("status", "==", "accepted")
          );
          const acceptedInvitationsSnapshot = await getDocs(acceptedInvitationsQuery);
          acceptedInvitationsSnapshot.docs.forEach(invitationDoc => {
            const invitationData = invitationDoc.data();
            if (invitationData.toUserEmail) {
              uniqueMemberEmails.add(invitationData.toUserEmail);
            }
          });

          // Fetch user details for all unique member emails
          const allMemberEmails = Array.from(uniqueMemberEmails);
          if (allMemberEmails.length > 0) {
            const chunkSize = 10;
            for (let i = 0; i < allMemberEmails.length; i += chunkSize) {
              const chunk = allMemberEmails.slice(i, i + chunkSize);
              const usersQuery = query(collection(db, "users"), where("email", "in", chunk));
              const usersSnapshot = await getDocs(usersQuery);
              usersSnapshot.forEach(doc => {
                const userData = doc.data();
                recipients.push({
                  id: doc.id,
                  name: userData.name || userData.displayName || userData.email,
                  email: userData.email,
                });
              });
            }
          }
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
      setSelectedDecisionMaker(null);
      setSelectedViewers([]);
      setDecisionMakerSearchTerm("");
      setViewersSearchTerm("");
      setShowDecisionMakerDropdown(false);
      setShowViewersDropdown(false);
      setNoApprovalNeeded(false);
      
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
                  setRequestTitle(`Convert Customer "${entityName}" to Project`);
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

  const selectDecisionMaker = (recipient) => {
    setSelectedDecisionMaker(recipient);
    setDecisionMakerSearchTerm(recipient.name);
    setShowDecisionMakerDropdown(false);
  };

  const toggleViewer = (recipient) => {
    setSelectedViewers(prev => {
      const isSelected = prev.some(v => v.id === recipient.id);
      if (isSelected) {
        return prev.filter(v => v.id !== recipient.id);
      } else {
        return [...prev, recipient];
      }
    });
  };

  const removeViewer = (viewerId) => {
    setSelectedViewers(prev => prev.filter(v => v.id !== viewerId));
  };

  const filteredDecisionMakers = allRecipients.filter(recipient =>
    recipient.name.toLowerCase().includes(decisionMakerSearchTerm.toLowerCase()) ||
    recipient.email.toLowerCase().includes(decisionMakerSearchTerm.toLowerCase())
  );

  const filteredViewers = allRecipients.filter(recipient =>
    recipient.name.toLowerCase().includes(viewersSearchTerm.toLowerCase()) ||
    recipient.email.toLowerCase().includes(viewersSearchTerm.toLowerCase())
  );

  const handleSubmit = async () => {
    if (noApprovalNeeded) {
      // Bypass all validations and approvals
      try {
        if (isStageAdvancement) {
          if (projectId && nextStage) {
            await updateDoc(doc(db, 'projects', projectId), { stage: nextStage });
          }
          // Optionally handle customer stage here in future
        }
      } catch {}
      if (onSuccess) {
        onSuccess({
          type: requestType,
          entityName,
          decisionMaker: 'n/a',
          viewerCount: 0,
          title: requestTitle || `Advance ${entityName} to ${nextStage}`,
          bypassed: true,
          nextStage
        });
      }
      onClose();
      return;
    }
    if (!requestTitle.trim()) {
      alert("Please enter a request title.");
      return;
    }

    // Description optional per request

    if (!noApprovalNeeded && !selectedDecisionMaker) {
      alert("Please select a decision maker.");
      return;
    }

    // Prevent sender from making decision for themselves
    if (selectedDecisionMaker.id === currentUser.uid) {
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

      // Create a single approval request with decision maker and viewers
      const approvalRequest = await addDoc(collection(db, "approvalRequests"), {
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
          
          // Decision maker (who can approve/reject)
          requestedTo: selectedDecisionMaker.id,
          requestedToName: selectedDecisionMaker.name,
          requestedToEmail: selectedDecisionMaker.email,
          
          // Viewers (who can see but not decide)
          viewers: selectedViewers.map(viewer => viewer.id),
          viewerDetails: selectedViewers.map(viewer => ({
            id: viewer.id,
            name: viewer.name,
            email: viewer.email
          })),
          
          // Status and timing
          status: "pending",
          dateRequested: serverTimestamp(),
          dueDate: dueDate || null,
          dueTime: dueTime || null,
          
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

      // Single approval request created (no need for Promise.all)
      // Write notifications: decision maker + viewers + requester (confirmation)
      try {
        // Decision maker
        if (selectedDecisionMaker?.id) {
          await addDoc(collection(db, 'users', selectedDecisionMaker.id, 'notifications'), {
            unread: true,
            createdAt: serverTimestamp(),
            origin: 'approval',
            title: 'Approval request',
            message: `${currentUser.displayName || currentUser.email} requested your approval: ${requestTitle} (${requestType}: ${entityName})`,
            refType: 'approval',
            approvalId: approvalRequest.id,
            projectId: projectId || null,
            customerId: customerId || null
          });
        }
        // Viewers
        for (const viewer of selectedViewers) {
          try {
            await addDoc(collection(db, 'users', viewer.id, 'notifications'), {
              unread: true,
              createdAt: serverTimestamp(),
              origin: 'approval',
              title: 'Approval shared',
              message: `You were added as a viewer: ${requestTitle} (${requestType}: ${entityName})`,
              refType: 'approval',
              approvalId: approvalRequest.id,
              projectId: projectId || null,
              customerId: customerId || null
            });
          } catch {}
        }
        // Requester confirmation
        await addDoc(collection(db, 'users', currentUser.uid, 'notifications'), {
          unread: true,
          createdAt: serverTimestamp(),
          origin: 'approval',
          title: 'Approval request sent',
          message: `Sent to ${selectedDecisionMaker?.name || 'assignee'} • ${requestTitle}`,
          refType: 'approval',
          approvalId: approvalRequest.id,
          projectId: projectId || null,
          customerId: customerId || null
        });
      } catch {}

      // Success callback
      if (onSuccess) {
        onSuccess({
          type: requestType,
          entityName,
          decisionMaker: selectedDecisionMaker.name,
          viewerCount: selectedViewers.length,
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
          {/* No approval needed toggle (always at top) */}
          <div style={{
            marginBottom: DESIGN_SYSTEM.spacing.base,
            padding: DESIGN_SYSTEM.spacing.sm,
            border: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`,
            borderRadius: DESIGN_SYSTEM.borderRadius.base,
            background: DESIGN_SYSTEM.colors.background.secondary
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={noApprovalNeeded} onChange={(e) => setNoApprovalNeeded(e.target.checked)} />
              <span style={{ fontSize: DESIGN_SYSTEM.typography.fontSize.sm, color: DESIGN_SYSTEM.colors.text.primary }}>
                No approval needed ({isStageAdvancement ? 'advance immediately' : 'do not send approval'})
              </span>
            </label>
          </div>

          {!noApprovalNeeded && (
            <>
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

          {/* Request Description (optional) */}
          <div style={{ marginBottom: DESIGN_SYSTEM.spacing.base }}>
            <label style={{
              display: "block",
              marginBottom: DESIGN_SYSTEM.spacing.xs,
              fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
              fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
              color: DESIGN_SYSTEM.colors.text.primary
            }}>
              Description (optional)
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

          {/* Due Date / Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: DESIGN_SYSTEM.spacing.base, marginBottom: DESIGN_SYSTEM.spacing.base }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: DESIGN_SYSTEM.spacing.xs,
                fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
                color: DESIGN_SYSTEM.colors.text.primary
              }}>Due Date (optional)</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ width: '100%', padding: DESIGN_SYSTEM.spacing.sm, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, borderRadius: DESIGN_SYSTEM.borderRadius.base, fontSize: DESIGN_SYSTEM.typography.fontSize.sm }} />
            </div>
            <div>
              <label style={{
                display: 'block',
                marginBottom: DESIGN_SYSTEM.spacing.xs,
                fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
                color: DESIGN_SYSTEM.colors.text.primary
              }}>Due Time (optional)</label>
              <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} style={{ width: '100%', padding: DESIGN_SYSTEM.spacing.sm, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, borderRadius: DESIGN_SYSTEM.borderRadius.base, fontSize: DESIGN_SYSTEM.typography.fontSize.sm }} />
            </div>
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

          {/* Decision Maker Selection */}
          <div style={{ marginBottom: DESIGN_SYSTEM.spacing.base }}>
            <label style={{
              display: "block",
              marginBottom: DESIGN_SYSTEM.spacing.xs,
              fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
              fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
              color: DESIGN_SYSTEM.colors.text.primary
            }}>
              Select Decision Maker * (Who can approve/reject)
            </label>
            
            <div style={{ position: "relative" }}>
              <input
                type="text"
                value={decisionMakerSearchTerm}
                onChange={(e) => {
                  setDecisionMakerSearchTerm(e.target.value);
                  setShowDecisionMakerDropdown(true);
                }}
                onFocus={() => setShowDecisionMakerDropdown(true)}
                placeholder="Search for decision maker..."
                style={{
                  width: "100%",
                  padding: DESIGN_SYSTEM.spacing.sm,
                  border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                  borderRadius: DESIGN_SYSTEM.borderRadius.base,
                  fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                  outline: "none"
                }}
                disabled={loading || noApprovalNeeded}
              />
              
              {showDecisionMakerDropdown && !noApprovalNeeded && (
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
                  {filteredDecisionMakers.length === 0 ? (
                    <div style={{
                      padding: DESIGN_SYSTEM.spacing.sm,
                      color: DESIGN_SYSTEM.colors.text.tertiary,
                      textAlign: "center"
                    }}>
                      No team members found
                    </div>
                  ) : (
                    filteredDecisionMakers.map(recipient => (
                      <div
                        key={recipient.id}
                        onClick={() => selectDecisionMaker(recipient)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: DESIGN_SYSTEM.spacing.sm,
                          cursor: "pointer",
                          backgroundColor: selectedDecisionMaker?.id === recipient.id
                            ? DESIGN_SYSTEM.colors.primary[50]
                            : "transparent",
                          borderBottom: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`
                        }}
                      >
                        <input
                          type="radio"
                          checked={selectedDecisionMaker?.id === recipient.id}
                          onChange={() => selectDecisionMaker(recipient)}
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
            
            {/* Selected Decision Maker */}
            {selectedDecisionMaker && !noApprovalNeeded && (
              <div style={{
                marginTop: DESIGN_SYSTEM.spacing.sm,
                padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.sm}`,
                backgroundColor: DESIGN_SYSTEM.colors.success + '20',
                borderRadius: DESIGN_SYSTEM.borderRadius.base,
                border: `1px solid ${DESIGN_SYSTEM.colors.success}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}>
                <div>
                  <div style={{
                    fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                    fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
                    color: DESIGN_SYSTEM.colors.text.primary
                  }}>
                    {selectedDecisionMaker.name}
                  </div>
                  <div style={{
                    fontSize: DESIGN_SYSTEM.typography.fontSize.xs,
                    color: DESIGN_SYSTEM.colors.text.secondary
                  }}>
                    Decision Maker
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedDecisionMaker(null);
                    setDecisionMakerSearchTerm("");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: DESIGN_SYSTEM.colors.text.secondary,
                    cursor: "pointer",
                    fontSize: "16px",
                    padding: "0",
                    lineHeight: 1
                  }}
                >
                  ×
                </button>
              </div>
            )}
          </div>
            </>
          )}
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
            disabled={loading || (!noApprovalNeeded && (!requestTitle.trim() || !selectedDecisionMaker))}
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
              opacity: loading || (!noApprovalNeeded && (!requestTitle.trim() || !selectedDecisionMaker)) ? 0.6 : 1,
              minWidth: "120px"
            }}
          >
            {noApprovalNeeded ? (loading ? "Advancing..." : "Advance Stage") : (loading ? "Sending..." : uploading ? "Uploading..." : "Send Request")}
          </button>
        </div>
      </div>
    </div>
  );
}
