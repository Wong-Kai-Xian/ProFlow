// src/components/profile-component/Card.js
import React from "react";

export default function Card({ children, style }) {
  return (
    <div
      style={{
        padding: "16px",
        borderRadius: "12px",
        background: "#fff",
        border: "1px solid #ddd",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
