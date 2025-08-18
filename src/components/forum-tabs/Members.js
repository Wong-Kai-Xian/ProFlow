import React from "react";

export default function Members() {
  const members = [
    { id: 1, name: 'John Smith', role: 'Project Manager', status: 'online', joinDate: 'January 2024' },
    { id: 2, name: 'Sarah Johnson', role: 'Lead Developer', status: 'online', joinDate: 'January 2024' },
    { id: 3, name: 'Mike Chen', role: 'UI/UX Designer', status: 'away', joinDate: 'February 2024' },
    { id: 4, name: 'Emily Davis', role: 'QA Engineer', status: 'offline', joinDate: 'February 2024' },
    { id: 5, name: 'Alex Wilson', role: 'Backend Developer', status: 'online', joinDate: 'March 2024' }
  ];

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
      <h3 style={{ marginTop: 0, color: '#2C3E50' }}>Forum Members ({members.length})</h3>
      
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
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: '#3498DB',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              margin: '0 auto 15px',
              fontWeight: 'bold'
            }}>
              {member.name.split(' ').map(n => n[0]).join('')}
            </div>
            
            <strong style={{ color: '#2C3E50', fontSize: '16px' }}>{member.name}</strong>
            
            <div style={{ 
              fontSize: '12px', 
              color: '#7F8C8D', 
              marginTop: '5px',
              marginBottom: '10px'
            }}>
              {member.role}
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '5px',
              marginBottom: '10px'
            }}>
              <span style={{ 
                color: getStatusColor(member.status),
                fontSize: '12px'
              }}>
                ● {member.status}
              </span>
            </div>
            
            <div style={{ fontSize: '11px', color: '#7F8C8D' }}>
              Joined {member.joinDate}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
