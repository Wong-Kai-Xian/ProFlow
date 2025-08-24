import React, { useState, useEffect } from 'react';
import { DESIGN_SYSTEM, getButtonStyle } from '../../styles/designSystem';
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
        background: DESIGN_SYSTEM.colors.background.primary,
        padding: DESIGN_SYSTEM.spacing.lg,
        borderRadius: DESIGN_SYSTEM.borderRadius.lg,
        boxShadow: DESIGN_SYSTEM.shadows.xl,
        width: "540px",
        maxWidth: "92%",
        maxHeight: "80vh",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: DESIGN_SYSTEM.spacing.base,
      }}>
        <h3 style={{ margin: 0, color: DESIGN_SYSTEM.colors.text.primary, fontSize: DESIGN_SYSTEM.typography.fontSize.lg, fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold }}>
          {title}
        </h3>
        
        <p style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, lineHeight: 1.6, margin: 0 }}>
          {message}
        </p>

        {/* Action Selection */}
        <div style={{ marginTop: DESIGN_SYSTEM.spacing.base }}>
          <label style={{ display: 'block', marginBottom: DESIGN_SYSTEM.spacing.xs, color: DESIGN_SYSTEM.colors.text.primary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium }}>
            Decision *
          </label>
          <div style={{ display: 'flex', gap: DESIGN_SYSTEM.spacing.sm }}>
            <button
              onClick={() => setSelectedAction('approve')}
              style={{
                ...getButtonStyle('secondary','projects'),
                backgroundColor: selectedAction === 'approve' ? DESIGN_SYSTEM.colors.success : DESIGN_SYSTEM.colors.background.secondary,
                color: selectedAction === 'approve' ? DESIGN_SYSTEM.colors.text.inverse : DESIGN_SYSTEM.colors.text.primary,
                border: selectedAction === 'approve' ? 'none' : `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                flex: 1,
                padding: DESIGN_SYSTEM.spacing.sm
              }}
            >
              Approve
            </button>
            <button
              onClick={() => setSelectedAction('reject')}
              style={{
                ...getButtonStyle('secondary','projects'),
                backgroundColor: selectedAction === 'reject' ? DESIGN_SYSTEM.colors.error : DESIGN_SYSTEM.colors.background.secondary,
                color: selectedAction === 'reject' ? DESIGN_SYSTEM.colors.text.inverse : DESIGN_SYSTEM.colors.text.primary,
                border: selectedAction === 'reject' ? 'none' : `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                flex: 1,
                padding: DESIGN_SYSTEM.spacing.sm
              }}
            >
              Reject
            </button>
          </div>
        </div>

        {/* Team Member Selection (if enabled) */}
        {showTeamSelection && (
          <div>
            <label style={{ display: 'block', marginBottom: DESIGN_SYSTEM.spacing.xs, color: DESIGN_SYSTEM.colors.text.primary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium }}>
              Notify Team Members (Optional)
            </label>
            {loadingTeam ? (
              <p style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontSize: DESIGN_SYSTEM.typography.fontSize.xs }}>Loading team members...</p>
            ) : acceptedTeamMembers.length > 0 ? (
              <div style={{ 
                maxHeight: "150px", 
                overflowY: "auto", 
                border: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`, 
                borderRadius: DESIGN_SYSTEM.borderRadius.base, 
                padding: DESIGN_SYSTEM.spacing.sm 
              }}>
                {acceptedTeamMembers.map(member => (
                  <div key={member.id} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    marginBottom: DESIGN_SYSTEM.spacing.xs,
                    padding: DESIGN_SYSTEM.spacing.xs,
                    borderRadius: DESIGN_SYSTEM.borderRadius.sm,
                    backgroundColor: selectedTeamMembers.includes(member.id) ? DESIGN_SYSTEM.colors.background.secondary : 'transparent'
                  }}>
                    <input
                      type="checkbox"
                      id={`member-${member.id}`}
                      checked={selectedTeamMembers.includes(member.id)}
                      onChange={() => handleTeamMemberToggle(member.id)}
                      style={{ marginRight: DESIGN_SYSTEM.spacing.xs }}
                    />
                    <label htmlFor={`member-${member.id}`} style={{ 
                      fontSize: DESIGN_SYSTEM.typography.fontSize.sm, 
                      color: DESIGN_SYSTEM.colors.text.primary,
                      cursor: 'pointer',
                      flex: 1
                    }}>
                      {member.name} ({member.email})
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontSize: DESIGN_SYSTEM.typography.fontSize.xs }}>
                No accepted team members available for notification.
              </p>
            )}
          </div>
        )}

        {/* Admin Message */}
        <div>
          <label style={{ display: 'block', marginBottom: DESIGN_SYSTEM.spacing.xs, color: DESIGN_SYSTEM.colors.text.primary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium }}>
            Message (Optional)
          </label>
          <textarea
            value={adminMessage}
            onChange={(e) => setAdminMessage(e.target.value)}
            placeholder="Add a message about your decision..."
            style={{
              width: "100%",
              minHeight: "60px",
              resize: "vertical",
              padding: DESIGN_SYSTEM.spacing.sm,
              border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
              borderRadius: DESIGN_SYSTEM.borderRadius.base,
              outline: 'none',
              fontSize: DESIGN_SYSTEM.typography.fontSize.sm
            }}
            disabled={loading}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ 
          display: "flex", 
          justifyContent: "flex-end", 
          gap: DESIGN_SYSTEM.spacing.sm, 
          marginTop: DESIGN_SYSTEM.spacing.sm,
          borderTop: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`,
          paddingTop: DESIGN_SYSTEM.spacing.sm
        }}>
          <button 
            onClick={onClose} 
            style={getButtonStyle('secondary','projects')}
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            style={{
              ...getButtonStyle('secondary','projects'),
              backgroundColor: selectedAction === 'approve' ? DESIGN_SYSTEM.colors.success : 
                             selectedAction === 'reject' ? DESIGN_SYSTEM.colors.error : DESIGN_SYSTEM.colors.primary[600],
              color: DESIGN_SYSTEM.colors.text.inverse,
              border: 'none'
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
