import React, { useState } from 'react';
import { COLORS, BUTTON_STYLES, INPUT_STYLES } from '../profile-component/constants';
import { useAuth } from '../../contexts/AuthContext'; // Import useAuth
import { Link } from 'react-router-dom'; // Import Link
import { db } from '../../firebase'; // Import db
import { collection, query, where, getDocs } from 'firebase/firestore'; // Import firestore functions

export default function CreateProjectModal({ isOpen, onClose, onConfirm, editingProject }) {
  const [projectName, setProjectName] = useState('');
  const [teamMembersEmails, setTeamMembersEmails] = useState([]); // Stores only emails
  const [teamMembers, setTeamMembers] = useState([]); // Stores enriched member objects {uid, email, displayName}
  const [newMember, setNewMember] = useState('');
  const [selectedStage, setSelectedStage] = useState('Proposal');
  const [projectDescription, setProjectDescription] = useState(''); // New state for project description
  const { currentUser } = useAuth(); // Get currentUser from AuthContext
  const [allowJoinById, setAllowJoinById] = useState(true); // New state for "Allow Join by ID"

  const projectStages = ['Proposal', 'Negotiation', 'Complete'];

  // Populate form when editing
  React.useEffect(() => {
    if (editingProject) {
      setProjectName(editingProject.name || '');
      setTeamMembersEmails(editingProject.team || []);
      setSelectedStage(editingProject.stage || 'Proposal');
      setProjectDescription(editingProject.description || ''); // Populate description
      setAllowJoinById(editingProject.allowJoinById !== undefined ? editingProject.allowJoinById : true); // Populate allowJoinById, default to true
    } else {
      setProjectName('');
      setTeamMembersEmails(currentUser ? [currentUser.email] : []); // Add current user to team members for new projects
      setSelectedStage('Proposal');
      setProjectDescription(''); // Reset description
      setAllowJoinById(true); // Default to true for new projects
    }
    
    const fetchTeamMemberUids = async () => {
      const memberDetails = await Promise.all(
        teamMembersEmails.map(async (email) => {
          const usersQuery = query(collection(db, "users"), where("email", "==", email));
          const userSnapshot = await getDocs(usersQuery);
          if (!userSnapshot.empty) {
            const userData = userSnapshot.docs[0].data();
            return { 
              uid: userSnapshot.docs[0].id, // Get the UID from the user document
              email: email,
              displayName: userData.name || email.split('@')[0] // Use stored name or derive from email
            };
          } else {
            console.warn(`User document not found for email: ${email}`);
            return { email: email, displayName: email.split('@')[0] }; // Fallback
          }
        })
      );
      setTeamMembers(memberDetails);
    };

    if (teamMembersEmails.length > 0) {
      fetchTeamMemberUids();
    } else {
      setTeamMembers([]); // Clear if no emails
    }

  }, [editingProject, currentUser, teamMembersEmails]); // Add currentUser and teamMembersEmails to dependency array

  const handleAddMember = () => {
    if (newMember.trim() && !teamMembersEmails.includes(newMember.trim())) {
      setTeamMembersEmails([...teamMembersEmails, newMember.trim()]);
      setNewMember('');
    }
  };

  const handleRemoveMember = (memberToRemove) => {
    setTeamMembersEmails(teamMembersEmails.filter(member => member !== memberToRemove));
  };

  const handleSubmit = () => {
    if (projectName.trim() && currentUser) {
      onConfirm({
        name: projectName.trim(),
        team: teamMembersEmails,
        stage: selectedStage,
        description: projectDescription, // Include description
        tasks: editingProject ? editingProject.tasks : 0,
        completedTasks: editingProject ? editingProject.completedTasks : 0,
        userId: currentUser.uid, // Associate project with the current user
        allowJoinById: allowJoinById, // Include allowJoinById
        ...(editingProject && { id: editingProject.id }), // Conditionally add id for existing projects
      });
      // Reset form
      setProjectName('');
      setTeamMembersEmails(currentUser ? [currentUser.email] : []); // Reset to include current user
      setNewMember('');
      setSelectedStage('Proposal');
      setProjectDescription(''); // Reset description
      setAllowJoinById(true); // Reset allowJoinById
    }
  };

  const handleCancel = () => {
    setProjectName('');
    setTeamMembersEmails(currentUser ? [currentUser.email] : []); // Reset to include current user
    setNewMember('');
    setSelectedStage('Proposal');
    setProjectDescription(''); // Reset description
    setAllowJoinById(true); // Reset allowJoinById
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '30px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)'
      }}>
        <h2 style={{ 
          margin: '0 0 24px 0', 
          color: COLORS.dark,
          fontSize: '24px',
          fontWeight: '700',
          textAlign: 'center'
        }}>
          {editingProject ? 'Edit Project' : 'Create New Project'}
        </h2>

        {/* Project Name */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            color: COLORS.dark,
            fontSize: '16px',
            fontWeight: '600'
          }}>
            Project Name *
          </label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Enter project name"
            style={{
              ...INPUT_STYLES.base,
              width: '100%',
              fontSize: '16px',
              padding: '12px'
            }}
          />
        </div>

        {/* Project Description */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            color: COLORS.dark,
            fontSize: '16px',
            fontWeight: '600'
          }}>
            Description
          </label>
          <textarea
            value={projectDescription}
            onChange={(e) => setProjectDescription(e.target.value)}
            placeholder="Enter project description"
            style={{
              ...INPUT_STYLES.base,
              width: '100%',
              minHeight: '80px',
              fontSize: '16px',
              padding: '12px',
              resize: 'vertical'
            }}
          />
        </div>

        {/* Allow Join by ID Checkbox */}
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center' }}>
          <input
            type="checkbox"
            id="allowJoinById"
            checked={allowJoinById}
            onChange={(e) => setAllowJoinById(e.target.checked)}
            style={{ marginRight: '10px', width: '18px', height: '18px' }}
          />
          <label htmlFor="allowJoinById" style={{ color: COLORS.dark, fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>
            Allow others to join by Project ID
          </label>
        </div>

        {/* Team Members */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            color: COLORS.dark,
            fontSize: '16px',
            fontWeight: '600'
          }}>
            Team Members
          </label>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              type="text"
              value={newMember}
              onChange={(e) => setNewMember(e.target.value)}
              placeholder="Add team member"
              style={{
                ...INPUT_STYLES.base,
                flex: 1,
                fontSize: '14px'
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddMember();
                }
              }}
            />
            <button
              onClick={handleAddMember}
              style={{
                ...BUTTON_STYLES.secondary,
                padding: '8px 16px',
                fontSize: '14px'
              }}
            >
              Add
            </button>
          </div>

          {/* Display Added Members */}
          {teamMembers.length > 0 && (
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '8px',
              marginTop: '12px'
            }}>
              {teamMembers.map((member, index) => (
                <div key={index} style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: COLORS.light,
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '14px',
                  color: COLORS.dark
                }}>
                  {member.uid ? (
                    <Link to={`/profile/${member.uid}`} style={{ textDecoration: 'none' }}>
                      <span style={{ cursor: 'pointer', color: COLORS.dark }}>{member.displayName}</span>
                    </Link>
                  ) : (
                    <span style={{ color: COLORS.dark }}>{member.displayName}</span>
                  )}
                  <button
                    onClick={() => handleRemoveMember(member.email)} // Pass email for removal
                    style={{
                      background: 'none',
                      border: 'none',
                      marginLeft: '6px',
                      cursor: 'pointer',
                      color: COLORS.danger,
                      fontSize: '16px',
                      padding: '0',
                      lineHeight: '1'
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Project Stage */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            color: COLORS.dark,
            fontSize: '16px',
            fontWeight: '600'
          }}>
            Project Stage
          </label>
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            style={{
              ...INPUT_STYLES.base,
              width: '100%',
              fontSize: '16px',
              padding: '12px'
            }}
          >
            {projectStages.map(stage => (
              <option key={stage} value={stage}>{stage}</option>
            ))}
          </select>
        </div>

        {/* Buttons */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          justifyContent: 'flex-end',
          marginTop: '30px'
        }}>
          <button
            onClick={handleCancel}
            style={{
              ...BUTTON_STYLES.secondary,
              padding: '12px 24px',
              fontSize: '16px'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!projectName.trim()}
            style={{
              ...BUTTON_STYLES.primary,
              padding: '12px 24px',
              fontSize: '16px',
              opacity: !projectName.trim() ? 0.5 : 1,
              cursor: !projectName.trim() ? 'not-allowed' : 'pointer'
            }}
          >
            {editingProject ? 'Update Project' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}
