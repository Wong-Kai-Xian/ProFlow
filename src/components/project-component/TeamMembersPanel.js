import React, { useState, useEffect } from 'react';
import Card from '../profile-component/Card';
import { COLORS, LAYOUT } from '../profile-component/constants';
import { db } from "../../firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { FaUserPlus, FaUserMinus } from 'react-icons/fa'; // Import icons
import { BUTTON_STYLES } from '../profile-component/constants'; // Import BUTTON_STYLES
import { Link } from 'react-router-dom'; // Import Link

export default function TeamMembersPanel({ projectId, teamMembers, onAddMemberClick, onRemoveMember, projectCreatorId, currentUserUid, currentUser }) {
  const [membersData, setMembersData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const isProjectCreator = currentUserUid === projectCreatorId;

  return (
    <Card style={{ flex: 1, overflow: "auto", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: LAYOUT.gap }}>
        <h3 style={{ color: COLORS.dark, margin: 0 }}>Team Members</h3>
        {isProjectCreator && (
          <button 
            onClick={onAddMemberClick} 
            style={{ 
              ...BUTTON_STYLES.secondary, 
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
      {loading && <p style={{ color: COLORS.lightText }}>Loading team members...</p>}
      {error && <p style={{ color: COLORS.danger }}>{error}</p>}
      {!loading && membersData.length === 0 && (
        <p style={{ color: COLORS.lightText }}>No team members assigned yet. The project creator is always included.</p>
      )}
      {!loading && membersData.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: LAYOUT.smallGap }}>
          {membersData.map((member) => (
            <div key={member.id} style={{
              backgroundColor: COLORS.light,
              padding: LAYOUT.smallGap,
              borderRadius: LAYOUT.borderRadius,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              boxShadow: LAYOUT.cardShadow,
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
                    color: COLORS.danger,
                    cursor: "pointer",
                    fontSize: "14px",
                    padding: "5px"
                  }}
                >
                  <FaUserMinus />
                </button>
              )}
              <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                backgroundColor: COLORS.primary,
                color: COLORS.white,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                fontWeight: "bold",
                marginBottom: "8px",
              }}>
                {member.name ? member.name[0].toUpperCase() : '?'}
              </div>
              <Link to={`/profile/${member.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: COLORS.dark, cursor: "pointer" }}>
                  {member.name}
                  {member.isCreator && (
                    <span style={{ 
                      marginLeft: "4px", 
                      fontSize: "10px", 
                      backgroundColor: COLORS.primary, 
                      color: COLORS.white, 
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
                      backgroundColor: COLORS.success, 
                      color: COLORS.white, 
                      padding: "2px 4px", 
                      borderRadius: "3px",
                      fontWeight: "500"
                    }}>
                      YOU
                    </span>
                  )}
                </p>
                <p style={{ margin: 0, fontSize: "12px", color: COLORS.lightText, cursor: "pointer" }}>
                  {member.email}
                </p>
              </Link>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
