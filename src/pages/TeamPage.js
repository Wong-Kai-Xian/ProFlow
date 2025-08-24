import React, { useState, useEffect } from 'react';
import TopBar from '../components/TopBar';
import { COLORS, INPUT_STYLES } from '../components/profile-component/constants';
import { db } from '../firebase';
import { collection, query, where, getDocs, onSnapshot, doc, deleteDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import UserAvatar from '../components/shared/UserAvatar';
import { useAuth } from '../contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import InviteMemberModal from '../components/team-component/InviteMemberModal';
import { FaSync, FaUsers, FaClock, FaUserPlus } from 'react-icons/fa';
import IncomingInvitationsModal from '../components/team-component/IncomingInvitationsModal';

export default function TeamPage() {
  const location = useLocation();
  const [teamMembers, setTeamMembers] = useState([]);
  const [connectionMembers, setConnectionMembers] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const { currentUser } = useAuth();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  const [showIncomingInvitationsModal, setShowIncomingInvitationsModal] = useState(false);
  const [incomingInvitationsCount, setIncomingInvitationsCount] = useState(0);

  useEffect(() => {
    if (!inviteMessage) return;
    const t = setTimeout(() => setInviteMessage(''), 2000);
    return () => clearTimeout(t);
  }, [inviteMessage]);

  // Open My Invitations modal if navigated from an invitation notification
  useEffect(() => {
    if (location.state && location.state.openInvitations) {
      setShowIncomingInvitationsModal(true);
    }
  }, [location.state]);

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
      
      // Fetch incoming invitations count
      const incomingInvitationsQuery = query(
        collection(db, "invitations"),
        where("toUserEmail", "==", currentUser.email),
        where("status", "==", "pending")
      );
      const incomingInvitationsSnapshot = await getDocs(incomingInvitationsQuery);
      setIncomingInvitationsCount(incomingInvitationsSnapshot.docs.length);
    } catch (error) {
      console.error("Error fetching team members: ", error);
    }
  };

  useEffect(() => {
    refreshTeamData();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser?.uid) { setConnectionMembers([]); return; }
    const ref = collection(db, 'users', currentUser.uid, 'connections');
    const unsub = onSnapshot(ref, async (snap) => {
      const accepted = snap.docs.map(d => d.data()).filter(d => d && d.status === 'accepted' && d.with);
      const ids = Array.from(new Set(accepted.map(d => d.with)));
      const list = [];
      for (const uid of ids) {
        try {
          const uref = doc(db, 'users', uid);
          const usnap = await getDoc(uref);
          if (usnap.exists()) { const u = usnap.data(); list.push({ uid, displayName: u.name || u.email || 'Member', email: u.email || '', photoURL: u.photoURL || '' }); }
          else { list.push({ uid, displayName: 'Member', email: '', photoURL: '' }); }
        } catch { list.push({ uid, displayName: 'Member', email: '', photoURL: '' }); }
      }
      setConnectionMembers(list);
    });
    return () => unsub();
  }, [currentUser?.uid]);

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
    <div style={{ 
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", 
      minHeight: "100vh", 
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
    }}>
      <TopBar />

      <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>
        {/* Hero Header */}
        <div style={{
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(20px)",
          borderRadius: "32px",
          padding: "40px",
          marginBottom: "32px",
          boxShadow: "0 25px 50px rgba(0, 0, 0, 0.1)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          position: "relative",
          zIndex: 1
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "20px" }}>
            <div>
              <h1 style={{
                margin: "0 0 12px 0",
                fontSize: "42px",
                fontWeight: "800",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                letterSpacing: "-0.02em"
              }}>
                🚀 Team Hub
              </h1>
              <p style={{
                margin: 0,
                fontSize: "18px",
                color: "#64748b",
                fontWeight: "500"
              }}>
                Collaborate, invite, and manage your dream team
              </p>
            </div>
            
            {/* Stats Cards */}
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              <div style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                padding: "16px 20px",
                borderRadius: "20px",
                textAlign: "center",
                minWidth: "120px",
                boxShadow: "0 8px 25px rgba(102, 126, 234, 0.3)"
              }}>
                <FaUsers style={{ fontSize: "24px", marginBottom: "8px" }} />
                <div style={{ fontSize: "24px", fontWeight: "700" }}>{connectionMembers.length}</div>
                <div style={{ fontSize: "12px", opacity: 0.9 }}>Team Members</div>
              </div>
              <div style={{
                background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                color: "white",
                padding: "16px 20px",
                borderRadius: "20px",
                textAlign: "center",
                minWidth: "120px",
                boxShadow: "0 8px 25px rgba(240, 147, 251, 0.3)"
              }}>
                <FaClock style={{ fontSize: "24px", marginBottom: "8px" }} />
                <div style={{ fontSize: "24px", fontWeight: "700" }}>{pendingInvitations.length}</div>
                <div style={{ fontSize: "12px", opacity: 0.9 }}>Pending</div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Section */}
        <div style={{
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(20px)",
          borderRadius: "24px",
          padding: "32px",
          marginBottom: "32px",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.08)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          position: "relative",
          zIndex: 1
        }}>
          {/* Action Buttons */}
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            marginBottom: "32px",
            alignItems: "center"
          }}>
            <button
              onClick={() => setShowInviteModal(true)}
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                padding: "16px 32px",
                borderRadius: "20px",
                border: "none",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "600",
                boxShadow: "0 12px 30px rgba(102, 126, 234, 0.4)",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                display: "flex",
                alignItems: "center",
                gap: "12px"
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = "translateY(-3px)";
                e.target.style.boxShadow = "0 16px 40px rgba(102, 126, 234, 0.5)";
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 12px 30px rgba(102, 126, 234, 0.4)";
              }}
            >
              <FaUserPlus /> Invite New Member
            </button>

            <button
              onClick={() => setShowIncomingInvitationsModal(true)}
              style={{
                background: incomingInvitationsCount > 0 ? "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" : "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                color: "white",
                padding: "16px 32px",
                borderRadius: "20px",
                border: "none",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "600",
                boxShadow: incomingInvitationsCount > 0 ? "0 12px 30px rgba(240, 147, 251, 0.4)" : "0 12px 30px rgba(79, 172, 254, 0.4)",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: "12px"
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = "translateY(-3px)";
                e.target.style.boxShadow = incomingInvitationsCount > 0 ? "0 16px 40px rgba(240, 147, 251, 0.5)" : "0 16px 40px rgba(79, 172, 254, 0.5)";
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = incomingInvitationsCount > 0 ? "0 12px 30px rgba(240, 147, 251, 0.4)" : "0 12px 30px rgba(79, 172, 254, 0.4)";
              }}
            >
              My Invitations
              {incomingInvitationsCount > 0 && (
                <span style={{
                  background: "rgba(255, 255, 255, 0.9)",
                  color: "#1a1a1a",
                  borderRadius: "12px",
                  padding: "4px 10px",
                  fontSize: "12px",
                  fontWeight: "700",
                  marginLeft: "8px"
                }}>
                  {incomingInvitationsCount > 99 ? '99+' : incomingInvitationsCount}
                </span>
              )}
            </button>

            <button
              onClick={refreshTeamData}
              style={{
                background: "rgba(255, 255, 255, 0.9)",
                color: "#64748b",
                padding: "16px 20px",
                borderRadius: "20px",
                border: "2px solid #e2e8f0",
                cursor: "pointer",
                fontSize: "18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 8px 20px rgba(0, 0, 0, 0.08)",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
              }}
              onMouseEnter={(e) => {
                e.target.style.borderColor = "#667eea";
                e.target.style.color = "#667eea";
                e.target.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.target.style.borderColor = "#e2e8f0";
                e.target.style.color = "#64748b";
                e.target.style.transform = "translateY(0)";
              }}
              title="Refresh team data"
            >
              <FaSync />
            </button>
          </div>

          {/* Moved status message below Team Members list */}

          {/* Search Bar */}
          <div style={{
            position: "relative",
            maxWidth: "600px"
          }}>
            <input
              type="text"
              placeholder="🔍 Search team members and invitations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "20px 24px",
                fontSize: "16px",
                borderRadius: "20px",
                border: "2px solid #e2e8f0",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                background: "rgba(248, 250, 252, 0.8)",
                color: "#334155",
                outline: "none",
                fontWeight: "500"
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#667eea";
                e.target.style.background = "white";
                e.target.style.boxShadow = "0 0 0 4px rgba(102, 126, 234, 0.1)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#e2e8f0";
                e.target.style.background = "rgba(248, 250, 252, 0.8)";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>
        </div>

        {/* Pending Invitations Section */}
        <div style={{
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(20px)",
          borderRadius: "24px",
          padding: "32px",
          marginBottom: "32px",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.08)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          position: "relative",
          zIndex: 1
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "24px"
          }}>
            <h2 style={{
              color: "#1e293b",
              fontSize: "28px",
              fontWeight: "700",
              margin: 0,
              letterSpacing: "-0.025em"
            }}>
              Pending Invitations
            </h2>
            {filteredPendingInvitations.length > 0 && (
              <span style={{
                background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
                color: "white",
                borderRadius: "16px",
                padding: "8px 16px",
                fontSize: "14px",
                fontWeight: "700"
              }}>
                {filteredPendingInvitations.length}
              </span>
            )}
          </div>

          {filteredPendingInvitations.length === 0 ? (
            <div style={{
              borderRadius: "20px",
              padding: "60px 20px",
              textAlign: "center",
              border: "2px dashed #e2e8f0",
              background: "rgba(248, 250, 252, 0.5)"
            }}>
              <div style={{
                fontSize: "64px",
                marginBottom: "20px",
                opacity: 0.4
              }}>📋</div>
              <p style={{
                color: "#64748b",
                fontSize: "18px",
                margin: 0,
                fontWeight: "500"
              }}>
                {searchTerm ? `No pending invitations found matching "${searchTerm}"` : "No pending invitations at the moment"}
              </p>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
              gap: "24px",
              marginBottom: "20px"
            }}>
              {filteredPendingInvitations.map((invitation) => (
                <div key={invitation.id} style={{
                  background: "linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.9) 100%)",
                  borderRadius: "24px",
                  padding: "28px",
                  boxShadow: "0 12px 30px rgba(0, 0, 0, 0.08)",
                  border: "2px solid rgba(255, 255, 255, 0.6)",
                  display: "flex",
                  alignItems: "center",
                  gap: "20px",
                  position: "relative",
                  overflow: "hidden",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-6px)";
                  e.currentTarget.style.boxShadow = "0 20px 45px rgba(0, 0, 0, 0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 12px 30px rgba(0, 0, 0, 0.08)";
                }}>
                  <div style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: "24px",
                    fontWeight: "700",
                    boxShadow: "0 8px 20px rgba(251, 191, 36, 0.3)"
                  }}>
                    {invitation.toUserEmail[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "20px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>
                      {invitation.toUserEmail}
                    </div>
                    <div style={{ fontSize: "14px", color: "#64748b", fontWeight: "500" }}>
                      Invitation pending...
                    </div>
                  </div>
                  <div style={{
                    position: "absolute",
                    top: "16px",
                    right: "16px",
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    background: "#fbbf24",
                    animation: "pulse 2s infinite"
                  }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Team Members Section */}
        <div style={{
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(20px)",
          borderRadius: "24px",
          padding: "32px",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.08)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          position: "relative",
          zIndex: 1
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "24px"
          }}>
            <h2 style={{
              color: "#1e293b",
              fontSize: "28px",
              fontWeight: "700",
              margin: 0,
              letterSpacing: "-0.025em"
            }}>
              Team Members
            </h2>
            {filteredMembers.length > 0 && (
              <span style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                borderRadius: "16px",
                padding: "8px 16px",
                fontSize: "14px",
                fontWeight: "700"
              }}>
                {filteredMembers.length}
              </span>
            )}
          </div>

          {filteredMembers.length === 0 ? (
            <div style={{
              borderRadius: "20px",
              padding: "80px 20px",
              textAlign: "center",
              border: "2px dashed #e2e8f0",
              background: "rgba(248, 250, 252, 0.5)"
            }}>
              <div style={{
                fontSize: "80px",
                marginBottom: "24px",
                opacity: 0.3
              }}>👥</div>
              <p style={{
                color: "#64748b",
                fontSize: "20px",
                margin: 0,
                fontWeight: "500"
              }}>
                {searchTerm ? `No team members found matching "${searchTerm}"` : "Start building your team by inviting members!"}
              </p>
            </div>
          ) : (
            <>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
                gap: "24px"
              }}>
                {connectionMembers
                  .filter(member => (member.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) || (member.email || '').toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((member, index) => (
                  <div key={index} style={{
                    background: "linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.9) 100%)",
                    borderRadius: "24px",
                    padding: "28px",
                    boxShadow: "0 12px 30px rgba(0, 0, 0, 0.08)",
                    border: "2px solid rgba(255, 255, 255, 0.6)",
                    position: 'relative',
                    display: "flex",
                    alignItems: "center",
                    gap: "20px",
                    cursor: member.uid ? "pointer" : "default"
                  }}
                  >
                    <button onClick={async () => { try { if (!currentUser?.uid || !member.uid) return; const myCol = collection(db, 'users', currentUser.uid, 'connections'); const q1 = query(myCol, where('with', '==', member.uid)); const snap1 = await getDocs(q1); await Promise.all(snap1.docs.map(d => deleteDoc(d.ref))); const theirCol = collection(db, 'users', member.uid, 'connections'); const q2 = query(theirCol, where('with', '==', currentUser.uid)); const snap2 = await getDocs(q2); await Promise.all(snap2.docs.map(d => deleteDoc(d.ref))); const inv1 = query(collection(db, 'invitations'), where('fromUserId','==', currentUser.uid), where('toUserId','==', member.uid), where('status','==','accepted')); const inv2 = query(collection(db, 'invitations'), where('fromUserId','==', member.uid), where('toUserId','==', currentUser.uid), where('status','==','accepted')); const [s1, s2] = await Promise.all([getDocs(inv1), getDocs(inv2)]); await Promise.all([...s1.docs, ...s2.docs].map(d => updateDoc(d.ref, { status: 'removed', removedAt: serverTimestamp() }))); setConnectionMembers(prev => prev.filter(m => m.uid !== member.uid)); setInviteMessage(`Removed ${member.displayName}`); } catch (e) { console.error(e); alert('Failed to remove member'); } }} title="Remove connection" style={{ position: 'absolute', top: 8, right: 8, background: 'transparent', border: '1px solid #e5e7eb', color: '#ef4444', padding: '4px 8px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Remove</button>
                    <div style={{ width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <UserAvatar user={{ name: member.displayName, photoURL: member.photoURL }} size={64} showBorder={true} borderColor="rgba(102,126,234,0.35)" />
                    </div>
                    <div style={{ flex: 1 }}>
                      {member.uid ? (
                        <Link to={`/profile/${member.uid}`} style={{ textDecoration: 'none' }}>
                          <div style={{ fontSize: "22px", fontWeight: "700", color: "#667eea", marginBottom: "6px", transition: "color 0.2s" }}>
                            {member.displayName}
                          </div>
                          <div style={{ fontSize: "16px", color: "#64748b", fontWeight: "500", maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {member.email}
                          </div>
                        </Link>
                      ) : (
                        <>
                          <div style={{ fontSize: "22px", fontWeight: "700", color: "#1e293b", marginBottom: "6px" }}>
                            {member.displayName}
                          </div>
                          <div style={{ fontSize: "16px", color: "#64748b", fontWeight: "500", maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {member.email}
                          </div>
                        </>
                      )}
                    </div>
                    <div style={{
                      width: "16px",
                      height: "16px",
                      borderRadius: "50%",
                      background: "#10b981",
                      boxShadow: "0 0 12px rgba(16, 185, 129, 0.4)"
                    }}></div>
                  </div>
                ))}
              </div>
              {inviteMessage && (
                <div style={{
                  background: "linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)",
                  border: "2px solid #28a745",
                  borderRadius: "12px",
                  padding: "12px 16px",
                  marginTop: "16px",
                  color: "#155724",
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  fontWeight: "600"
                }}>
                  ✅ {inviteMessage}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <InviteMemberModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvite={handleInvite}
      />
      <IncomingInvitationsModal 
        isOpen={showIncomingInvitationsModal}
        onClose={() => setShowIncomingInvitationsModal(false)}
        onInvitationAction={refreshTeamData}
      />
    </div>
  );
}