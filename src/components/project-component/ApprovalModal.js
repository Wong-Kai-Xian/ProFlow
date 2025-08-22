import React from 'react';
import ApprovalSelectionModal from './ApprovalSelectionModal';

export default function ApprovalModal({ isOpen, onClose, onConfirm, projectId }) {
  const handleApprove = async (approvalData) => {
    // Call the original onConfirm with additional data
    await onConfirm(approvalData);
  };

  const handleReject = async (approvalData) => {
    // For stage advancement, reject means don't advance
    console.log("Stage advancement rejected:", approvalData);
    onClose();
  };

  return (
    <ApprovalSelectionModal
      isOpen={isOpen}
      onClose={onClose}
      onApprove={handleApprove}
      onReject={handleReject}
      title="Advance Stage Approval"
      message="Are you sure you want to advance to the next stage? All tasks in the current stage must be complete. You can notify selected team members about this decision."
      projectId={projectId}
      showTeamSelection={true}
    />
  );
}
