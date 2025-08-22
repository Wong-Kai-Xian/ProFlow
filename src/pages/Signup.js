import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection } from 'firebase/firestore';
import { app, db } from '../firebase';

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

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const auth = getAuth(app);
  const [searchParams] = useSearchParams();

  // Effect to read email from URL parameters on component mount
  React.useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Store additional user info in Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: name,
        email: email,
        role: "user", // Default role
        createdAt: new Date(),
      });

      console.log("User registered and data saved to Firestore:", user);
      navigate('/'); // Redirect to home or login page after successful registration
    } catch (err) {
      console.error("Registration error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container} className="animated-gradient-background">
      <style>{BACKGROUND_ANIMATION_STYLES}</style>
      <div style={styles.signupBox}>
        <h2 style={styles.title}>Join ProFlow</h2>
        <p style={styles.subtitle}>Create your account to get started</p>
        <img src="/proflow-logo.png" alt="ProFlow Logo" style={styles.logo} />
        <form onSubmit={handleRegister} style={styles.form}>
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={styles.input}
            required
            disabled={loading}
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
            disabled={loading}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required
            disabled={loading}
          />
          {error && <p style={styles.errorText}>{error}</p>}
          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
        <div style={styles.loginText}>
          Already have an account? <Link to="/login" style={styles.link}>Login</Link>
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
  signupBox: {
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
    background: '#3498DB',
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
  loginText: {
    marginTop: '20px',
    fontSize: '14px',
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
};

const errorText = {
  color: '#ff4d4f',
  marginTop: '10px',
  fontSize: '14px',
};

Object.assign(styles, { errorText });
