import React from 'react';
import { COLORS, BUTTON_STYLES, INPUT_STYLES } from "../profile-component/constants";

export default function ShareInviteLinkModal({ isOpen, onClose, signupLink, emailToInvite }) {
  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(signupLink);
      alert('Link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy: ', err);
      alert('Failed to copy link.');
    }
  };

  const handleShareEmail = () => {
    const subject = 'Invitation to ProFlow';
    const body = `Hi! You're invited to join ProFlow. Please sign up using this link: ${signupLink}`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const handleShareWhatsApp = () => {
    const text = `Hi! You're invited to join ProFlow. Please sign up using this link: ${signupLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  const handleShareTelegram = () => {
    const text = `Hi! You're invited to join ProFlow. Please sign up using this link: ${signupLink}`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(signupLink)}&text=${encodeURIComponent(text)}`);
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <h2 style={{ color: COLORS.text, marginBottom: '20px' }}>Invite New Member</h2>
        <p style={{ color: COLORS.dark, marginBottom: '15px' }}>
          User with email <span style={{ fontWeight: 'bold', color: COLORS.danger }}>{emailToInvite}</span> not found.
          Share this link for them to sign up:
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <input
            type="text"
            value={signupLink}
            readOnly
            style={{ ...INPUT_STYLES.base, flex: 1, cursor: 'text' }}
          />
          <button onClick={handleCopyLink} style={{ ...BUTTON_STYLES.primary, padding: '10px 15px' }}>
            Copy Link
          </button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <p style={{ color: COLORS.text, marginBottom: '10px' }}>Or share via:</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
            <button onClick={handleShareEmail} style={BUTTON_STYLES.secondary}>
              Email
            </button>
            <button onClick={handleShareWhatsApp} style={{ ...BUTTON_STYLES.secondary, backgroundColor: '#25D366', color: 'white' }}>
              WhatsApp
            </button>
            <button onClick={handleShareTelegram} style={{ ...BUTTON_STYLES.secondary, backgroundColor: '#0088CC', color: 'white' }}>
              Telegram
            </button>
          </div>
        </div>

        <button onClick={onClose} style={BUTTON_STYLES.secondary}>
          Close
        </button>
      </div>
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
  width: '500px',
  maxWidth: '90%',
  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
  textAlign: 'center',
};
