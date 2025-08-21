import React, { useState } from 'react';
import TopBar from '../components/TopBar';
import { COLORS, BUTTON_STYLES, INPUT_STYLES, LAYOUT } from '../components/profile-component/constants';
import SignaturePad from '../components/SignaturePad'; // Import SignaturePad

export default function ApprovalList() {
  const [approvals, setApprovals] = useState([
    {
      id: 1,
      type: 'Project Proposal',
      item: 'Website Redesign for Tech Solutions Inc',
      status: 'Pending',
      requester: 'John Doe',
      date: '2024-03-10',
      message: 'Please review the attached proposal for the website redesign project. We aim to start by April 1st.',
      attachments: ['proposal_techsolutions.pdf'],
    },
    {
      id: 2,
      type: 'Budget Adjustment',
      item: 'Marketing Campaign Q2 Budget',
      status: 'Pending',
      requester: 'Jane Smith',
      date: '2024-03-08',
      message: 'Requesting an adjustment to the Q2 marketing budget to accommodate new advertising channels.',
      attachments: [],
    },
    {
      id: 3,
      type: 'Contract Renewal',
      item: 'Software License Renewal - Annual',
      status: 'Approved',
      requester: 'Mike Johnson',
      date: '2024-03-05',
      message: 'The annual software license renewal is due. Please approve for timely processing.',
      attachments: ['license_agreement_2024.pdf'],
    },
    {
      id: 4,
      type: 'New Hire Onboarding',
      item: 'Onboarding of Sarah Lee',
      status: 'Rejected',
      requester: 'Emily White',
      date: '2024-03-03',
      message: 'Approval needed for Sarah Lee\'s onboarding process and access provisioning.',
      attachments: [],
    },
  ]);
  const [signatureData, setSignatureData] = useState({}); // To store signatures for each approval item
  const [showSignaturePadFor, setShowSignaturePadFor] = useState(null); // State to control which SignaturePad is open

  const handleApprove = (id, message) => {
    // Retrieve the signature for the specific approval item
    const signature = signatureData[id] || null;

    setApprovals(approvals.map(approval =>
      approval.id === id ? { ...approval, status: 'Approved', adminMessage: message, eSignature: signature } : approval
    ));
    console.log(`Approved request ${id} with message: ${message}, signature: ${signature ? "Attached" : "None"}`);
    setSignatureData(prev => { delete prev[id]; return { ...prev }; }); // Clear signature after approval/rejection
    setShowSignaturePadFor(null); // Close signature pad after action
  };

  const handleReject = (id, message) => {
    // Retrieve the signature for the specific approval item
    const signature = signatureData[id] || null;

    setApprovals(approvals.map(approval =>
      approval.id === id ? { ...approval, status: 'Rejected', adminMessage: message, eSignature: signature } : approval
    ));
    console.log(`Rejected request ${id} with message: ${message}, signature: ${signature ? "Attached" : "None"}`);
    setSignatureData(prev => { delete prev[id]; return { ...prev }; }); // Clear signature after approval/rejection
    setShowSignaturePadFor(null); // Close signature pad after action
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
          {approvals.map(approval => (
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
              
              <h3 style={{ margin: "0", color: COLORS.dark, fontSize: "18px", fontWeight: "700" }}>{approval.type}</h3>
              <p style={{ margin: "0", color: COLORS.text, fontSize: "15px" }}><strong>Item:</strong> {approval.item}</p>
              <p style={{ margin: "0", color: COLORS.text, fontSize: "14px" }}><strong>Requester:</strong> {approval.requester}</p>
              <p style={{ margin: "0", color: COLORS.lightText, fontSize: "13px" }}><strong>Date:</strong> {approval.date}</p>
              <p style={{ margin: "0", color: COLORS.text, fontSize: "14px", flexGrow: 1 }}><strong>Message:</strong> {approval.message}</p>

              {approval.attachments.length > 0 && (
                <div style={{ fontSize: "13px", color: COLORS.primary }}>
                  <strong>Attachments:</strong> {approval.attachments.join(', ')}
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
                        width={280} // Adjusted width to fit within card
                        height={100} // Adjusted height
                      />
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "10px" }}>
                    <button 
                      onClick={() => handleApprove(approval.id, document.getElementById(`message-${approval.id}`).value)}
                      style={{ ...BUTTON_STYLES.primary, background: COLORS.success, padding: "8px 15px", fontSize: "13px" }}
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => handleReject(approval.id, document.getElementById(`message-${approval.id}`).value)}
                      style={{ ...BUTTON_STYLES.primary, background: COLORS.danger, padding: "8px 15px", fontSize: "13px" }}
                    >
                      Reject
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
          ))}
        </div>
      </div>
    </div>
  );
}
