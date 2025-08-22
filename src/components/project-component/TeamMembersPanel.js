import React, { useState, useEffect } from 'react';
import Card from '../profile-component/Card';
import { COLORS, LAYOUT } from '../profile-component/constants';
import { db } from "../../firebase";
import { doc, getDoc } from "firebase/firestore";
import { FaUserPlus, FaUserMinus } from 'react-icons/fa'; // Import icons
import { BUTTON_STYLES } from '../profile-component/constants'; // Import BUTTON_STYLES
import { Link } from 'react-router-dom'; // Import Link

export default function TeamMembersPanel({ projectId, teamMembers, onAddMemberClick, onRemoveMember, projectCreatorId, currentUserUid }) {
  const [membersData, setMembersData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMemberDetails = async () => {
      setLoading(true);
      setError(null);
      if (!teamMembers || teamMembers.length === 0) {
        setMembersData([]);
        setLoading(false);
        return;
      }

      try {
        const fetchedData = await Promise.all(
          teamMembers.map(async (memberId) => {
            const userRef = doc(db, "users", memberId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const userData = userSnap.data();
              return { id: memberId, name: userData.name || userData.email, email: userData.email }; // Prioritize userData.name
            } else {
              console.warn(`User document not found for member ID: ${memberId}`);
              return { id: memberId, name: `Unknown User (${memberId})`, email: 'N/A' };
            }
          })
        );
        setMembersData(fetchedData);
      } catch (err) {
        console.error("Error fetching team member details:", err);
        setError("Failed to load team member details.");
      } finally {
        setLoading(false);
      }
    };

    fetchMemberDetails();
  }, [teamMembers]);

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
            <FaUserPlus /> Add User
          </button>
        )}
      </div>
      {loading && <p style={{ color: COLORS.lightText }}>Loading team members...</p>}
      {error && <p style={{ color: COLORS.danger }}>{error}</p>}
      {!loading && membersData.length === 0 && (
        <p style={{ color: COLORS.lightText }}>No team members assigned yet.</p>
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
