import React, { useState, useEffect } from 'react';
import { db } from "../../firebase";
import { collection, query, where, getDocs, updateDoc, doc, arrayUnion, getDoc } from "firebase/firestore";
import { COLORS, LAYOUT, BUTTON_STYLES, INPUT_STYLES } from "../profile-component/constants";
import { getAcceptedTeamMembersForProject } from "../../services/teamService";
import { useAuth } from "../../contexts/AuthContext";

export default function AddTeamMemberModal({ isOpen, onClose, projectId, onTeamMemberAdded }) {
  const [memberEmail, setMemberEmail] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const { currentUser } = useAuth();

  // Fetch accepted team members when modal opens
  useEffect(() => {
    const fetchAvailableUsers = async () => {
      if (!isOpen || !currentUser) return;
      
      setLoadingUsers(true);
      try {
        // Get current project team to exclude them
        const projectRef = doc(db, "projects", projectId);
        const projectSnap = await getDoc(projectRef);
        const currentTeam = projectSnap.exists() ? (projectSnap.data().team || []) : [];
        const projectCreatorId = projectSnap.exists() ? projectSnap.data().userId : null;
        
        // Get accepted team members only
        const acceptedMembers = await getAcceptedTeamMembersForProject(currentUser, projectId);
        
        // Filter out users already on the team and project creator
        const availableMembers = acceptedMembers.filter(member => 
          !currentTeam.includes(member.id) && member.id !== projectCreatorId
        );
        
        setAvailableUsers(availableMembers);
      } catch (error) {
        console.error("Error fetching accepted team members:", error);
        setError("Failed to load accepted team members.");
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchAvailableUsers();
  }, [isOpen, projectId, currentUser]);

  if (!isOpen) return null;

  const handleAddMember = async () => {
    setLoading(true);
    setError(null);
    let success = false;

    // Check if user selected from dropdown or entered email
    let memberUid = selectedUserId;
    
    if (!memberUid && memberEmail.trim()) {
      // Fallback to email lookup if no dropdown selection
      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", memberEmail.trim()));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          setError("No user found with this email.");
          setLoading(false);
          return false;
        }

        const memberDoc = querySnapshot.docs[0];
        memberUid = memberDoc.data().uid || memberDoc.id;
      } catch (emailError) {
        setError("Error finding user by email.");
        setLoading(false);
        return false;
      }
    }

    if (!memberUid) {
      setError("Please select a user or enter an email.");
      setLoading(false);
      return false;
    }

    try {

      // 2. Get the project document to check if already a member
      const projectRef = doc(db, "projects", projectId);
      const projectSnap = await getDoc(projectRef);

      if (projectSnap.exists()) {
        const projectData = projectSnap.data();
        const currentTeam = projectData.team || [];

        if (currentTeam.includes(memberUid)) {
          setError("This user is already a member of this project.");
          setLoading(false);
          return false;
        }

        // 3. Add the memberUid to the project's team array
        await updateDoc(projectRef, {
          team: arrayUnion(memberUid)
        });

        onTeamMemberAdded(memberUid); // Notify parent component
        setMemberEmail('');
        setSelectedUserId('');
        success = true;
        onClose();
      } else {
        setError("Project not found.");
      }

    } catch (err) {
      console.error("Error adding team member:", err);
      setError("Failed to add team member: " + err.message);
    } finally {
      setLoading(false);
      return success;
    }
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <h3 style={{ color: COLORS.dark, marginBottom: LAYOUT.gap }}>Add Team Member</h3>
        
        {loadingUsers ? (
          <p style={{ color: COLORS.lightText, marginBottom: LAYOUT.smallGap }}>Loading accepted team members...</p>
        ) : (
          <>
            {/* User Selection Dropdown */}
            <div style={{ marginBottom: LAYOUT.smallGap }}>
              <label style={{ display: 'block', marginBottom: '4px', color: COLORS.dark, fontSize: '14px', fontWeight: '500' }}>
                Select Accepted Team Member
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => {
                  setSelectedUserId(e.target.value);
                  setMemberEmail(''); // Clear email when selecting from dropdown
                }}
                style={{ ...INPUT_STYLES.base, width: "100%" }}
                disabled={loading}
              >
                <option value="">-- Select from accepted team --</option>
                {availableUsers.length > 0 ? (
                  availableUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))
                ) : (
                  <option value="" disabled>No accepted team members available</option>
                )}
              </select>
              {availableUsers.length === 0 && !loadingUsers && (
                <p style={{ color: COLORS.lightText, fontSize: '12px', marginTop: '4px' }}>
                  No accepted team members available. Send invitations from the Team page first.
                </p>
              )}
            </div>

            {/* OR separator */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              margin: `${LAYOUT.smallGap} 0`,
              color: COLORS.lightText,
              fontSize: '12px'
            }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: COLORS.border }}></div>
              <span style={{ margin: '0 10px' }}>OR</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: COLORS.border }}></div>
            </div>

            {/* Email Input */}
            <div style={{ marginBottom: LAYOUT.smallGap }}>
              <label style={{ display: 'block', marginBottom: '4px', color: COLORS.dark, fontSize: '14px', fontWeight: '500' }}>
                Enter Email
              </label>
              <input
                type="email"
                placeholder="user@example.com"
                value={memberEmail}
                onChange={(e) => {
                  setMemberEmail(e.target.value);
                  setSelectedUserId(''); // Clear selection when typing email
                }}
                style={{ ...INPUT_STYLES.base, width: "100%", maxWidth: "100%" }}
                disabled={loading}
              />
            </div>
          </>
        )}
        
        {error && <p style={{ color: COLORS.danger, marginBottom: LAYOUT.smallGap }}>{error}</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: LAYOUT.smallGap }}>
          <button onClick={onClose} style={BUTTON_STYLES.secondary} disabled={loading}>
            Cancel
          </button>
          <button onClick={async () => {
            const wasAdded = await handleAddMember();
            if (wasAdded) {
              const popup = document.createElement('div');
              popup.textContent = 'Member added successfully!';
              popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:20px;border-radius:8px;box-shadow:0 10px 25px rgba(0,0,0,0.15);z-index:1100;color:#16a34a;font-weight:600';
              document.body.appendChild(popup);
              setTimeout(() => document.body.removeChild(popup), 1500);
            }
          }} style={BUTTON_STYLES.primary} disabled={loading}>
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
  width: "95%",
  maxWidth: "640px",
  maxHeight: "90vh",
  overflowY: "auto",
  textAlign: "left",
};
