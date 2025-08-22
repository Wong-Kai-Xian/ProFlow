import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'; // Import Firebase Auth functions
import { app } from '../firebase'; // Assuming you have initialized Firebase app in firebase.js
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth"; // Import Google Auth Provider and signInWithPopup
import { db } from "../firebase"; // Import Firestore instance
import { doc, setDoc, getDoc } from "firebase/firestore"; // Import Firestore functions

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

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null); // State for error messages
  const [loading, setLoading] = useState(false); // State for loading indicator
  const navigate = useNavigate();
  const auth = getAuth(app); // Get Firebase Auth instance

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null); // Clear previous errors
    setLoading(true); // Set loading to true
    console.log('Login attempt:', { email, password });

    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log("User logged in successfully!");
      navigate('/'); // Redirect to home page on successful login
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message); // Set error message
    } finally {
      setLoading(false); // Set loading to false
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if user exists in Firestore, if not, create a new entry
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        await setDoc(userDocRef, {
          uid: user.uid,
          name: user.displayName,
          email: user.email,
          role: "user", // Default role for new Google sign-ins
          createdAt: new Date(),
        });
        console.log("New Google user data saved to Firestore:", user);
      } else {
        console.log("Google user already exists in Firestore.");
      }

      console.log("Google user logged in successfully!");
      navigate('/');
    } catch (err) {
      console.error("Google Sign-In error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container} className="animated-gradient-background">
      <style>{BACKGROUND_ANIMATION_STYLES}</style>
      <div style={styles.loginBox}>
        <h2 style={styles.title}>Welcome Back!</h2>
        <p style={styles.subtitle}>Sign in to continue to ProFlow</p>
        <img src="/proflow-logo.png" alt="ProFlow Logo" style={styles.logo} />
        <form onSubmit={handleLogin} style={styles.form}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
            disabled={loading} // Disable input while loading
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required
            disabled={loading} // Disable input while loading
          />
          {error && <p style={styles.errorText}>{error}</p>} {/* Display error message */}
          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <button 
          onClick={handleGoogleSignIn} 
          style={{ ...styles.button, backgroundColor: '#DB4437', marginTop: '0px', width: '100%' }} // Google red color, full width
          disabled={loading}
        >
          Sign in with Google
        </button>
        <Link to="/forgot-password" style={{...styles.link, marginTop: '30px', display: 'block'}}>Forgot Password?</Link>
        <div style={styles.signupText}>
          Don't have an account? <Link to="/signup" style={styles.link}>Sign Up</Link>
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
    background: 'linear-gradient(135deg, #2c3e50 0%, #0a1419 100%)', // Dark gradient background
    fontFamily: 'Arial, sans-serif',
    overflow: 'hidden', // Hide scrollbars that might appear due to animations
    position: 'relative', // Needed for pseudo-elements
  },
  loginBox: {
    background: 'rgba(255, 255, 255, 0.1)', // Semi-transparent white
    padding: '40px',
    borderRadius: '15px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
    textAlign: 'center',
    maxWidth: '400px',
    width: '90%',
    backdropFilter: 'blur(10px)', // Frosted glass effect
    border: '1px solid rgba(255, 255, 255, 0.2)',
    zIndex: 1, // Ensure it's above the animation layer
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
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    marginBottom: '10px',
  },
  input: {
    padding: '12px 15px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    background: 'rgba(255, 255, 255, 0.05)',
    color: 'white',
    fontSize: '16px',
    '::placeholder': {
      color: '#aaa',
    },
    ':focus': {
      outline: 'none',
      borderColor: '#3498DB',
      boxShadow: '0 0 0 3px rgba(52, 152, 219, 0.5)',
    },
  },
  button: {
    padding: '12px 20px',
    borderRadius: '8px',
    border: 'none',
    background: '#3498DB', // Blue button
    color: 'white',
    fontSize: '18px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background 0.3s ease, transform 0.2s ease',
    ':hover': {
      background: '#2980B9',
      transform: 'translateY(-2px)',
    },
    ':active': {
      transform: 'translateY(0)',
    },
  },
  link: {
    color: '#3498DB',
    textDecoration: 'none',
    fontSize: '14px',
    transition: 'color 0.3s ease',
    ':hover': {
      color: '#5DADE2',
      textDecoration: 'underline',
    },
  },
  signupText: {
    marginTop: '20px',
    fontSize: '14px',
    color: '#ccc',
  },
  logo: {
    width: '150px', // Adjust as needed
    height: 'auto',
    marginBottom: '30px',
    display: 'block', // Ensure it's a block element
    marginLeft: 'auto',
    marginRight: 'auto',
  },
};

const errorText = {
  color: '#ff4d4f', // A distinct error color
  marginTop: '10px',
  fontSize: '14px',
};

Object.assign(styles, { errorText });
