import React, { useState } from 'react';
import { COLORS, BUTTON_STYLES, INPUT_STYLES } from '../profile-component/constants';
import { FaCopy } from 'react-icons/fa';

export default function InviteMemberModal({ isOpen, onClose, forumId, forumName, members, onAddMember }) {
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [copySuccess, setCopySuccess] = useState('');

  const handleCopy = () => {
    navigator.clipboard.writeText(forumId)
      .then(() => {
        setCopySuccess('Copied!');
        setTimeout(() => setCopySuccess(''), 2000);
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
        setCopySuccess('Failed to copy.');
      });
  };

  const handleInvite = () => {
    if (newMemberEmail.trim()) {
      onAddMember(newMemberEmail.trim());
      setNewMemberEmail('');
      onClose();
    }
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
          Invite Members to {forumName}
        </h2>

        {/* Forum ID with Copy Button */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            color: COLORS.dark,
            fontSize: '16px',
            fontWeight: '600'
          }}>
            Forum ID
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="text"
              value={forumId}
              readOnly
              style={{
                ...INPUT_STYLES.base,
                flex: 1,
                fontSize: '16px',
                padding: '12px',
                backgroundColor: COLORS.light,
                cursor: 'text'
              }}
            />
            <button
              onClick={handleCopy}
              style={{
                ...BUTTON_STYLES.secondary,
                padding: '12px 16px',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <FaCopy /> {copySuccess || 'Copy'}
            </button>
          </div>
        </div>

        {/* Invite by Email (optional, if direct invite is desired) */}
        {/*
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            color: COLORS.dark,
            fontSize: '16px',
            fontWeight: '600'
          }}>
            Invite by Email
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="email"
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              placeholder="Enter member email"
              style={{
                ...INPUT_STYLES.base,
                flex: 1,
                fontSize: '16px',
                padding: '12px'
              }}
            />
            <button
              onClick={handleInvite}
              style={{
                ...BUTTON_STYLES.primary,
                padding: '12px 24px',
                fontSize: '16px'
              }}
            >
              Invite
            </button>
          </div>
        </div>
        */}

        {/* Current Members List (optional, showing for context) */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            color: COLORS.dark,
            fontSize: '16px',
            fontWeight: '600'
          }}>
            Current Members ({members.length})
          </label>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            maxHeight: '150px',
            overflowY: 'auto',
            border: `1px solid ${COLORS.border}`,
            borderRadius: '8px',
            padding: '10px'
          }}>
            {members.length > 0 ? (
              members.map((member, index) => (
                <span key={index} style={{
                  backgroundColor: COLORS.light,
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '14px',
                  color: COLORS.dark
                }}>{member.email || member.name}</span>
              ))
            ) : (
              <span style={{ color: COLORS.lightText, fontStyle: 'italic' }}>No members yet.</span>
            )}
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
          marginTop: '30px'
        }}>
          <button
            onClick={onClose}
            style={{
              ...BUTTON_STYLES.secondary,
              padding: '12px 24px',
              fontSize: '16px'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
