// src/components/profile-component/CustomerInfo.js
import React, { useState } from "react";
import Card from "./Card";
import { BUTTON_STYLES, INPUT_STYLES } from "./constants"; // Import BUTTON_STYLES and INPUT_STYLES
import { COLORS } from "./constants"; // Import COLORS
import GmailAIReplyModal from "./GmailAIReplyModal";

export default function CustomerInfo({ data, setCustomerProfile }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState(data);
  const [gmailAiOpen, setGmailAiOpen] = useState(false);
  

  const openGmailCompose = (toEmail = '') => {
    try {
      const to = encodeURIComponent(String(toEmail || '').trim());
      const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}`;
      const width = 720;
      const height = 640;
      const left = Math.max(0, Math.round((window.screen.width - width) / 2));
      const top = Math.max(0, Math.round((window.screen.height - height) / 2));
      window.open(
        url,
        'gmail_compose',
        `toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=${width},height=${height},top=${top},left=${left}`
      );
    } catch {}
  };

  const openGmailWithDraft = ({ to, subject, body }) => {
    try {
      const qs = new URLSearchParams({
        view: 'cm',
        fs: '1',
        to: String(to || '').trim(),
        su: subject || '',
        body: body || ''
      });
      const url = `https://mail.google.com/mail/?${qs.toString()}`;
      const width = 720;
      const height = 640;
      const left = Math.max(0, Math.round((window.screen.width - width) / 2));
      const top = Math.max(0, Math.round((window.screen.height - height) / 2));
      window.open(
        url,
        'gmail_compose',
        `toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=${width},height=${height},top=${top},left=${left}`
      );
    } catch {}
  };

  const handleEditToggle = () => {
    if (isEditing) {
      setCustomerProfile(editedData);
    }
    setIsEditing(!isEditing);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditedData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <h3>Customer Profile</h3>
        <button
          onClick={handleEditToggle}
          style={{
            ...BUTTON_STYLES.primary,
            background: isEditing ? COLORS.success : BUTTON_STYLES.primary.background, // Change color to green when saving
            padding: "5px 10px",
            fontSize: "12px"
          }}
        >
          {isEditing ? "Save" : "Edit"}
        </button>
      </div>
      {
        isEditing ? (
          <div>
            <p><strong>Name:</strong> <input type="text" name="name" value={editedData.name} onChange={handleChange} style={{ ...INPUT_STYLES.base, width: "calc(100% - 70px)" }} /></p>
            <p><strong>Email:</strong> <input type="email" name="email" value={editedData.email} onChange={handleChange} style={{ ...INPUT_STYLES.base, width: "calc(100% - 70px)" }} /></p>
            <p><strong>Phone:</strong> <input type="text" name="phone" value={editedData.phone} onChange={handleChange} style={{ ...INPUT_STYLES.base, width: "calc(100% - 70px)" }} /></p>
          </div>
        ) : (
          <div>
            <p><strong>Name:</strong> {data.name}</p>
            <p>
              <strong>Email:</strong> {data.email}
              {data?.email ? (
                <button
                  onClick={() => setGmailAiOpen(true)}
                  style={{ ...BUTTON_STYLES.secondary, marginLeft: "8px" }}
                >
                  Email
                </button>
              ) : null}
            </p>
            <p><strong>Phone:</strong> {data.phone}</p>
          </div>
        )
      }
      <GmailAIReplyModal
        isOpen={gmailAiOpen}
        onClose={() => setGmailAiOpen(false)}
        toEmail={data?.email || ''}
        toName={data?.name || ''}
      />
    </Card>
  );
}
