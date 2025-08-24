
import React, { useState, useEffect } from 'react';
import { COLORS, INPUT_STYLES, BUTTON_STYLES } from "../profile-component/constants";
import { db } from "../../firebase"; // Import db
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import ShareInviteLinkModal from './ShareInviteLinkModal';
import { getAcceptedTeamMembers } from '../../services/teamService';

export default function InviteMemberModal({ isOpen, onClose, onInvite, currentUser }) {
  const [activeTab, setActiveTab] = useState('invite'); // 'invite' or 'add'
  const [email, setEmail] = useState('');
  const [selectedMember, setSelectedMember] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [signupLink, setSignupLink] = useState('');
  const [foundUserEmail, setFoundUserEmail] = useState(''); // To store the email of the found user if invited
  const [isLoading, setIsLoading] = useState(false); // Add loading state
  const [acceptedMembers, setAcceptedMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const auth = getAuth();

  // Fetch accepted members when modal opens
  useEffect(() => {
    const fetchAcceptedMembers = async () => {
      if (!isOpen || !currentUser) return;
      
      setLoadingMembers(true);
      try {
        const members = await getAcceptedTeamMembers(currentUser);
        setAcceptedMembers(members);
      } catch (error) {
        console.error("Error fetching accepted team members:", error);
        setAcceptedMembers([]);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchAcceptedMembers();
  }, [isOpen, currentUser]);

  // Reset states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('invite');
      setEmail('');
      setSelectedMember('');
      setIsLoading(false);
      setShowShareModal(false);
      setSignupLink('');
      setFoundUserEmail('');
    }
  }, [isOpen]);

  const handleAddExistingMember = async (e) => {
    e.preventDefault();
    
    if (isLoading || !selectedMember) return;
    
    setIsLoading(true);
    try {
      const member = acceptedMembers.find(m => m.id === selectedMember);
      if (member) {
        onInvite(member.email, true, null, { 
          id: 'existing-' + member.id, 
          fromUserId: auth.currentUser.uid, 
          toUserId: member.id, 
          toUserEmail: member.email, 
          status: "accepted", 
          timestamp: new Date() 
        });
        onClose();
      }
    } catch (error) {
      console.error("Error adding member: ", error);
      alert("Error adding member. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prevent multiple submissions
    if (isLoading) {
      return;
    }
    
    // setMessage(''); // Clear previous messages
    if (!email.trim()) {
      alert("Please enter an email address."); // Use alert for now, can be replaced by a more sophisticated notification
      return;
    }

    setIsLoading(true); // Set loading state

    try {
      // Check if user exists in our Firestore 'users' collection
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // User exists, send an invitation
        const invitedUserId = querySnapshot.docs[0].id;
        const currentUserId = auth.currentUser.uid;

        // Add invitation to a 'invitations' collection
        const docRef = await addDoc(collection(db, "invitations"), {
          fromUserId: currentUserId,
          fromUserEmail: auth.currentUser?.email || '',
          toUserId: invitedUserId,
          toUserEmail: email,
          status: "pending",
          timestamp: new Date(),
        });
        setFoundUserEmail(email);
        onInvite(email, true, null, { id: docRef.id, fromUserId: currentUserId, toUserId: invitedUserId, toUserEmail: email, status: "pending", timestamp: new Date() }); // Pass the new invitation object
        onClose(); // Close the invite modal on successful invitation
      } else {
        // User does not exist, provide a signup link
        const newSignupUrl = `${window.location.origin}/signup?email=${encodeURIComponent(email)}`;
        setSignupLink(newSignupUrl);
        setShowShareModal(true); // Open the new share modal
        // onInvite(email, false, signupUrl); // This will be handled by the ShareInviteLinkModal
      }
    } catch (error) {
      console.error("Error inviting member: ", error);
      alert("Error sending invitation. Please try again.");
    } finally {
      setIsLoading(false); // Reset loading state
    }
  };

  if (!isOpen) return null;

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <h2 style={{ color: COLORS.text, marginBottom: '20px' }}>Team Member Management</h2>
        
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0', marginBottom: '20px' }}>
          <button
            onClick={() => setActiveTab('invite')}
            style={{
              ...BUTTON_STYLES.secondary,
              borderRadius: '0',
              border: 'none',
              borderBottom: activeTab === 'invite' ? '2px solid ' + COLORS.primary : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'invite' ? COLORS.primary : COLORS.lightText,
              padding: '10px 20px',
              fontWeight: activeTab === 'invite' ? '600' : '400'
            }}
          >
            Invite New Member
          </button>
          <button
            onClick={() => setActiveTab('add')}
            style={{
              ...BUTTON_STYLES.secondary,
              borderRadius: '0',
              border: 'none',
              borderBottom: activeTab === 'add' ? '2px solid ' + COLORS.primary : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'add' ? COLORS.primary : COLORS.lightText,
              padding: '10px 20px',
              fontWeight: activeTab === 'add' ? '600' : '400'
            }}
          >
            Add Existing Member
          </button>
        </div>

        {/* Invite New Member Tab */}
        {activeTab === 'invite' && (
          <form onSubmit={handleSubmit}>
            <p style={{ color: COLORS.lightText, marginBottom: '15px', fontSize: '14px' }}>
              Send an invitation to a new user via email, WhatsApp, or other platforms.
            </p>
            <input
              type="email"
              placeholder="Enter user's email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ ...INPUT_STYLES.base, marginBottom: '15px' }}
              required
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={onClose} style={BUTTON_STYLES.secondary}>
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isLoading}
                style={{
                  ...BUTTON_STYLES.primary,
                  opacity: isLoading ? 0.6 : 1,
                  cursor: isLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {isLoading ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </form>
        )}

        {/* Add Existing Member Tab */}
        {activeTab === 'add' && (
          <form onSubmit={handleAddExistingMember}>
            <p style={{ color: COLORS.lightText, marginBottom: '15px', fontSize: '14px' }}>
              Add someone from your accepted team members list.
            </p>
            {loadingMembers ? (
              <p style={{ color: COLORS.lightText, fontSize: '14px' }}>Loading team members...</p>
            ) : (
              <select
                value={selectedMember}
                onChange={(e) => setSelectedMember(e.target.value)}
                style={{ ...INPUT_STYLES.base, marginBottom: '15px' }}
                required
              >
                <option value="">-- Select from accepted team --</option>
                {acceptedMembers.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.email})
                  </option>
                ))}
              </select>
            )}
            
            {acceptedMembers.length === 0 && !loadingMembers && (
              <p style={{ color: COLORS.lightText, fontSize: '12px', marginBottom: '15px' }}>
                No accepted team members available. Send invitations first.
              </p>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={onClose} style={BUTTON_STYLES.secondary}>
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isLoading || !selectedMember}
                style={{
                  ...BUTTON_STYLES.primary,
                  opacity: (isLoading || !selectedMember) ? 0.6 : 1,
                  cursor: (isLoading || !selectedMember) ? 'not-allowed' : 'pointer'
                }}
              >
                {isLoading ? 'Adding...' : 'Add Member'}
              </button>
            </div>
          </form>
        )}
      </div>
      <ShareInviteLinkModal 
        isOpen={showShareModal} 
        onClose={() => { 
          setShowShareModal(false);
          setIsLoading(false); // Reset loading state when share modal closes
          onClose(); // Close the parent modal as well
        }}
        signupLink={signupLink}
        emailToInvite={email} // Pass the email that was entered
      />
    </div>
  );
}

const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
};

const modalContentStyle = {
  backgroundColor: 'white',
  padding: '30px',
  borderRadius: '12px',
  width: '500px',
  maxWidth: '90%',
  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
  textAlign: 'left',
};
