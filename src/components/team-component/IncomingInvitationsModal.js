import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS, BUTTON_STYLES } from '../profile-component/constants';

export default function IncomingInvitationsModal({ isOpen, onClose, onInvitationAction }) {
  const { currentUser } = useAuth();
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchInvitations = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    try {
      const q = query(
        collection(db, "invitations"),
        where("toUserEmail", "==", currentUser.email),
        where("status", "==", "pending")
      );
      const querySnapshot = await getDocs(q);
      const fetchedInvitations = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setInvitations(fetchedInvitations);
    } catch (error) {
      console.error("Error fetching invitations: ", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchInvitations();
    }
  }, [isOpen, currentUser]);

  const handleAccept = async (invitationId, fromUserId, toUserEmail) => {
    if (!currentUser) return;

    try {
      // 1. Update invitation status to accepted
      const invitationRef = doc(db, "invitations", invitationId);
      await updateDoc(invitationRef, {
        status: "accepted",
        acceptedAt: new Date(),
      });

      // 2. Add current user's email to the inviting user's projects' team array
      const projectsQuery = query(
        collection(db, "projects"),
        where("ownerId", "==", fromUserId)
      );
      const projectsSnapshot = await getDocs(projectsQuery);

      const batchUpdates = [];
      projectsSnapshot.forEach(projectDoc => {
        const projectRef = doc(db, "projects", projectDoc.id);
        batchUpdates.push(updateDoc(projectRef, {
          team: arrayUnion(toUserEmail)
        }));
      });

      await Promise.all(batchUpdates);

      // 3. Update local state and notify parent
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      onInvitationAction(); // Notify parent (TeamPage) to refresh its data
      alert("Invitation accepted!");
    } catch (error) {
      console.error("Error accepting invitation: ", error);
      alert("Failed to accept invitation.");
    }
  };

  const handleReject = async (invitationId) => {
    try {
      const invitationRef = doc(db, "invitations", invitationId);
      await updateDoc(invitationRef, {
        status: "rejected",
        rejectedAt: new Date(),
      });
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      onInvitationAction(); // Notify parent (TeamPage) to refresh its data
      alert("Invitation rejected.");
    } catch (error) {
      console.error("Error rejecting invitation: ", error);
      alert("Failed to reject invitation.");
    }
  };

  if (!isOpen) return null;

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <h2 style={{ color: COLORS.text, marginBottom: '20px' }}>My Invitations</h2>

        {loading ? (
          <div style={{ textAlign: "center", padding: "30px", color: COLORS.lightText }}>Loading invitations...</div>
        ) : invitations.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "30px 20px",
            color: COLORS.lightText,
            fontSize: "16px",
            border: `1px dashed ${COLORS.border}`,
            borderRadius: "8px",
            backgroundColor: COLORS.white
          }}>
            No pending invitations.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {invitations.map(invitation => (
              <div key={invitation.id} style={{
                backgroundColor: COLORS.cardBackground,
                borderRadius: "12px",
                padding: "20px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
                border: `1px solid ${COLORS.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "20px"
              }}>
                <div>
                  <p style={{ margin: "0 0 5px 0", fontSize: "18px", fontWeight: "600", color: COLORS.dark }}>
                    Invitation from: {invitation.fromUserEmail}
                  </p>
                  <p style={{ margin: 0, fontSize: "14px", color: COLORS.lightText }}>
                    Sent on: {new Date(invitation.timestamp.toDate()).toLocaleString()}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={() => handleAccept(invitation.id, invitation.fromUserId, invitation.toUserEmail)}
                    style={{ ...BUTTON_STYLES.primary, backgroundColor: COLORS.success, padding: "8px 15px", fontSize: "14px" }}
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleReject(invitation.id)}
                    style={{ ...BUTTON_STYLES.secondary, padding: "8px 15px", fontSize: "14px" }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <button onClick={onClose} style={{ ...BUTTON_STYLES.secondary, marginTop: '20px' }}>
          Close
        </button>
      </div>
    </div>
  );
}

const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
};

const modalContentStyle = {
  backgroundColor: COLORS.white,
  padding: '30px',
  borderRadius: '8px',
  width: '600px',
  maxWidth: '90%',
  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
  textAlign: 'center',
  color: COLORS.text, // Adjust text color for contrast
};
