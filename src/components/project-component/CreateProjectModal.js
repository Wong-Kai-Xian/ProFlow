import React, { useState } from 'react';
import { COLORS, BUTTON_STYLES, INPUT_STYLES } from '../profile-component/constants';
import { useAuth } from '../../contexts/AuthContext'; // Import useAuth
import { Link } from 'react-router-dom'; // Import Link
import { db } from '../../firebase'; // Import db
import { collection, query, where, getDocs } from 'firebase/firestore'; // Import firestore functions
import { getAcceptedTeamMembers } from '../../services/teamService';

export default function CreateProjectModal({ isOpen, onClose, onConfirm, editingProject, customerProfile, companyProfile }) {
  const [projectName, setProjectName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [teamMembersEmails, setTeamMembersEmails] = useState([]); // Stores only emails
  const [teamMembers, setTeamMembers] = useState([]); // Stores enriched member objects {uid, email, displayName}
  const [newMember, setNewMember] = useState('');
  const [selectedStage, setSelectedStage] = useState('Planning');
  const [deadline, setDeadline] = useState('');
  const [projectDescription, setProjectDescription] = useState(''); // New state for project description
  const { currentUser } = useAuth(); // Get currentUser from AuthContext
  const [allowJoinById, setAllowJoinById] = useState(true); // New state for "Allow Join by ID"
  const [acceptedTeamMembers, setAcceptedTeamMembers] = useState([]); // Accepted team members
  const [loadingAcceptedMembers, setLoadingAcceptedMembers] = useState(false);

  const projectStages = ['Planning', 'Development', 'Testing', 'Completed'];

  // Fetch accepted team members when modal opens
  React.useEffect(() => {
    const fetchAcceptedMembers = async () => {
      if (!isOpen || !currentUser) return;
      
      setLoadingAcceptedMembers(true);
      try {
        const members = await getAcceptedTeamMembers(currentUser);
        setAcceptedTeamMembers(members);
      } catch (error) {
        console.error("Error fetching accepted team members:", error);
        setAcceptedTeamMembers([]);
      } finally {
        setLoadingAcceptedMembers(false);
      }
    };

    fetchAcceptedMembers();
  }, [isOpen, currentUser]);

  // Populate form when editing
  React.useEffect(() => {
    if (editingProject) {
      setProjectName(editingProject.name || '');
      setCompanyName(
        editingProject.companyInfo?.companyName ||
        editingProject.company ||
        companyProfile?.company ||
        companyProfile?.companyName ||
        ''
      );
      setCustomerEmail(
        editingProject.companyInfo?.customerEmail ||
        editingProject.contactEmail ||
        customerProfile?.email ||
        ''
      );
      setCustomerName(
        editingProject.companyInfo?.customerName ||
        editingProject.contactPerson ||
        editingProject.customerName ||
        customerProfile?.name ||
        `${customerProfile?.firstName||''} ${customerProfile?.lastName||''}`.trim() ||
        ''
      );
      setTeamMembersEmails(editingProject.team || []);
      setSelectedStage(editingProject.stage || 'Planning');
      setProjectDescription(editingProject.description || ''); // Populate description
      setAllowJoinById(editingProject.allowJoinById !== undefined ? editingProject.allowJoinById : true); // Populate allowJoinById, default to true
      setDeadline(editingProject.deadline || '');
    } else {
      // For new projects, pre-fill from customerProfile and companyProfile if available
      if (!projectName) setProjectName(customerProfile?.name || '');
      if (!companyName) setCompanyName(companyProfile?.company || companyProfile?.companyName || '');
      if (!customerEmail) setCustomerEmail(customerProfile?.email || '');
      if (!customerName) setCustomerName(customerProfile?.name || `${customerProfile?.firstName||''} ${customerProfile?.lastName||''}`.trim() || '');
      // Don't automatically add creator to team members - they're already the project owner
      // Leave team members empty by default
      if (!selectedStage) setSelectedStage('Planning');
      if (!projectDescription) setProjectDescription(companyProfile?.description || '');
      setDeadline('');
      // Only set allowJoinById if it hasn't been explicitly set yet, or if it needs to be reset for a new project
      if (editingProject === null) { // Only for truly new projects
        setAllowJoinById(true);
      }
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

  }, [editingProject, currentUser, teamMembersEmails, customerProfile, companyProfile]); // Add currentUser and teamMembersEmails to dependency array

  const handleAddMember = () => {
    if (newMember && !teamMembersEmails.includes(newMember)) {
      const selectedMember = acceptedTeamMembers.find(member => member.id === newMember);
      if (selectedMember) {
        setTeamMembersEmails([...teamMembersEmails, selectedMember.email]);
        setNewMember('');
      }
    }
  };

  const handleRemoveMember = (memberToRemove) => {
    setTeamMembersEmails(teamMembersEmails.filter(member => member !== memberToRemove));
  };

  const handleSubmit = async () => {
    if (projectName.trim() && currentUser) {
      // Resolve emails to user UIDs for project team field
      let resolvedTeam = [];
      try {
        const chunkSize = 10;
        for (let i = 0; i < teamMembersEmails.length; i += chunkSize) {
          const chunk = teamMembersEmails.slice(i, i + chunkSize);
          const usersQuery = query(collection(db, "users"), where("email", "in", chunk));
          const usersSnapshot = await getDocs(usersQuery);
          const uidByEmail = new Map();
          usersSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.email) uidByEmail.set(data.email, data.uid || docSnap.id);
          });
          chunk.forEach(email => {
            const uid = uidByEmail.get(email);
            if (uid) resolvedTeam.push(uid);
          });
        }
      } catch (e) {
        console.warn('Failed to resolve some team emails to user IDs. Proceeding with resolved ones only.', e);
      }

      onConfirm({
        name: projectName.trim(),
        company: companyName.trim(),
        contactEmail: customerEmail.trim(),
        customerName: customerName.trim(),
        companyInfo: {
          companyName: companyName.trim(),
          customerEmail: customerEmail.trim(),
          customerName: customerName.trim()
        },
        team: resolvedTeam,
        stage: selectedStage,
        description: projectDescription, // Include description
        deadline: deadline || '',
        tasks: editingProject ? editingProject.tasks : 0,
        completedTasks: editingProject ? editingProject.completedTasks : 0,
        ownerId: currentUser.uid, // Associate project with the current user
        allowJoinById: allowJoinById, // Include allowJoinById
        ...(editingProject && { id: editingProject.id }), // Conditionally add id for existing projects
      });
      // Reset form
      setProjectName('');
      setCompanyName('');
      setCustomerEmail('');
      setCustomerName('');
      setTeamMembersEmails([]); // Reset to empty - don't auto-add creator
      setNewMember('');
      setSelectedStage('Planning');
      setProjectDescription(''); // Reset description
      setAllowJoinById(true); // Reset allowJoinById
      setDeadline('');
    }
  };

  const handleCancel = () => {
    setProjectName('');
    setCompanyName('');
    setCustomerEmail('');
    setCustomerName('');
    setTeamMembersEmails([]); // Reset to empty - don't auto-add creator
    setNewMember('');
    setSelectedStage('Planning');
    setProjectDescription(''); // Reset description
    setAllowJoinById(true); // Reset allowJoinById
    setDeadline('');
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

        {/* Company */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            color: COLORS.dark,
            fontSize: '16px',
            fontWeight: '600'
          }}>
            Company
          </label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Company name"
            style={{
              ...INPUT_STYLES.base,
              width: '100%',
              fontSize: '16px',
              padding: '12px'
            }}
          />
        </div>

        {/* Customer Name */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            color: COLORS.dark,
            fontSize: '16px',
            fontWeight: '600'
          }}>
            Customer Name
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Customer full name"
            style={{
              ...INPUT_STYLES.base,
              width: '100%',
              fontSize: '16px',
              padding: '12px'
            }}
          />
        </div>

        {/* Customer Email */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            color: COLORS.dark,
            fontSize: '16px',
            fontWeight: '600'
          }}>
            Customer Email
          </label>
          <input
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="customer@example.com"
            style={{
              ...INPUT_STYLES.base,
              width: '100%',
              fontSize: '16px',
              padding: '12px'
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
          
          {loadingAcceptedMembers ? (
            <p style={{ color: COLORS.lightText, fontSize: '14px' }}>Loading accepted team members...</p>
          ) : (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <select
                value={newMember}
                onChange={(e) => setNewMember(e.target.value)}
                style={{
                  ...INPUT_STYLES.base,
                  flex: 1,
                  fontSize: '14px'
                }}
              >
                <option value="">-- Select from accepted team --</option>
                {acceptedTeamMembers
                  .filter(member => !teamMembersEmails.includes(member.email))
                  .map(member => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.email})
                    </option>
                  ))
                }
              </select>
              <button
                onClick={handleAddMember}
                style={{
                  ...BUTTON_STYLES.secondary,
                  padding: '8px 16px',
                  fontSize: '14px'
                }}
                disabled={!newMember}
              >
                Add
              </button>
            </div>
          )}
          
          {acceptedTeamMembers.length === 0 && !loadingAcceptedMembers && (
            <p style={{ color: COLORS.lightText, fontSize: '12px' }}>
              No accepted team members available. Send invitations from the Team page first.
            </p>
          )}

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

        {/* Deadline */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            color: COLORS.dark,
            fontSize: '16px',
            fontWeight: '600'
          }}>
            Deadline
          </label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            style={{
              ...INPUT_STYLES.base,
              width: '100%',
              fontSize: '16px',
              padding: '12px'
            }}
          />
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
