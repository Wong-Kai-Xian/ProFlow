import React, { useState, useEffect } from 'react';
import TopBar from '../components/TopBar';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { COLORS, BUTTON_STYLES } from '../components/profile-component/constants';

export default function InvitationsPage() {
  const { currentUser } = useAuth();
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    fetchInvitations();
  }, [currentUser]);

  const handleAccept = async (invitationId, fromUserId) => {
    if (!currentUser) return;

    try {
      // 1. Update invitation status to accepted
      const invitationRef = doc(db, "invitations", invitationId);
      await updateDoc(invitationRef, {
        status: "accepted",
        acceptedAt: new Date(),
      });

      // 2. Add current user's email to the inviting user's projects' team array
      // This requires finding projects where fromUserId is a member and then adding currentUser.email to its team.
      // For simplicity, let's assume the inviting user is the owner of the projects they are inviting for.
      const projectsQuery = query(
        collection(db, "projects"),
        where("ownerId", "==", fromUserId)
      );
      const projectsSnapshot = await getDocs(projectsQuery);

      const batchUpdates = [];
      projectsSnapshot.forEach(projectDoc => {
        const projectRef = doc(db, "projects", projectDoc.id);
        batchUpdates.push(updateDoc(projectRef, {
          team: arrayUnion(currentUser.email)
        }));
      });

      await Promise.all(batchUpdates);

      // 3. Update local state
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
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
      alert("Invitation rejected.");
    } catch (error) {
      console.error("Error rejecting invitation: ", error);
      alert("Failed to reject invitation.");
    }
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: "50px", color: COLORS.lightText }}>Loading invitations...</div>;
  }

  return (
    <div style={{ fontFamily: "Arial, sans-serif", minHeight: "100vh", backgroundColor: COLORS.background }}>
      <TopBar />
      <div style={{ padding: "30px", maxWidth: "800px", margin: "0 auto" }}>
        <h1 style={{
          margin: "0 0 30px 0",
          color: COLORS.dark,
          fontSize: "28px",
          fontWeight: "700"
        }}>
          My Invitations
        </h1>

        {invitations.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "60px 20px",
            color: COLORS.lightText,
            fontSize: "18px"
          }}>
            No pending invitations.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {invitations.map(invitation => (
              <div key={invitation.id} style={{
                backgroundColor: COLORS.white,
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
                    onClick={() => handleAccept(invitation.id, invitation.fromUserId)}
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
      </div>
    </div>
  );
}
