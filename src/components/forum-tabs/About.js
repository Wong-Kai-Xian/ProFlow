import React from "react";
import { COLORS } from "../profile-component/constants";

export default function About() {
  return (
    <div>
      <h3 style={{ marginTop: 0, color: COLORS.dark, fontSize: "16px", fontWeight: "700" }}>About This Forum</h3>
      
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '10px',
        border: '1px solid #ECF0F1',
        marginBottom: '20px'
      }}>
        <h4 style={{ color: COLORS.dark, marginTop: 0, fontSize: "15px", fontWeight: "600" }}>Project Alpha Discussion</h4>
        <p style={{ color: COLORS.lightText, lineHeight: '1.6', fontSize: "15px" }}>
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
        <h4 style={{ color: COLORS.dark, marginTop: 0, fontSize: "15px", fontWeight: "600" }}>Forum Statistics</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: COLORS.primary }}>127</div>
            <div style={{ fontSize: '14px', color: COLORS.lightText }}>Total Posts</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: COLORS.success }}>5</div>
            <div style={{ fontSize: '14px', color: COLORS.lightText }}>Active Members</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: COLORS.warning }}>23</div>
            <div style={{ fontSize: '14px', color: COLORS.lightText }}>Files Shared</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: COLORS.danger }}>8</div>
            <div style={{ fontSize: '14px', color: COLORS.lightText }}>Meetings Scheduled</div>
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
