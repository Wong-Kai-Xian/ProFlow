import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // Corrected path

export default function PrivateRoute({ children }) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>Loading authentication...</div>; // Or a loading spinner
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />; // Redirect to login page
  }

  return children;
}
