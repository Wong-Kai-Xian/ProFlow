import React, { useState, useEffect } from 'react';
import TopBar from '../components/TopBar';
import { COLORS, INPUT_STYLES } from '../components/profile-component/constants';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom'; // Import Link
import InviteMemberModal from '../components/team-component/InviteMemberModal'; // Import InviteMemberModal
import { FaSync } from 'react-icons/fa'; // Import refresh icon
import IncomingInvitationsModal from '../components/team-component/IncomingInvitationsModal'; // Import new modal

export default function TeamPage() {
  const [teamMembers, setTeamMembers] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const { currentUser } = useAuth();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  const [showIncomingInvitationsModal, setShowIncomingInvitationsModal] = useState(false);

  const refreshTeamData = async () => {
    if (!currentUser) {
      setTeamMembers([]);
      setPendingInvitations([]);
      return;
    }

    try {
      const allProjectDocuments = [];

      // 1. Fetch projects where the current user is the owner
      const ownedProjectsQuery = query(
        collection(db, "projects"),
        where("ownerId", "==", currentUser.uid)
      );
      const ownedProjectsSnapshot = await getDocs(ownedProjectsQuery);
      ownedProjectsSnapshot.forEach(doc => allProjectDocuments.push(doc));

      // 2. Fetch projects where the current user is a member (if not already fetched as owner)
      const memberProjectsQuery = query(
        collection(db, "projects"),
        where("team", "array-contains", currentUser.email)
      );
      const memberProjectsSnapshot = await getDocs(memberProjectsQuery);
      memberProjectsSnapshot.forEach(doc => {
        if (!allProjectDocuments.some(existingDoc => existingDoc.id === doc.id)) {
          allProjectDocuments.push(doc);
        }
      });

      console.log("TeamPage: allProjectDocuments after fetching owned and member projects", allProjectDocuments);

      const uniqueMemberEmails = new Set();
      allProjectDocuments.forEach(doc => {
        const projectData = doc.data();
        (projectData.team || []).forEach(memberEmail => {
          uniqueMemberEmails.add(memberEmail);
        });
      });

      // 3. Fetch accepted outgoing invitations by the current user
      const acceptedInvitationsQuery = query(
        collection(db, "invitations"),
        where("fromUserId", "==", currentUser.uid),
        where("status", "==", "accepted")
      );
      const acceptedInvitationsSnapshot = await getDocs(acceptedInvitationsQuery);
      acceptedInvitationsSnapshot.forEach(invitationDoc => {
        const invitationData = invitationDoc.data();
        uniqueMemberEmails.add(invitationData.toUserEmail);
      });

      console.log("TeamPage: uniqueMemberEmails after all project and accepted invitations processing", uniqueMemberEmails);

      // Fetch user details for all unique member emails
      const allMemberEmails = Array.from(uniqueMemberEmails);
      const fetchedMembersDetails = [];
      if (allMemberEmails.length > 0) {
        // Firestore `in` query supports up to 10 array elements
        const chunkSize = 10;
        for (let i = 0; i < allMemberEmails.length; i += chunkSize) {
          const chunk = allMemberEmails.slice(i, i + chunkSize);
          const usersQuery = query(collection(db, "users"), where("email", "in", chunk));
          const usersSnapshot = await getDocs(usersQuery);
          usersSnapshot.forEach(doc => {
            const userData = doc.data();
            fetchedMembersDetails.push({
              uid: doc.id,
              email: userData.email,
              displayName: userData.name || userData.email
            });
          });
        }
        setTeamMembers(fetchedMembersDetails);
        console.log("TeamPage: fetchedMembersDetails for accepted team members", fetchedMembersDetails);
      } else {
        setTeamMembers([]);
      }
      // Fetch pending outgoing invitations from the current user
      const invitationsQuery = query(
        collection(db, "invitations"),
        where("fromUserId", "==", currentUser.uid),
        where("status", "==", "pending")
      );
      const invitationsSnapshot = await getDocs(invitationsQuery);
      const fetchedPendingInvitations = invitationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPendingInvitations(fetchedPendingInvitations);
    } catch (error) {
      console.error("Error fetching team members: ", error);
    }
  };

  useEffect(() => {
    refreshTeamData();
  }, [currentUser]);

  const handleInvite = (email, userExists, signupUrl, newInvitation) => {
    if (userExists) {
      setInviteMessage(`Invitation sent to ${email}. They can accept it from their invitations page.`);
      refreshTeamData(); // Re-fetch to update pending invitations
    } else {
      setInviteMessage(`User with email ${email} not found. Share this link for them to sign up: ${signupUrl}`);
    }
    setShowInviteModal(false);
  };

  const filteredMembers = teamMembers.filter(member =>
    member.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPendingInvitations = pendingInvitations.filter(invitation =>
    invitation.toUserEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ fontFamily: "Arial, sans-serif", minHeight: "100vh", backgroundColor: COLORS.background }}>
      <TopBar />

      <div style={{ padding: "30px" }}>
        <h1 style={{
          margin: "0 0 30px 0",
          color: COLORS.dark,
          fontSize: "28px",
          fontWeight: "700"
        }}>
          My Team
        </h1>

        <div style={{ display: "flex", justifyContent: "flex-start", gap: "15px", marginBottom: "20px" }}>
        <button
          onClick={() => setShowInviteModal(true)}
          style={{
            backgroundColor: COLORS.primary,
            color: COLORS.white,
            padding: "10px 20px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "600",
            boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)"
          }}
        >
          Invite Member
        </button>

        <button
          onClick={() => setShowIncomingInvitationsModal(true)} // Open the new incoming invitations modal
          style={{
            backgroundColor: COLORS.tertiary, // New color for this button
            color: COLORS.white,
            padding: "10px 20px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "600",
            boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)"
          }}
        >
          My Invitations
        </button>
        <button
          onClick={refreshTeamData}
          style={{
            backgroundColor: COLORS.light,
            color: COLORS.darkText,
            padding: "10px", // Square button
            borderRadius: "8px",
            border: `1px solid ${COLORS.border}`,
            cursor: "pointer",
            fontSize: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 8px rgba(0, 0, 0, 0.05)"
          }}
        >
          <FaSync />
        </button>
        </div>

        {inviteMessage && (
          <p style={{ color: COLORS.primary, marginBottom: "20px", fontSize: "16px" }}>
            {inviteMessage}
          </p>
        )}

        {/* Search Bar */}
        <div style={{ marginBottom: "30px" }}>
          <input
            type="text"
            placeholder="Search team members and pending invitations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              ...INPUT_STYLES.base,
              width: "100%",
              maxWidth: "400px",
              padding: "12px 16px",
              fontSize: "16px",
              borderRadius: "8px",
              border: `2px solid ${COLORS.border}`,
              transition: "border-color 0.3s ease"
            }}
            onFocus={(e) => {
              e.target.style.borderColor = COLORS.primary;
            }}
            onBlur={(e) => {
              e.target.style.borderColor = COLORS.border;
            }}
          />
        </div>

        {/* Pending Invitations Section */}
        <h2 style={{ color: COLORS.dark, fontSize: "22px", fontWeight: "600", marginBottom: "20px", marginTop: "40px" }}>Pending Invitations</h2>
        {filteredPendingInvitations.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "30px 20px",
            color: COLORS.lightText,
            fontSize: "16px",
            border: `1px dashed ${COLORS.border}`,
            borderRadius: "8px",
            backgroundColor: COLORS.white
          }}>
            {searchTerm ? `No pending invitations found matching "${searchTerm}"` : "No pending invitations."} 
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "20px",
            marginBottom: "40px"
          }}>
            {filteredPendingInvitations.map((invitation) => (
              <div key={invitation.id} style={{
                backgroundColor: COLORS.white,
                borderRadius: "12px",
                padding: "20px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
                border: `1px solid ${COLORS.border}`,
                display: "flex",
                alignItems: "center",
                gap: "15px",
                opacity: 0.7, // Shaded effect
                position: "relative",
                overflow: "hidden"
              }}>
                <div style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "50%",
                  backgroundColor: COLORS.light,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: COLORS.white,
                  fontSize: "20px",
                  fontWeight: "700"
                }}>
                  {invitation.toUserEmail[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: "18px", fontWeight: "600", color: COLORS.dark }}>{invitation.toUserEmail}</div>
                  <div style={{ fontSize: "14px", color: COLORS.lightText }}>Pending</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Team Members List */}
        <h2 style={{ color: COLORS.dark, fontSize: "22px", fontWeight: "600", marginBottom: "20px" }}>Accepted Team Members</h2>
        {filteredMembers.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "60px 20px",
            color: COLORS.lightText,
            fontSize: "18px"
          }}>
            {searchTerm ? `No team members found matching "${searchTerm}"` : "No team members yet."}
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "20px"
          }}>
            {filteredMembers.map((member, index) => (
              <div key={index} style={{
                backgroundColor: COLORS.white,
                borderRadius: "12px",
                padding: "20px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
                border: `1px solid ${COLORS.border}`,
                display: "flex",
                alignItems: "center",
                gap: "15px"
              }}>
                <div style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "50%",
                  backgroundColor: COLORS.primary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: COLORS.white,
                  fontSize: "20px",
                  fontWeight: "700"
                }}>
                  {member.displayName[0].toUpperCase()}
                </div>
                <div>
                 {member.uid ? (
                   <Link to={`/profile/${member.uid}`} style={{ textDecoration: 'none' }}>
                     <div style={{ fontSize: "18px", fontWeight: "600", color: COLORS.primary, cursor: "pointer" }}>{member.displayName}</div>
                     <div style={{ fontSize: "14px", color: COLORS.lightText, cursor: "pointer" }}>{member.email}</div>
                   </Link>
                 ) : (
                   <>
                     <div style={{ fontSize: "18px", fontWeight: "600", color: COLORS.dark }}>{member.displayName}</div>
                     <div style={{ fontSize: "14px", color: COLORS.lightText }}>{member.email}</div>
                   </>
                 )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <InviteMemberModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvite={handleInvite}
      />
      <IncomingInvitationsModal 
        isOpen={showIncomingInvitationsModal}
        onClose={() => setShowIncomingInvitationsModal(false)}
        onInvitationAction={refreshTeamData} // Pass the refresh function to update TeamPage when an invitation is accepted/rejected
      />
    </div>
  );
}
