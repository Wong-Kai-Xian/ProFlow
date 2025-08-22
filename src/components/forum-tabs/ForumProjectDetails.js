import React, { useState, useEffect } from 'react';
import { db } from "../../firebase"; // Import db
import { doc, getDoc, onSnapshot } from "firebase/firestore"; // Import Firestore functions

export default function ForumProjectDetails({ forumData }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [project, setProject] = useState(null); // State to hold actual project data
  const [loading, setLoading] = useState(true); // State for loading status
  const [error, setError] = useState(null); // State for error handling

  useEffect(() => {
    const fetchProjectDetails = async () => {
      if (!forumData?.projectId) {
        setProject(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const projectRef = doc(db, "projects", forumData.projectId);
        const unsubscribe = onSnapshot(projectRef, (projectSnap) => {
          if (projectSnap.exists()) {
            setProject({ id: projectSnap.id, ...projectSnap.data() });
            setError(null); // Clear any previous errors
          } else {
            setProject(null);
            setError("Project not found.");
          }
          setLoading(false);
        }, (err) => {
          console.error("Error fetching project details for forum:", err);
          setError("Failed to load project details.");
          setLoading(false);
        });
        return unsubscribe; // Return the unsubscribe function for cleanup
      } catch (err) {
        console.error("Error setting up project snapshot listener:", err);
        setError("Failed to set up project listener.");
        setLoading(false);
        return () => {}; // Return a no-op function for cleanup
      }
    };

    return fetchProjectDetails(); // Call and return the cleanup function
  }, [forumData?.projectId]); // Re-fetch when projectId changes

  // Mock project details based on forum data
  // const projectDetails = {
  //   name: forumData?.name || "Project Alpha Discussion",
  //   company: "Acme Corp",
  //   industry: "Technology",
  //   contact: "john@acmecorp.com",
  //   startDate: "2025-01-15",
  //   deadline: "2025-03-30",
  //   status: "In Progress",
  //   description: forumData?.description || "Main discussion forum for Project Alpha development, updates, and team collaboration. This project involves creating a comprehensive solution for our client's needs."
  // };

  if (loading) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '10px',
        padding: '15px',
        marginBottom: '15px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        border: '1px solid #ECF0F1'
      }}>
        <p style={{ color: '#7F8C8D' }}>Loading project details...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '10px',
        padding: '15px',
        marginBottom: '15px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        border: '1px solid #ECF0F1'
      }}>
        <p style={{ color: '#E74C3C' }}>{error || "No project details available."}</p>
      </div>
    );
  }

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
              {project.name}
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
              {project.companyInfo?.name || 'N/A'}
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
              {project.status}
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
              {project.deadline ? new Date(project.deadline).toLocaleDateString() : 'N/A'}
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
              {project.description || 'No description provided.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
