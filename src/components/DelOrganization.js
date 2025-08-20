import React, { useState } from "react";
import { COLORS, LAYOUT, BUTTON_STYLES, INPUT_STYLES, CARD_STYLES } from "./profile-component/constants";
import DeleteConfirmationModal from "./profile-component/DeleteConfirmationModal"; // Import the new modal

export default function DelOrganization({ organizations, onDelete, onClose }) {
  const [selectedOrg, setSelectedOrg] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false); // New state for confirmation modal

  // availableOrgs is already derived from organizations prop

  const handleSelect = (e) => {
    setSelectedOrg(e.target.value);
  };

  const handleDelete = () => {
    if (selectedOrg) {
      setShowConfirmModal(true); // Show confirmation modal
    } else {
      alert("Please select an organization to delete."); // Basic validation
    }
  };

  const handleConfirmDelete = () => {
    if (selectedOrg) {
      onDelete(selectedOrg);
    }
    setShowConfirmModal(false);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(0,0,0,0.4)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999
      }}
    >
      <div
        style={{
          ...CARD_STYLES.base,
          width: "90%",
          maxWidth: "400px",
          boxSizing: "border-box", // Ensure proper box model
        }}
      >
        <h2 style={{ marginBottom: LAYOUT.smallGap, color: COLORS.text }}>Delete Organization</h2>
        <select
          value={selectedOrg}
          onChange={handleSelect}
          style={{
            ...INPUT_STYLES.base,
            width: "100%",
            marginBottom: LAYOUT.smallGap,
            boxSizing: "border-box",
            height: "38px", // Standard height for input fields
            appearance: "none", // Remove default select arrow
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='${encodeURIComponent(COLORS.text)}'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`, // Custom arrow
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 12px center",
            paddingRight: "30px", // Make space for arrow
          }}
        >
          <option value="">-- Select an organization --</option>
          {organizations.map((org, index) => (
            <option key={index} value={org.name}>
              {org.name}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: LAYOUT.smallGap }}>
          <button onClick={onClose} style={{ ...BUTTON_STYLES.secondary }}>
            Cancel
          </button>
          <button
            onClick={handleDelete}
            style={{ ...BUTTON_STYLES.primary, background: COLORS.danger }}
          >
            Delete
          </button>
        </div>
      </div>
      {showConfirmModal && (
        <DeleteConfirmationModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onDeleteConfirm={handleConfirmDelete}
          itemToDelete={selectedOrg}
          message={`Are you sure you want to delete the organization "${selectedOrg}" and all its associated clients? This action cannot be undone.`}
        />
      )}
    </div>
  );
}
