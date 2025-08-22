import React from 'react';
import { Link } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { app } from '../firebase';

// Animation styles - similar to login/signup pages for consistency
const BACKGROUND_ANIMATION_STYLES = `
  @keyframes gradientAnimation {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }

  .animated-gradient-background {
    background: linear-gradient(45deg, #3498DB, #8E44AD, #2ECC71, #F1C40F);
    background-size: 400% 400%;
    animation: gradientAnimation 15s ease infinite;
  }
`;

export default function VerifyEmail() {
  const auth = getAuth(app);
  const userEmail = auth.currentUser?.email || "your email";

  const handleResendVerification = async () => {
    try {
      if (auth.currentUser) {
        await auth.currentUser.sendEmailVerification();
        alert("Verification email has been resent!");
      }
    } catch (error) {
      console.error("Error sending verification email:", error);
      alert("Failed to resend verification email. Please try again later.");
    }
  };

  return (
    <div style={styles.container} className="animated-gradient-background">
      <style>{BACKGROUND_ANIMATION_STYLES}</style>
      <div style={styles.verifyBox}>
        <img src="/proflow-logo.png" alt="ProFlow Logo" style={styles.logo} />
        <h2 style={styles.title}>Verify Your Email</h2>
        <p style={styles.message}>
          A verification email has been sent to <strong>{userEmail}</strong>
        </p>
        <p style={styles.instructions}>
          Please check your inbox and click on the verification link to complete your registration.
        </p>
        <p style={styles.subInstructions}>
          If you don't see the email, please check your spam folder.
        </p>
        
        <button onClick={handleResendVerification} style={styles.button}>
          Resend Verification Email
        </button>
        
        <div style={styles.linkContainer}>
          <Link to="/login" style={styles.link}>Back to Login</Link>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #2c3e50 0%, #0a1419 100%)',
    fontFamily: 'Arial, sans-serif',
    overflow: 'hidden',
    position: 'relative',
  },
  verifyBox: {
    background: 'rgba(255, 255, 255, 0.1)',
    padding: '40px',
    borderRadius: '15px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
    textAlign: 'center',
    maxWidth: '500px',
    width: '90%',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    zIndex: 1,
    color: 'white',
  },
  logo: {
    width: '150px',
    height: 'auto',
    marginBottom: '30px',
    display: 'block',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  title: {
    margin: '0 0 20px 0',
    fontSize: '28px',
    fontWeight: 'bold',
  },
  message: {
    fontSize: '18px',
    marginBottom: '20px',
  },
  instructions: {
    fontSize: '16px',
    marginBottom: '10px',
    lineHeight: '1.5',
  },
  subInstructions: {
    fontSize: '14px',
    color: '#ccc',
    marginBottom: '30px',
  },
  button: {
    padding: '12px 20px',
    borderRadius: '8px',
    border: 'none',
    background: '#3498DB',
    color: 'white',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background 0.3s ease, transform 0.2s ease',
    width: '100%',
    marginBottom: '20px',
  },
  linkContainer: {
    marginTop: '20px',
  },
  link: {
    color: '#3498DB',
    textDecoration: 'none',
    fontSize: '16px',
    transition: 'color 0.3s ease',
  },
};
