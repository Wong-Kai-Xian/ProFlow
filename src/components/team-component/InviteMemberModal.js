
import React, { useState, useEffect } from 'react';
import { COLORS, INPUT_STYLES, BUTTON_STYLES } from "../profile-component/constants";
import { db } from "../../firebase"; // Import db
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import ShareInviteLinkModal from './ShareInviteLinkModal';
// Removed accepted team member add-existing flow from Team modal

export default function InviteMemberModal({ isOpen, onClose, onInvite, currentUser }) {
  const [activeTab, setActiveTab] = useState('invite'); // 'invite' or 'add'
  const [email, setEmail] = useState('');
  // removed selectedMember for add-existing flow
  const [showShareModal, setShowShareModal] = useState(false);
  const [signupLink, setSignupLink] = useState('');
  const [foundUserEmail, setFoundUserEmail] = useState(''); // To store the email of the found user if invited
  const [isLoading, setIsLoading] = useState(false); // Add loading state
  // removed acceptedMembers state
  const auth = getAuth();

  // removed fetching accepted members

  // Reset states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('invite');
      setEmail('');
      // removed selectedMember reset
      setIsLoading(false);
      setShowShareModal(false);
      setSignupLink('');
      setFoundUserEmail('');
    }
  }, [isOpen]);

  // removed handleAddExistingMember

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
        
        {/* Invite only */}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
              <button type="button" onClick={() => {
                try {
                  const signupUrl = `${window.location.origin}/signup`;
                  const text = `Join me on ProFlow to collaborate: ${signupUrl}`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                } catch {}
              }} style={BUTTON_STYLES.secondary}>
                Share via WhatsApp
              </button>
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
        {/* removed Add Existing Member Tab */}
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
