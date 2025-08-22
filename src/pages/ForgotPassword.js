import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { app } from '../firebase';

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

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const auth = getAuth(app);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage('');
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Password reset email sent! Please check your inbox.');
      setEmail(''); // Clear the email field after success
    } catch (err) {
      console.error("Password reset error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container} className="animated-gradient-background">
      <style>{BACKGROUND_ANIMATION_STYLES}</style>
      <div style={styles.resetBox}>
        <h2 style={styles.title}>Reset Your Password</h2>
        <p style={styles.subtitle}>Enter your email to receive a password reset link</p>
        <img src="/proflow-logo.png" alt="ProFlow Logo" style={styles.logo} />
        
        <form onSubmit={handleResetPassword} style={styles.form}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
            disabled={loading}
          />
          
          {error && <p style={styles.errorText}>{error}</p>}
          {message && <p style={styles.successText}>{message}</p>}
          
          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Processing...' : 'Reset Password'}
          </button>
        </form>
        
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
  resetBox: {
    background: 'rgba(255, 255, 255, 0.1)',
    padding: '40px',
    borderRadius: '15px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
    textAlign: 'center',
    maxWidth: '400px',
    width: '90%',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    zIndex: 1,
    color: 'white',
  },
  title: {
    margin: '0 0 10px 0',
    fontSize: '28px',
    fontWeight: 'bold',
  },
  subtitle: {
    margin: '0 0 30px 0',
    fontSize: '16px',
    color: '#ccc',
  },
  logo: {
    width: '150px',
    height: 'auto',
    marginBottom: '30px',
    display: 'block',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    marginBottom: '20px',
  },
  input: {
    padding: '12px 15px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    background: 'rgba(255, 255, 255, 0.05)',
    color: 'white',
    fontSize: '16px',
  },
  button: {
    padding: '12px 20px',
    borderRadius: '8px',
    border: 'none',
    background: '#3498DB',
    color: 'white',
    fontSize: '18px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background 0.3s ease, transform 0.2s ease',
  },
  linkContainer: {
    marginTop: '20px',
  },
  link: {
    color: '#3498DB',
    textDecoration: 'none',
    fontSize: '14px',
    transition: 'color 0.3s ease',
  },
  errorText: {
    color: '#ff4d4f',
    marginTop: '10px',
    fontSize: '14px',
  },
  successText: {
    color: '#52c41a',
    marginTop: '10px',
    fontSize: '14px',
  },
};
