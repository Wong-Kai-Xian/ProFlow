import React, { useState, useEffect } from 'react';
import TopBar from '../components/TopBar';
import { COLORS, BUTTON_STYLES, INPUT_STYLES, LAYOUT } from '../components/profile-component/constants';
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
      case 'Pending': return COLORS.warning;
      case 'Approved': return COLORS.success;
      case 'Rejected': return COLORS.danger;
      default: return COLORS.lightText;
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
    <div style={{ 
      fontFamily: "Arial, sans-serif", 
      background: COLORS.background, 
      minHeight: "100vh" 
    }}>
      <TopBar />
      <div style={{
        padding: "30px",
        maxWidth: "1200px",
        margin: "0 auto",
      }}>
        <h1 style={{ color: COLORS.dark, marginBottom: "30px" }}>Approval Requests</h1>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "25px" }}>
          {!currentUser ? (
            <p style={{ color: COLORS.danger, fontSize: "18px", gridColumn: "1 / -1", textAlign: "center" }}>Please log in to view and manage approval requests.</p>
          ) : approvals.length === 0 ? (
            <p style={{ color: COLORS.text, fontSize: "16px", gridColumn: "1 / -1", textAlign: "center" }}>No approval requests found.</p>
          ) : (
            approvals.map(approval => (
              <div key={approval.id} style={{
                backgroundColor: COLORS.white,
                borderRadius: "12px",
                padding: "25px",
                boxShadow: "0 4px 15px rgba(0, 0, 0, 0.08)",
                border: `1px solid ${COLORS.border}`,
                display: "flex",
                flexDirection: "column",
                gap: "15px",
                position: "relative",
              }}>
                <div style={{
                  position: "absolute",
                  top: "15px",
                  right: "15px",
                  padding: "5px 10px",
                  borderRadius: "8px",
                  backgroundColor: `${getStatusColor(approval.status)}20`,
                  color: getStatusColor(approval.status),
                  fontSize: "12px",
                  fontWeight: "600",
                }}>
                  {approval.status}
                </div>
                
                <h3 style={{ margin: "0", color: COLORS.dark, fontSize: "18px", fontWeight: "700" }}>
                  Project: {approval.projectName} - Stage: {approval.status}
                </h3>
                <p style={{ margin: "0", color: COLORS.text, fontSize: "15px" }}><strong>Requested By:</strong> {approval.requestedByName}</p>
                <p style={{ margin: "0", color: COLORS.lightText, fontSize: "13px" }}>
                  <strong>Date:</strong> {approval.date} at {approval.time}
                </p>
                <p style={{ margin: "0", color: COLORS.text, fontSize: "14px", flexGrow: 1 }}><strong>Message:</strong> {approval.message}</p>

                {approval.fileUrl && (
                  <div style={{ fontSize: "13px", color: COLORS.primary, display: "flex", alignItems: "center", gap: "8px" }}>
                    <strong>Attachment:</strong> {approval.fileName}
                    <button 
                      onClick={() => handleDownloadAttachment(approval.fileUrl, approval.fileName)}
                      style={{ ...BUTTON_STYLES.secondary, padding: "5px 10px", fontSize: "12px" }}
                    >
                      Download
                    </button>
                  </div>
                )}

                {approval.status === 'Pending' && (
                  <div style={{ display: "flex", gap: "10px", marginTop: "10px", flexDirection: "column" }}>
                    <textarea 
                      placeholder="Add message for approval/rejection..." 
                      style={{ ...INPUT_STYLES.base, flexGrow: 1, minHeight: "60px", fontSize: "14px" }} 
                      id={`message-${approval.id}`}
                    />
                    
                    <button 
                      onClick={() => setShowSignaturePadFor(showSignaturePadFor === approval.id ? null : approval.id)} // Toggle signature pad visibility
                      style={{ 
                        ...BUTTON_STYLES.secondary, 
                        padding: "8px 15px", 
                        fontSize: "13px", 
                        marginTop: "10px" 
                      }}
                    >
                      {showSignaturePadFor === approval.id ? "Hide E-Signature" : "Add E-Signature"}
                    </button>

                    {showSignaturePadFor === approval.id && (
                      <div style={{ marginTop: "10px" }}>
                        <p style={{ margin: "0 0 5px 0", fontSize: "14px", color: COLORS.dark }}>Draw E-Signature:</p>
                        <SignaturePad
                          onSave={(dataURL) => handleSaveSignature(approval.id, dataURL)}
                          width={280}
                          height={100}
                          clearButtonText="Clear Signature"
                          saveButtonText="Save Signature"
                        />
                      </div>
                    )}

                    <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "10px" }}>
                      <button 
                        onClick={() => handleApprove(approval.id, document.getElementById(`message-${approval.id}`).value)}
                        style={{ ...BUTTON_STYLES.primary, background: COLORS.success, padding: "8px 15px", fontSize: "13px" }}
                        disabled={loadingSignatures[approval.id]} // Disable during signature upload
                      >
                        {loadingSignatures[approval.id] ? 'Approving...' : 'Approve'}
                      </button>
                      <button 
                        onClick={() => handleReject(approval.id, document.getElementById(`message-${approval.id}`).value)}
                        style={{ ...BUTTON_STYLES.primary, background: COLORS.danger, padding: "8px 15px", fontSize: "13px" }}
                        disabled={loadingSignatures[approval.id]} // Disable during signature upload
                      >
                        {loadingSignatures[approval.id] ? 'Rejecting...' : 'Reject'}
                      </button>
                    </div>
                  </div>
                )}
                 {approval.adminMessage && (
                  <p style={{ margin: "0", color: COLORS.text, fontSize: "13px", fontStyle: "italic", borderLeft: `3px solid ${COLORS.lightBorder}`, paddingLeft: "10px" }}>
                    <strong>Admin Message:</strong> {approval.adminMessage}
                  </p>
                )}
                 {approval.eSignature && (
                  <div style={{ marginTop: "10px", borderLeft: `3px solid ${COLORS.lightBorder}`, paddingLeft: "10px" }}>
                    <p style={{ margin: "0 0 5px 0", color: COLORS.text, fontSize: "13px", fontStyle: "italic" }}>
                      <strong>E-Signature:</strong>
                    </p>
                    <img src={approval.eSignature} alt="e-signature" style={{ maxWidth: "100%", height: "auto", border: `1px dashed ${COLORS.border}` }} />
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
