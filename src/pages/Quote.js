import React from 'react';
import TopBar from '../components/TopBar';
import { COLORS } from '../components/profile-component/constants';
import { useAuth } from '../contexts/AuthContext';

export default function Quote() {
  const { currentUser } = useAuth();

  return (
    <div style={{
      fontFamily: "Arial, sans-serif",
      background: COLORS.background,
      minHeight: "100vh"
    }}>
      <TopBar />
      <div style={{
        padding: "30px",
        maxWidth: "1200px",
        margin: "0 auto",
      }}>
        <h1 style={{ color: COLORS.dark, marginBottom: "30px" }}>My Quotes</h1>

        {!currentUser ? (
          <p style={{ color: COLORS.danger, fontSize: "18px", textAlign: "center" }}>Please log in to view and manage your quotes.</p>
        ) : (
          <p style={{ color: COLORS.text, fontSize: "16px", textAlign: "center" }}>
            Quote functionality is not yet implemented. This will display quotes specific to {currentUser.email}.
          </p>
        )}
      </div>
    </div>
  );
}
