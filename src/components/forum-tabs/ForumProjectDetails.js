import React, { useState } from 'react';

export default function ForumProjectDetails({ forumData }) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Mock project details based on forum data
  const projectDetails = {
    name: forumData?.name || "Project Alpha Discussion",
    company: "Acme Corp",
    industry: "Technology",
    contact: "john@acmecorp.com",
    startDate: "2025-01-15",
    deadline: "2025-03-30",
    status: "In Progress",
    description: forumData?.description || "Main discussion forum for Project Alpha development, updates, and team collaboration. This project involves creating a comprehensive solution for our client's needs."
  };

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '10px',
      padding: '15px',
      marginBottom: '15px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      border: '1px solid #ECF0F1'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
        cursor: 'pointer'
      }} onClick={() => setIsExpanded(!isExpanded)}>
        <h3 style={{ 
          margin: 0, 
          color: '#2C3E50', 
          fontSize: '16px',
          fontWeight: '600'
        }}>
          Project Details
        </h3>
        <span style={{ 
          color: '#7F8C8D', 
          fontSize: '12px',
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.3s ease'
        }}>
          ▼
        </span>
      </div>

      {isExpanded && (
        <div>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ 
              fontSize: '12px', 
              fontWeight: '600', 
              color: '#2C3E50' 
            }}>
              Project:
            </span>
            <span style={{ 
              fontSize: '12px', 
              color: '#7F8C8D', 
              marginLeft: '8px' 
            }}>
              {projectDetails.name}
            </span>
          </div>

          <div style={{ marginBottom: '8px' }}>
            <span style={{ 
              fontSize: '12px', 
              fontWeight: '600', 
              color: '#2C3E50' 
            }}>
              Company:
            </span>
            <span style={{ 
              fontSize: '12px', 
              color: '#7F8C8D', 
              marginLeft: '8px' 
            }}>
              {projectDetails.company}
            </span>
          </div>

          <div style={{ marginBottom: '8px' }}>
            <span style={{ 
              fontSize: '12px', 
              fontWeight: '600', 
              color: '#2C3E50' 
            }}>
              Status:
            </span>
            <span style={{ 
              fontSize: '11px', 
              color: 'white',
              backgroundColor: '#27AE60',
              padding: '2px 6px',
              borderRadius: '10px',
              marginLeft: '8px'
            }}>
              {projectDetails.status}
            </span>
          </div>

          <div style={{ marginBottom: '8px' }}>
            <span style={{ 
              fontSize: '12px', 
              fontWeight: '600', 
              color: '#2C3E50' 
            }}>
              Deadline:
            </span>
            <span style={{ 
              fontSize: '12px', 
              color: '#E74C3C', 
              marginLeft: '8px' 
            }}>
              {new Date(projectDetails.deadline).toLocaleDateString()}
            </span>
          </div>

          <div style={{ marginTop: '10px' }}>
            <span style={{ 
              fontSize: '12px', 
              fontWeight: '600', 
              color: '#2C3E50',
              display: 'block',
              marginBottom: '5px'
            }}>
              Description:
            </span>
            <p style={{ 
              fontSize: '11px', 
              color: '#7F8C8D', 
              margin: 0,
              lineHeight: '1.4',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}>
              {projectDetails.description}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
