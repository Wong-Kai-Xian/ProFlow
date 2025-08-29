import React, { useState } from "react";
import { COLORS, BUTTON_STYLES, INPUT_STYLES, LAYOUT } from "./constants";

export default function AddProfileModal({ isOpen, onClose, onAddContact, isLoading = false }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");

  // State for focus styles
  const [nameFocused, setNameFocused] = useState(false);
  const [roleFocused, setRoleFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [companyFocused, setCompanyFocused] = useState(false);

  const handleSubmit = () => {
    if (name.trim() && email.trim() && role.trim()) {
      onAddContact({ name, role, email, phone, company });
      setName("");
      setRole("");
      setEmail("");
      setPhone("");
      setCompany("");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <h3 style={{ color: COLORS.text, marginBottom: LAYOUT.gap }}>Add New Contact</h3>
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => setNameFocused(true)}
          onBlur={() => setNameFocused(false)}
          style={{ 
            ...INPUT_STYLES.base, 
            marginBottom: LAYOUT.smallGap, 
            width: "100%", 
            boxSizing: "border-box",
            transition: "border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out",
            ...(nameFocused && { borderColor: COLORS.primary, boxShadow: `0 0 0 2px ${COLORS.primary}40` })
          }}
        />
        <input
          type="text"
          placeholder="Role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          onFocus={() => setRoleFocused(true)}
          onBlur={() => setRoleFocused(false)}
          style={{
            ...INPUT_STYLES.base,
            marginBottom: LAYOUT.smallGap,
            width: "100%",
            boxSizing: "border-box",
            transition: "border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out",
            ...(roleFocused && { borderColor: COLORS.primary, boxShadow: `0 0 0 2px ${COLORS.primary}40` })
          }}
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={() => setEmailFocused(true)}
          onBlur={() => setEmailFocused(false)}
          style={{
            ...INPUT_STYLES.base,
            marginBottom: LAYOUT.smallGap,
            width: "100%",
            boxSizing: "border-box",
            transition: "border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out",
            ...(emailFocused && { borderColor: COLORS.primary, boxShadow: `0 0 0 2px ${COLORS.primary}40` })
          }}
        />
        <input
          type="text"
          placeholder="Phone (Optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onFocus={() => setPhoneFocused(true)}
          onBlur={() => setPhoneFocused(false)}
          style={{
            ...INPUT_STYLES.base,
            marginBottom: LAYOUT.smallGap,
            width: "100%",
            boxSizing: "border-box",
            transition: "border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out",
            ...(phoneFocused && { borderColor: COLORS.primary, boxShadow: `0 0 0 2px ${COLORS.primary}40` })
          }}
        />
        <input
          type="text"
          placeholder="Company (Optional)"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          onFocus={() => setCompanyFocused(true)}
          onBlur={() => setCompanyFocused(false)}
          style={{
            ...INPUT_STYLES.base,
            marginBottom: LAYOUT.gap,
            width: "100%",
            boxSizing: "border-box",
            transition: "border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out",
            ...(companyFocused && { borderColor: COLORS.primary, boxShadow: `0 0 0 2px ${COLORS.primary}40` })
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: LAYOUT.smallGap }}>
          <button 
            onClick={onClose} 
            style={{ 
              ...BUTTON_STYLES.secondary,
              opacity: isLoading ? 0.6 : 1,
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            style={{ 
              ...BUTTON_STYLES.primary,
              opacity: isLoading ? 0.6 : 1,
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
            disabled={isLoading}
          >
            {isLoading ? 'Creating...' : 'Add Contact'}
          </button>
        </div>
      </div>
    </div>
  );
}

const modalOverlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.7)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
};

const modalContentStyle = {
  backgroundColor: COLORS.background,
  padding: LAYOUT.gap,
  borderRadius: LAYOUT.borderRadius,
  boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
  width: "90%",
  maxWidth: "400px",
  maxHeight: "80vh",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
};
