import React from "react";
import { COLORS } from "../profile-component/constants";

export default function Members({ forumData }) {
  const members = forumData?.members || [];

  const getStatusColor = (status) => {
    switch(status) {
      case 'online': return '#27AE60';
      case 'away': return '#F39C12';
      case 'offline': return '#E74C3C';
      default: return '#7F8C8D';
    }
  };

  return (
    <div>
      <h3 style={{ marginTop: 0, color: COLORS.dark, fontSize: "16px", fontWeight: "700" }}>Forum Members ({members.length})</h3>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
        gap: '15px' 
      }}>
        {members.map((member) => (
          <div key={member.id} style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '10px',
            border: '1px solid #ECF0F1',
            textAlign: 'center'
          }}>
            <div style={{
              width: '70px',
              height: '70px',
              borderRadius: '50%',
              backgroundColor: COLORS.primary,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              margin: '0 auto 18px',
              fontWeight: 'bold'
            }}>
              {member && member.name ? member.name.split(' ').map(n => n[0]).join('') : (member ? member.charAt(0) : 'U')}
            </div>
            
            <strong style={{ color: COLORS.dark, fontSize: '18px', fontWeight: '600' }}>{member && member.name ? member.name : member || 'Unknown Member'}</strong>
            
            <div style={{ 
              fontSize: '15px', 
              color: COLORS.lightText, 
              marginTop: '6px',
              marginBottom: '12px'
            }}>
              {member && member.role ? member.role : 'Member'}
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '6px',
              marginBottom: '12px'
            }}>
              <span style={{ 
                color: getStatusColor(member && member.status ? member.status : 'offline'),
                fontSize: '14px',
                fontWeight: '600'
              }}>
                ● {member && member.status ? member.status : 'offline'}
              </span>
            </div>
            
            <div style={{ fontSize: '13px', color: COLORS.lightText }}>
              Joined {member && member.joinDate ? member.joinDate : 'N/A'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
