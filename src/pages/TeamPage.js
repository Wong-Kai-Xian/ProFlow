import React, { useState, useEffect } from 'react';
import TopBar from '../components/TopBar';
import { COLORS, INPUT_STYLES } from '../components/profile-component/constants';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom'; // Import Link
import InviteMemberModal from '../components/team-component/InviteMemberModal'; // Import InviteMemberModal

export default function TeamPage() {
  const [teamMembers, setTeamMembers] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const { currentUser } = useAuth();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');

  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!currentUser) {
        setTeamMembers([]);
        setPendingInvitations([]);
        return;
      }
      
      try {
        // Fetch projects where the current user is a member
        const projectQuery = query(
          collection(db, "projects"),
          where("team", "array-contains", currentUser.email) // Assuming team stores emails
        );
        const projectSnapshot = await getDocs(projectQuery);
        
        const uniqueMemberEmails = new Set();
        projectSnapshot.forEach(doc => {
          const projectData = doc.data();
          (projectData.team || []).forEach(memberEmail => {
            uniqueMemberEmails.add(memberEmail);
          });
        });

        // Optionally, fetch user details for these emails if needed for display
        const membersDetails = await Promise.all(Array.from(uniqueMemberEmails).map(async (email) => {
          const usersQuery = query(collection(db, "users"), where("email", "==", email));
          const userSnapshot = await getDocs(usersQuery);
          if (!userSnapshot.empty) {
            const userData = userSnapshot.docs[0].data();
            return { 
              uid: userSnapshot.docs[0].id, // Get the UID from the user document
              email: email,
              displayName: userData.name || email.split('@')[0] // Use stored name or derive from email
            };
          } else {
            console.warn(`User document not found for email: ${email}`);
            return { email: email, displayName: email.split('@')[0] }; // Fallback
          }
        }));
        setTeamMembers(membersDetails);

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

    fetchTeamMembers();
  }, [currentUser]);

  const handleInvite = (email, userExists, signupUrl) => {
    if (userExists) {
      // A new invitation has been sent, re-fetch pending invitations to update the list
      // For now, let's just update the message. A full re-fetch might be too heavy.
      setInviteMessage(`Invitation sent to ${email}. They can accept it from their invitations page.`);
      // Optionally, add the new pending invitation to the state directly if the full object is available
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
            marginBottom: "20px",
            boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)"
          }}
        >
          Invite Member
        </button>

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
    </div>
  );
}
