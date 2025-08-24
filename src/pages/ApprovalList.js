import React, { useState, useEffect } from 'react';
import TopBar from '../components/TopBar';
import { DESIGN_SYSTEM, getButtonStyle, getPageContainerStyle, getContentContainerStyle } from '../styles/designSystem';
import SignaturePad from '../components/SignaturePad'; // Import SignaturePad
import { db, storage } from '../firebase'; // Import db and storage
import { collection, query, orderBy, onSnapshot, doc, updateDoc, where } from "firebase/firestore"; // Import Firestore functions
import { ref, uploadString, getDownloadURL } from "firebase/storage"; // Import Storage functions for signature
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

export default function ApprovalList() {
  const [approvals, setApprovals] = useState([]); // Initialize as empty array, will be populated from Firebase
  const [signatureData, setSignatureData] = useState({}); // To store signatures for each approval item
  const [showSignaturePadFor, setShowSignaturePadFor] = useState(null); // State to control which SignaturePad is open
  const [loadingSignatures, setLoadingSignatures] = useState({}); // Track loading state for each signature
  const { currentUser } = useAuth(); // Get currentUser from AuthContext

  // Fetch approvals from Firebase in real-time
  useEffect(() => {
    if (!currentUser) {
      setApprovals([]);
      return;
    }

    const q = query(collection(db, "approvalRequests"), where("requestedByUid", "==", currentUser.uid), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const approvalsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convert Firebase Timestamp to JS Date for consistent display
        date: doc.data().timestamp?.toDate().toLocaleDateString() || 'N/A',
        time: doc.data().timestamp?.toDate().toLocaleTimeString() || 'N/A',
        // Ensure status is capitalized for display
        status: doc.data().status.charAt(0).toUpperCase() + doc.data().status.slice(1),
      }));
      setApprovals(approvalsData);
    });

    return () => unsubscribe();
  }, [currentUser]); // Add currentUser to dependency array

  const handleApprove = async (id, message) => {
    setLoadingSignatures(prev => ({ ...prev, [id]: true }));
    try {
      let signatureUrl = signatureData[id] || '';
      if (signatureData[id] && signatureData[id].startsWith('data:image')) { // Check if it's a new base64 signature
        const signatureRef = ref(storage, `signatures/${id}_${Date.now()}.png`);
        await uploadString(signatureRef, signatureData[id], 'data_url');
        signatureUrl = await getDownloadURL(signatureRef);
      }

      const approvalRef = doc(db, "approvalRequests", id);
      await updateDoc(approvalRef, {
        status: 'approved',
        adminMessage: message,
        eSignature: signatureUrl,
      });
      setSignatureData(prev => { delete prev[id]; return { ...prev }; });
      setShowSignaturePadFor(null);
    } catch (error) {
      console.error("Error approving request:", error);
      alert("Failed to approve request.");
    } finally {
      setLoadingSignatures(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleReject = async (id, message) => {
    setLoadingSignatures(prev => ({ ...prev, [id]: true }));
    try {
      let signatureUrl = signatureData[id] || '';
      if (signatureData[id] && signatureData[id].startsWith('data:image')) { // Check if it's a new base64 signature
        const signatureRef = ref(storage, `signatures/${id}_${Date.now()}.png`);
        await uploadString(signatureRef, signatureData[id], 'data_url');
        signatureUrl = await getDownloadURL(signatureRef);
      }

      const approvalRef = doc(db, "approvalRequests", id);
      await updateDoc(approvalRef, {
        status: 'rejected',
        adminMessage: message,
        eSignature: signatureUrl,
      });
      setSignatureData(prev => { delete prev[id]; return { ...prev }; });
      setShowSignaturePadFor(null);
    } catch (error) {
      console.error("Error rejecting request:", error);
      alert("Failed to reject request.");
    } finally {
      setLoadingSignatures(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleSaveSignature = (id, dataURL) => {
    setSignatureData(prev => ({ ...prev, [id]: dataURL }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return DESIGN_SYSTEM.colors.warning;
      case 'Approved': return DESIGN_SYSTEM.colors.success;
      case 'Rejected': return DESIGN_SYSTEM.colors.error;
      default: return DESIGN_SYSTEM.colors.text.secondary;
    }
  };

  const handleDownloadAttachment = async (fileUrl, fileName) => {
    if (fileUrl) {
      try {
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || 'attachment';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Error downloading file:", error);
        alert("Failed to download file.");
      }
    } else {
      alert("No file URL provided.");
    }
  };

  return (
    <div style={getPageContainerStyle()}>
      <TopBar />
      <div style={{ ...getContentContainerStyle(), paddingTop: DESIGN_SYSTEM.spacing['2xl'], maxWidth: '1200px' }}>
        <div style={{
          background: DESIGN_SYSTEM.colors.background.primary,
          borderRadius: DESIGN_SYSTEM.borderRadius.lg,
          padding: DESIGN_SYSTEM.spacing.lg,
          boxShadow: DESIGN_SYSTEM.shadows.sm,
          marginBottom: DESIGN_SYSTEM.spacing.lg
        }}>
          <h1 style={{ color: DESIGN_SYSTEM.colors.text.primary, margin: 0, fontSize: DESIGN_SYSTEM.typography.fontSize["2xl"], fontWeight: DESIGN_SYSTEM.typography.fontWeight.bold }}>Approval Requests</h1>
          <p style={{ margin: `${DESIGN_SYSTEM.spacing.xs} 0 0 0`, color: DESIGN_SYSTEM.colors.text.secondary, fontSize: DESIGN_SYSTEM.typography.fontSize.base }}>Your created approvals with e-signature capability</p>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: DESIGN_SYSTEM.spacing.lg }}>
          {!currentUser ? (
            <p style={{ color: DESIGN_SYSTEM.colors.error, fontSize: DESIGN_SYSTEM.typography.fontSize.base, gridColumn: "1 / -1", textAlign: "center" }}>Please log in to view and manage approval requests.</p>
          ) : approvals.length === 0 ? (
            <p style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontSize: DESIGN_SYSTEM.typography.fontSize.base, gridColumn: "1 / -1", textAlign: "center" }}>No approval requests found.</p>
          ) : (
            approvals.map(approval => (
              <div key={approval.id} style={{
                backgroundColor: DESIGN_SYSTEM.colors.background.primary,
                borderRadius: DESIGN_SYSTEM.borderRadius.lg,
                padding: DESIGN_SYSTEM.spacing.lg,
                boxShadow: DESIGN_SYSTEM.shadows.sm,
                border: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`,
                display: "flex",
                flexDirection: "column",
                gap: DESIGN_SYSTEM.spacing.base,
                position: "relative",
              }}>
                <div style={{
                  position: "absolute",
                  top: DESIGN_SYSTEM.spacing.base,
                  right: DESIGN_SYSTEM.spacing.base,
                  padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.sm}`,
                  borderRadius: DESIGN_SYSTEM.borderRadius.base,
                  backgroundColor: `${getStatusColor(approval.status)}20`,
                  color: getStatusColor(approval.status),
                  fontSize: DESIGN_SYSTEM.typography.fontSize.xs,
                  fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold,
                }}>
                  {approval.status}
                </div>
                
                <h3 style={{ margin: 0, color: DESIGN_SYSTEM.colors.text.primary, fontSize: DESIGN_SYSTEM.typography.fontSize.lg, fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold }}>
                  Project: {approval.projectName} - Stage: {approval.status}
                </h3>
                <p style={{ margin: 0, color: DESIGN_SYSTEM.colors.text.primary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}><strong>Requested By:</strong> {approval.requestedByName}</p>
                <p style={{ margin: 0, color: DESIGN_SYSTEM.colors.text.secondary, fontSize: DESIGN_SYSTEM.typography.fontSize.xs }}>
                  <strong>Date:</strong> {approval.date} at {approval.time}
                </p>
                <p style={{ margin: 0, color: DESIGN_SYSTEM.colors.text.secondary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, flexGrow: 1 }}><strong>Message:</strong> {approval.message}</p>

                {approval.fileUrl && (
                  <div style={{ fontSize: DESIGN_SYSTEM.typography.fontSize.sm, color: DESIGN_SYSTEM.colors.primary[600], display: "flex", alignItems: "center", gap: DESIGN_SYSTEM.spacing.xs }}>
                    <strong>Attachment:</strong> {approval.fileName}
                    <button 
                      onClick={() => handleDownloadAttachment(approval.fileUrl, approval.fileName)}
                      style={{ ...getButtonStyle('secondary','approvals'), padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.sm}`, fontSize: DESIGN_SYSTEM.typography.fontSize.xs }}
                    >
                      Download
                    </button>
                  </div>
                )}

                {approval.status === 'Pending' && (
                  <div style={{ display: "flex", gap: DESIGN_SYSTEM.spacing.sm, marginTop: DESIGN_SYSTEM.spacing.sm, flexDirection: "column" }}>
                    <textarea 
                      placeholder="Add message for approval/rejection..." 
                      style={{ flexGrow: 1, minHeight: "60px", fontSize: DESIGN_SYSTEM.typography.fontSize.sm, padding: DESIGN_SYSTEM.spacing.sm, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, borderRadius: DESIGN_SYSTEM.borderRadius.base, outline: 'none' }} 
                      id={`message-${approval.id}`}
                    />
                    
                    <button 
                      onClick={() => setShowSignaturePadFor(showSignaturePadFor === approval.id ? null : approval.id)} // Toggle signature pad visibility
                      style={{ ...getButtonStyle('secondary','approvals'), padding: `${DESIGN_SYSTEM.spacing.sm} ${DESIGN_SYSTEM.spacing.base}`, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, marginTop: DESIGN_SYSTEM.spacing.xs }}
                    >
                      {showSignaturePadFor === approval.id ? "Hide E-Signature" : "Add E-Signature"}
                    </button>

                    {showSignaturePadFor === approval.id && (
                      <div style={{ marginTop: "10px" }}>
                        <p style={{ margin: 0, marginBottom: DESIGN_SYSTEM.spacing.xs, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, color: DESIGN_SYSTEM.colors.text.primary }}>Draw E-Signature:</p>
                        <SignaturePad
                          onSave={(dataURL) => handleSaveSignature(approval.id, dataURL)}
                          width={280}
                          height={100}
                          clearButtonText="Clear Signature"
                          saveButtonText="Save Signature"
                        />
                      </div>
                    )}

                    <div style={{ display: "flex", gap: DESIGN_SYSTEM.spacing.sm, justifyContent: "flex-end", marginTop: DESIGN_SYSTEM.spacing.sm }}>
                      <button 
                        onClick={() => handleApprove(approval.id, document.getElementById(`message-${approval.id}`).value)}
                        style={{ ...getButtonStyle('secondary','approvals'), background: DESIGN_SYSTEM.colors.success, color: DESIGN_SYSTEM.colors.text.inverse, border: 'none', padding: `${DESIGN_SYSTEM.spacing.sm} ${DESIGN_SYSTEM.spacing.base}`, fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}
                        disabled={loadingSignatures[approval.id]} // Disable during signature upload
                      >
                        {loadingSignatures[approval.id] ? 'Approving...' : 'Approve'}
                      </button>
                      <button 
                        onClick={() => handleReject(approval.id, document.getElementById(`message-${approval.id}`).value)}
                        style={{ ...getButtonStyle('secondary','approvals'), background: DESIGN_SYSTEM.colors.error, color: DESIGN_SYSTEM.colors.text.inverse, border: 'none', padding: `${DESIGN_SYSTEM.spacing.sm} ${DESIGN_SYSTEM.spacing.base}`, fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}
                        disabled={loadingSignatures[approval.id]} // Disable during signature upload
                      >
                        {loadingSignatures[approval.id] ? 'Rejecting...' : 'Reject'}
                      </button>
                    </div>
                  </div>
                )}
                 {approval.adminMessage && (
                  <p style={{ margin: 0, color: DESIGN_SYSTEM.colors.text.secondary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, fontStyle: "italic", borderLeft: `3px solid ${DESIGN_SYSTEM.colors.secondary[200]}`, paddingLeft: DESIGN_SYSTEM.spacing.sm }}>
                    <strong>Admin Message:</strong> {approval.adminMessage}
                  </p>
                )}
                 {approval.eSignature && (
                  <div style={{ marginTop: DESIGN_SYSTEM.spacing.sm, borderLeft: `3px solid ${DESIGN_SYSTEM.colors.secondary[200]}`, paddingLeft: DESIGN_SYSTEM.spacing.sm }}>
                    <p style={{ margin: 0, marginBottom: DESIGN_SYSTEM.spacing.xs, color: DESIGN_SYSTEM.colors.text.secondary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, fontStyle: "italic" }}>
                      <strong>E-Signature:</strong>
                    </p>
                    <img src={approval.eSignature} alt="e-signature" style={{ maxWidth: "100%", height: "auto", border: `1px dashed ${DESIGN_SYSTEM.colors.secondary[300]}` }} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
