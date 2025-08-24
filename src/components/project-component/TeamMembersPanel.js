import React, { useState, useEffect } from 'react';
import Card from '../profile-component/Card';
import { DESIGN_SYSTEM, getCardStyle, getButtonStyle } from '../../styles/designSystem';
import { db } from "../../firebase";
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { getAcceptedTeamMembers } from '../../services/teamService';
import { FaUserPlus, FaUserMinus } from 'react-icons/fa'; // Import icons
import { Link } from 'react-router-dom'; // Import Link
import UserAvatar from '../shared/UserAvatar';

export default function TeamMembersPanel({ projectId, teamMembers, onAddMemberClick, onRemoveMember, projectCreatorId, currentUserUid, currentUser }) {
  const [membersData, setMembersData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sendingId, setSendingId] = useState(null);
  const [invitedMap, setInvitedMap] = useState({});

  useEffect(() => {
    const fetchMemberDetails = async () => {
      setLoading(true);
      setError(null);
      
      // Start with project creator (they should always be shown)
      const allMemberUIDs = new Set();
      if (projectCreatorId) {
        allMemberUIDs.add(projectCreatorId);
      }
      
      // Add team members to the set (avoids duplicates)
      if (teamMembers && teamMembers.length > 0) {
        teamMembers.forEach(uid => allMemberUIDs.add(uid));
      }
      
      const memberUIDsArray = Array.from(allMemberUIDs);
      
      if (memberUIDsArray.length === 0) {
        setMembersData([]);
        setLoading(false);
        return;
      }
      
      console.log('TeamMembersPanel: Fetching data for UIDs:', memberUIDsArray);
      console.log('TeamMembersPanel: Project Creator ID:', projectCreatorId);
      console.log('TeamMembersPanel: Current User:', currentUser);

      try {
        // Use the same approach as ProjectDetail.js for consistency
        const fetchedDetails = [];
        const chunkSize = 10; // Firestore 'in' query limit

        for (let i = 0; i < memberUIDsArray.length; i += chunkSize) {
          const chunk = memberUIDsArray.slice(i, i + chunkSize);
          try {
            // First try querying by uid field (Firebase auth UIDs)
            const usersQuery = query(collection(db, "users"), where("uid", "in", chunk));
            const usersSnapshot = await getDocs(usersQuery);
            
            const foundUIDs = new Set();
            usersSnapshot.forEach(doc => {
              const userData = doc.data();
              
              // Special handling for current user
              let displayName = userData.name || userData.email || 'Team Member';
              let displayEmail = userData.email || 'No email provided';
              
              if (currentUser && userData.uid === currentUser.uid) {
                displayName = currentUser.name || currentUser.displayName || currentUser.email || 'You';
                displayEmail = currentUser.email || userData.email || 'No email provided';
              }
              
              fetchedDetails.push({
                id: userData.uid, // Use the uid from the document data
                name: displayName,
                email: displayEmail,
                isCreator: userData.uid === projectCreatorId,
                isCurrentUser: currentUser && userData.uid === currentUser.uid,
              });
              foundUIDs.add(userData.uid);
            });
            
            // For any UIDs not found by uid field, try direct document lookup
            const notFoundUIDs = chunk.filter(uid => !foundUIDs.has(uid));
            for (const uid of notFoundUIDs) {
              try {
                const userRef = doc(db, "users", uid);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                  const userData = userSnap.data();
                  
                  // Special handling for current user in fallback lookup
                  let displayName = userData.name || userData.email || 'Team Member';
                  let displayEmail = userData.email || 'No email provided';
                  
                  if (currentUser && uid === currentUser.uid) {
                    displayName = currentUser.name || currentUser.displayName || currentUser.email || 'You';
                    displayEmail = currentUser.email || userData.email || 'No email provided';
                  }
                  
                  fetchedDetails.push({
                    id: uid,
                    name: displayName,
                    email: displayEmail,
                    isCreator: uid === projectCreatorId,
                    isCurrentUser: currentUser && uid === currentUser.uid,
                  });
                } else {
                  console.warn(`User document not found for member ID: ${uid}`);
                  // Special case for current user even if document not found
                  if (currentUser && uid === currentUser.uid) {
                    fetchedDetails.push({
                      id: uid,
                      name: currentUser.name || currentUser.displayName || currentUser.email || 'You',
                      email: currentUser.email || 'No email provided',
                      isCreator: uid === projectCreatorId,
                      isCurrentUser: true,
                    });
                  } else {
                    fetchedDetails.push({
                      id: uid,
                      name: 'Team Member',
                      email: 'User not found',
                      isCreator: uid === projectCreatorId,
                      isCurrentUser: false,
                    });
                  }
                }
              } catch (memberErr) {
                console.error(`Error fetching member ${uid}:`, memberErr);
                // Special case for current user even on error
                if (currentUser && uid === currentUser.uid) {
                  fetchedDetails.push({
                    id: uid,
                    name: currentUser.name || currentUser.displayName || currentUser.email || 'You',
                    email: currentUser.email || 'Error loading user',
                    isCreator: uid === projectCreatorId,
                    isCurrentUser: true,
                  });
                } else {
                  fetchedDetails.push({
                    id: uid,
                    name: 'Team Member',
                    email: 'Error loading user',
                    isCreator: uid === projectCreatorId,
                    isCurrentUser: false,
                  });
                }
              }
            }
          } catch (chunkErr) {
            console.error(`Error processing chunk:`, chunkErr);
            // Fallback for this chunk
            chunk.forEach(uid => {
              if (currentUser && uid === currentUser.uid) {
                fetchedDetails.push({
                  id: uid,
                  name: currentUser.name || currentUser.displayName || currentUser.email || 'You',
                  email: currentUser.email || 'Error loading user',
                  isCreator: uid === projectCreatorId,
                  isCurrentUser: true,
                });
              } else {
                fetchedDetails.push({
                  id: uid,
                  name: 'Team Member',
                  email: 'Error loading user',
                  isCreator: uid === projectCreatorId,
                  isCurrentUser: false,
                });
              }
            });
          }
        }
        setMembersData(fetchedDetails);
      } catch (err) {
        console.error("Error fetching team member details:", err);
        setError("Failed to load team member details.");
      } finally {
        setLoading(false);
      }
    };

    fetchMemberDetails();
  }, [teamMembers, projectCreatorId, currentUser]);

  // Prefetch accepted teammates to disable Add
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!currentUser) return;
        const accepted = await getAcceptedTeamMembers(currentUser);
        const setMap = {};
        accepted.forEach(u => { if (u.id) setMap[u.id] = true; });
        if (!cancelled) setInvitedMap(m => ({ ...setMap, ...m }));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [currentUser, teamMembers]);

  // Live connections to update Add visibility in real-time
  useEffect(() => {
    if (!currentUser?.uid) return;
    const ref = collection(db, 'users', currentUser.uid, 'connections');
    const unsub = onSnapshot(ref, (snap) => {
      const m = {};
      snap.forEach(d => { const data = d.data(); if (data.with) m[data.with] = data.status === 'accepted' || data.status === 'pending'; });
      setInvitedMap(prev => ({ ...prev, ...m }));
    });
    return () => unsub();
  }, [currentUser?.uid]);

  const isProjectCreator = currentUserUid === projectCreatorId;

  return (
    <Card style={{ flex: 1, overflow: "auto", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: DESIGN_SYSTEM.spacing.base }}>
        <h3 style={{ color: DESIGN_SYSTEM.colors.text.primary, margin: 0 }}>Team Members</h3>
        {isProjectCreator && (
          <button 
            onClick={onAddMemberClick} 
            style={{ 
              ...getButtonStyle('secondary', 'projects'), 
              padding: "6px 12px", 
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "5px"
            }}>
            <FaUserPlus /> Add
          </button>
        )}
      </div>
      {loading && <p style={{ color: DESIGN_SYSTEM.colors.text.secondary }}>Loading team members...</p>}
      {error && <p style={{ color: DESIGN_SYSTEM.colors.error }}>{error}</p>}
      {!loading && membersData.length === 0 && (
        <p style={{ color: DESIGN_SYSTEM.colors.text.secondary }}>No team members assigned yet. The project creator is always included.</p>
      )}
      {!loading && membersData.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: DESIGN_SYSTEM.spacing.sm }}>
          {membersData.map((member) => (
            <div key={member.id} style={{
              backgroundColor: DESIGN_SYSTEM.colors.background.secondary,
              padding: DESIGN_SYSTEM.spacing.sm,
              borderRadius: DESIGN_SYSTEM.borderRadius.base,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              boxShadow: DESIGN_SYSTEM.shadows.sm,
              position: "relative", // For positioning the remove button
            }}>
              {isProjectCreator && member.id !== projectCreatorId && (
                <button 
                  onClick={() => onRemoveMember(member.id)} 
                  style={{
                    position: "absolute",
                    top: "5px",
                    right: "5px",
                    background: "none",
                    border: "none",
                    color: DESIGN_SYSTEM.colors.error,
                    cursor: "pointer",
                    fontSize: "14px",
                    padding: "5px"
                  }}
                >
                  <FaUserMinus />
                </button>
              )}
              <div style={{ marginBottom: "8px" }}>
                <UserAvatar 
                  user={member} 
                  size={40}
                  showBorder={true}
                  borderColor={DESIGN_SYSTEM.colors.primary[500]}
                />
              </div>
              <Link to={`/profile/${member.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: DESIGN_SYSTEM.colors.text.primary, cursor: "pointer" }}>
                  {member.name}
                  {member.isCreator && (
                    <span style={{ 
                      marginLeft: "4px", 
                      fontSize: "10px", 
                      backgroundColor: DESIGN_SYSTEM.colors.primary[500], 
                      color: DESIGN_SYSTEM.colors.text.inverse, 
                      padding: "2px 4px", 
                      borderRadius: "3px",
                      fontWeight: "500"
                    }}>
                      CREATOR
                    </span>
                  )}
                  {member.isCurrentUser && !member.isCreator && (
                    <span style={{ 
                      marginLeft: "4px", 
                      fontSize: "10px", 
                      backgroundColor: DESIGN_SYSTEM.colors.success, 
                      color: DESIGN_SYSTEM.colors.text.inverse, 
                      padding: "2px 4px", 
                      borderRadius: "3px",
                      fontWeight: "500"
                    }}>
                      YOU
                    </span>
                  )}
                </p>
                <p style={{ margin: 0, fontSize: "12px", color: DESIGN_SYSTEM.colors.text.secondary, cursor: "pointer" }}>
                  {member.email}
                </p>
              </Link>
              {currentUser && member.id !== currentUser.uid && !invitedMap[member.id] && (
                <button
                  onClick={async () => {
                    if (invitedMap[member.id]) return;
                    setSendingId(member.id);
                    try {
                      // Prevent duplicates: outgoing or incoming pending/accepted
                      const invRef = collection(db, 'invitations');
                      const qOut = query(invRef, where('fromUserId', '==', currentUser.uid), where('toUserId', '==', member.id), where('status', 'in', ['pending','accepted']));
                      const qIn = query(invRef, where('fromUserId', '==', member.id), where('toUserId', '==', currentUser.uid), where('status', 'in', ['pending','accepted']));
                      const [outSnap, inSnap] = await Promise.all([getDocs(qOut), getDocs(qIn)]);
                      if (!outSnap.empty || !inSnap.empty) { setInvitedMap(m => ({ ...m, [member.id]: true })); const p = document.createElement('div'); p.textContent = 'Already invited or connected'; Object.assign(p.style, { position: 'fixed', bottom: '20px', right: '20px', background: '#374151', color: '#fff', padding: '10px 12px', borderRadius: '8px', zIndex: 4000 }); document.body.appendChild(p); setTimeout(() => document.body.removeChild(p), 1200); return; }
                      await addDoc(collection(db, 'invitations'), {
                        fromUserId: currentUser.uid,
                        toUserId: member.id,
                        toUserEmail: member.email || '',
                        status: 'pending',
                        timestamp: new Date()
                      });
                      setInvitedMap(m => ({ ...m, [member.id]: true }));
                      const popup = document.createElement('div');
                      popup.textContent = 'Invitation sent';
                      Object.assign(popup.style, { position: 'fixed', bottom: '20px', right: '20px', background: '#111827', color: '#fff', padding: '10px 12px', borderRadius: '8px', zIndex: 4000 });
                      document.body.appendChild(popup); setTimeout(() => document.body.removeChild(popup), 1200);
                    } catch (e) { alert('Failed to send invitation'); }
                    finally { setSendingId(null); }
                  }}
                  onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.97)'; }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                  disabled={!!invitedMap[member.id] || sendingId === member.id}
                  style={{ ...getButtonStyle('secondary', 'projects'), marginTop: 6, padding: '4px 8px', fontSize: 12, opacity: invitedMap[member.id] ? 0.6 : 1, cursor: invitedMap[member.id] ? 'default' : 'pointer', transition: 'transform 120ms ease' }}
                >
                  {sendingId === member.id ? 'Adding…' : 'Add'}
                </button>
              )}
              {invitedMap[member.id] && (
                <span style={{ marginTop: 6, padding: '2px 8px', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 999, color: '#6b7280' }}>Added</span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
