import React, { useState } from 'react';
import { db } from "../../firebase";
import { collection, query, where, getDocs, updateDoc, doc, arrayUnion, getDoc } from "firebase/firestore";
import { COLORS, LAYOUT, BUTTON_STYLES, INPUT_STYLES } from "../profile-component/constants";

export default function AddTeamMemberModal({ isOpen, onClose, projectId, onTeamMemberAdded }) {
  const [memberEmail, setMemberEmail] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleAddMember = async () => {
    setLoading(true);
    setError(null);

    if (!memberEmail.trim()) {
      setError("Please enter a team member's email.");
      setLoading(false);
      return;
    }

    try {
      // 1. Find the user by email
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", memberEmail.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError("No user found with this email.");
        setLoading(false);
        return;
      }

      const memberDoc = querySnapshot.docs[0];
      const memberUid = memberDoc.id; // User ID is the document ID

      // 2. Get the project document to check if already a member
      const projectRef = doc(db, "projects", projectId);
      const projectSnap = await getDoc(projectRef);

      if (projectSnap.exists()) {
        const projectData = projectSnap.data();
        const currentTeam = projectData.team || [];

        if (currentTeam.includes(memberUid)) {
          setError("This user is already a member of this project.");
          setLoading(false);
          return;
        }

        // 3. Add the memberUid to the project's team array
        await updateDoc(projectRef, {
          team: arrayUnion(memberUid)
        });

        alert("Team member added successfully!");
        onTeamMemberAdded(memberUid); // Notify parent component
        setMemberEmail('');
        onClose();
      } else {
        setError("Project not found.");
      }

    } catch (err) {
      console.error("Error adding team member:", err);
      setError("Failed to add team member: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <h3 style={{ color: COLORS.dark, marginBottom: LAYOUT.gap }}>Add Team Member</h3>
        <input
          type="email"
          placeholder="Team Member Email"
          value={memberEmail}
          onChange={(e) => setMemberEmail(e.target.value)}
          style={{ ...INPUT_STYLES.base, marginBottom: LAYOUT.smallGap, width: "100%" }}
          disabled={loading}
        />
        {error && <p style={{ color: COLORS.danger, marginBottom: LAYOUT.smallGap }}>{error}</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: LAYOUT.smallGap }}>
          <button onClick={onClose} style={BUTTON_STYLES.secondary} disabled={loading}>
            Cancel
          </button>
          <button onClick={handleAddMember} style={BUTTON_STYLES.primary} disabled={loading}>
            {loading ? "Adding..." : "Add Member"}
          </button>
        </div>
      </div>
    </div>
  );
}

const modalOverlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalContentStyle = {
  backgroundColor: COLORS.white,
  padding: LAYOUT.gap,
  borderRadius: LAYOUT.borderRadius,
  boxShadow: LAYOUT.shadow,
  width: "90%",
  maxWidth: "400px",
  textAlign: "left",
};
