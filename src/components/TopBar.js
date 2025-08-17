import React from "react";
import { Link } from "react-router-dom";

export default function TopBar() {
  return (
    <nav style={{ display: 'flex', padding: '10px', background: '#2C3E50', color: 'white' }}>
      <Link to="/" style={{ margin: '0 10px', color: 'white', textDecoration: 'none' }}>Home</Link>
      <Link to="/project" style={{ margin: '0 10px', color: 'white', textDecoration: 'none' }}>Project</Link>
      <Link to="/forum" style={{ margin: '0 10px', color: 'white', textDecoration: 'none' }}>Forum</Link>
      <Link to="/quote" style={{ margin: '0 10px', color: 'white', textDecoration: 'none' }}>Quote</Link>
    </nav>
  );
}