import React from "react";

export default function About() {
  return (
    <div>
      <h3 style={{ marginTop: 0, color: '#2C3E50' }}>About This Forum</h3>
      
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '10px',
        border: '1px solid #ECF0F1',
        marginBottom: '20px'
      }}>
        <h4 style={{ color: '#2C3E50', marginTop: 0 }}>Project Alpha Discussion</h4>
        <p style={{ color: '#7F8C8D', lineHeight: '1.6' }}>
          This forum is dedicated to discussions, updates, and collaboration for Project Alpha. 
          Here you can share ideas, ask questions, schedule meetings, and keep track of project progress.
        </p>
      </div>

      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '10px',
        border: '1px solid #ECF0F1',
        marginBottom: '20px'
      }}>
        <h4 style={{ color: '#2C3E50', marginTop: 0 }}>Forum Statistics</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3498DB' }}>127</div>
            <div style={{ fontSize: '12px', color: '#7F8C8D' }}>Total Posts</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#27AE60' }}>5</div>
            <div style={{ fontSize: '12px', color: '#7F8C8D' }}>Active Members</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#F39C12' }}>23</div>
            <div style={{ fontSize: '12px', color: '#7F8C8D' }}>Files Shared</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#E74C3C' }}>8</div>
            <div style={{ fontSize: '12px', color: '#7F8C8D' }}>Meetings Scheduled</div>
          </div>
        </div>
      </div>

      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '10px',
        border: '1px solid #ECF0F1'
      }}>
        <h4 style={{ color: '#2C3E50', marginTop: 0 }}>Forum Guidelines</h4>
        <ul style={{ color: '#7F8C8D', lineHeight: '1.6' }}>
          <li>Keep discussions relevant to the project</li>
          <li>Be respectful and professional in all interactions</li>
          <li>Use appropriate labels for meetings and file uploads</li>
          <li>Search existing posts before creating new ones</li>
          <li>Use @mentions to notify specific team members</li>
        </ul>
      </div>
    </div>
  );
}
