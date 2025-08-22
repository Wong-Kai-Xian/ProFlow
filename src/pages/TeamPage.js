import React, { useState, useEffect } from 'react';
import TopBar from '../components/TopBar';
import { COLORS, INPUT_STYLES } from '../components/profile-component/constants';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export default function TeamPage() {
  const [teamMembers, setTeamMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const { currentUser } = useAuth();

  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!currentUser) {
        setTeamMembers([]);
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
        const membersDetails = Array.from(uniqueMemberEmails).map(email => ({
          email: email,
          // You might want to fetch more user details from a 'users' collection if available
          // For now, just using email as display name
          displayName: email.split('@')[0]
        }));
        setTeamMembers(membersDetails);

      } catch (error) {
        console.error("Error fetching team members: ", error);
      }
    };

    fetchTeamMembers();
  }, [currentUser]);

  const filteredMembers = teamMembers.filter(member =>
    member.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.email.toLowerCase().includes(searchTerm.toLowerCase())
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

        {/* Search Bar */}
        <div style={{ marginBottom: "30px" }}>
          <input
            type="text"
            placeholder="Search team members..."
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

        {/* Team Members List */}
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
                  <div style={{ fontSize: "18px", fontWeight: "600", color: COLORS.dark }}>{member.displayName}</div>
                  <div style={{ fontSize: "14px", color: COLORS.lightText }}>{member.email}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
