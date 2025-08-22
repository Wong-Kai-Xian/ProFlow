
import React, { useState } from 'react';
import { COLORS, INPUT_STYLES, BUTTON_STYLES } from "../profile-component/constants";
import { db } from "../../firebase"; // Import db
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import ShareInviteLinkModal from './ShareInviteLinkModal';

export default function InviteMemberModal({ isOpen, onClose, onInvite }) {
  const [email, setEmail] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [signupLink, setSignupLink] = useState('');
  const [foundUserEmail, setFoundUserEmail] = useState(''); // To store the email of the found user if invited
  const auth = getAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    // setMessage(''); // Clear previous messages
    if (!email.trim()) {
      alert("Please enter an email address."); // Use alert for now, can be replaced by a more sophisticated notification
      return;
    }

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
    }
    setEmail('');
  };

  if (!isOpen) return null;

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <h2 style={{ color: COLORS.text, marginBottom: '20px' }}>Invite Team Member</h2>
        <form onSubmit={handleSubmit}>
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
            <button type="submit" style={BUTTON_STYLES.primary}>
              Invite
            </button>
          </div>
        </form>
        {/* {message && <p style={{ marginTop: '20px', color: COLORS.text }}>{message}</p>} */}
      </div>
      <ShareInviteLinkModal 
        isOpen={showShareModal} 
        onClose={() => { 
          setShowShareModal(false);
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
  borderRadius: '8px',
  width: '400px',
  maxWidth: '90%',
  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
  textAlign: 'center',
};
