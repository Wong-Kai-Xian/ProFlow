import React, { useState, useEffect } from 'react';
import { COLORS, LAYOUT, BUTTON_STYLES, INPUT_STYLES } from '../profile-component/constants';
import { getAcceptedTeamMembersForProject } from '../../services/teamService';
import { useAuth } from '../../contexts/AuthContext';

export default function ApprovalSelectionModal({ 
  isOpen, 
  onClose, 
  onApprove, 
  onReject,
  title = "Approval Decision",
  message = "Choose how to proceed with this approval request:",
  projectId = null,
  showTeamSelection = true 
}) {
  const [selectedAction, setSelectedAction] = useState(''); // 'approve' or 'reject'
  const [selectedTeamMembers, setSelectedTeamMembers] = useState([]);
  const [acceptedTeamMembers, setAcceptedTeamMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [adminMessage, setAdminMessage] = useState('');
  const { currentUser } = useAuth();

  // Fetch accepted team members when modal opens
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!isOpen || !currentUser || !showTeamSelection) return;
      
      setLoadingTeam(true);
      try {
        const members = await getAcceptedTeamMembersForProject(currentUser, projectId);
        setAcceptedTeamMembers(members);
      } catch (error) {
        console.error("Error fetching team members:", error);
      } finally {
        setLoadingTeam(false);
      }
    };

    fetchTeamMembers();
  }, [isOpen, currentUser, projectId, showTeamSelection]);

  // Reset form when modal closes/opens
  useEffect(() => {
    if (isOpen) {
      setSelectedAction('');
      setSelectedTeamMembers([]);
      setAdminMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTeamMemberToggle = (memberId) => {
    setSelectedTeamMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSubmit = async () => {
    if (!selectedAction) {
      alert("Please select an action (Approve or Reject)");
      return;
    }

    setLoading(true);
    try {
      const approvalData = {
        action: selectedAction,
        adminMessage: adminMessage.trim(),
        selectedTeamMembers: selectedTeamMembers,
        approvedBy: currentUser?.uid,
        approvedByName: currentUser?.name || currentUser?.email || 'Admin',
        timestamp: new Date()
      };

      if (selectedAction === 'approve') {
        await onApprove(approvalData);
      } else {
        await onReject(approvalData);
      }

      onClose();
    } catch (error) {
      console.error("Error processing approval:", error);
      alert("Failed to process approval. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000
    }}>
      <div style={{
        background: COLORS.background,
        padding: LAYOUT.gap,
        borderRadius: LAYOUT.borderRadius,
        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        width: "500px",
        maxWidth: "90%",
        maxHeight: "80vh",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: LAYOUT.smallGap,
      }}>
        <h3 style={{ margin: 0, color: COLORS.dark, fontSize: "18px", fontWeight: "600" }}>
          {title}
        </h3>
        
        <p style={{ color: COLORS.text, fontSize: "14px", lineHeight: "1.5", margin: 0 }}>
          {message}
        </p>

        {/* Action Selection */}
        <div style={{ marginTop: LAYOUT.smallGap }}>
          <label style={{ display: 'block', marginBottom: '8px', color: COLORS.dark, fontSize: '14px', fontWeight: '500' }}>
            Decision *
          </label>
          <div style={{ display: 'flex', gap: LAYOUT.smallGap }}>
            <button
              onClick={() => setSelectedAction('approve')}
              style={{
                ...BUTTON_STYLES.primary,
                backgroundColor: selectedAction === 'approve' ? COLORS.success : COLORS.light,
                color: selectedAction === 'approve' ? COLORS.white : COLORS.dark,
                border: `2px solid ${selectedAction === 'approve' ? COLORS.success : COLORS.border}`,
                flex: 1,
                padding: "10px"
              }}
            >
              ✓ Approve
            </button>
            <button
              onClick={() => setSelectedAction('reject')}
              style={{
                ...BUTTON_STYLES.primary,
                backgroundColor: selectedAction === 'reject' ? COLORS.danger : COLORS.light,
                color: selectedAction === 'reject' ? COLORS.white : COLORS.dark,
                border: `2px solid ${selectedAction === 'reject' ? COLORS.danger : COLORS.border}`,
                flex: 1,
                padding: "10px"
              }}
            >
              ✗ Reject
            </button>
          </div>
        </div>

        {/* Team Member Selection (if enabled) */}
        {showTeamSelection && (
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: COLORS.dark, fontSize: '14px', fontWeight: '500' }}>
              Notify Team Members (Optional)
            </label>
            {loadingTeam ? (
              <p style={{ color: COLORS.lightText, fontSize: "12px" }}>Loading team members...</p>
            ) : acceptedTeamMembers.length > 0 ? (
              <div style={{ 
                maxHeight: "150px", 
                overflowY: "auto", 
                border: `1px solid ${COLORS.border}`, 
                borderRadius: LAYOUT.borderRadius, 
                padding: LAYOUT.smallGap 
              }}>
                {acceptedTeamMembers.map(member => (
                  <div key={member.id} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    marginBottom: '8px',
                    padding: '4px',
                    borderRadius: '4px',
                    backgroundColor: selectedTeamMembers.includes(member.id) ? COLORS.light : 'transparent'
                  }}>
                    <input
                      type="checkbox"
                      id={`member-${member.id}`}
                      checked={selectedTeamMembers.includes(member.id)}
                      onChange={() => handleTeamMemberToggle(member.id)}
                      style={{ marginRight: '8px' }}
                    />
                    <label htmlFor={`member-${member.id}`} style={{ 
                      fontSize: '14px', 
                      color: COLORS.dark,
                      cursor: 'pointer',
                      flex: 1
                    }}>
                      {member.name} ({member.email})
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: COLORS.lightText, fontSize: "12px" }}>
                No accepted team members available for notification.
              </p>
            )}
          </div>
        )}

        {/* Admin Message */}
        <div>
          <label style={{ display: 'block', marginBottom: '8px', color: COLORS.dark, fontSize: '14px', fontWeight: '500' }}>
            Message (Optional)
          </label>
          <textarea
            value={adminMessage}
            onChange={(e) => setAdminMessage(e.target.value)}
            placeholder="Add a message about your decision..."
            style={{
              ...INPUT_STYLES.base,
              width: "100%",
              minHeight: "60px",
              resize: "vertical"
            }}
            disabled={loading}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ 
          display: "flex", 
          justifyContent: "flex-end", 
          gap: LAYOUT.smallGap, 
          marginTop: LAYOUT.smallGap,
          borderTop: `1px solid ${COLORS.border}`,
          paddingTop: LAYOUT.smallGap
        }}>
          <button 
            onClick={onClose} 
            style={BUTTON_STYLES.secondary}
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            style={{
              ...BUTTON_STYLES.primary,
              backgroundColor: selectedAction === 'approve' ? COLORS.success : 
                             selectedAction === 'reject' ? COLORS.danger : COLORS.primary
            }}
            disabled={loading || !selectedAction}
          >
            {loading ? 'Processing...' : 
             selectedAction === 'approve' ? 'Approve & Advance' : 
             selectedAction === 'reject' ? 'Reject' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
