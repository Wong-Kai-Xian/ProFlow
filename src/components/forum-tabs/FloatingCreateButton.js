import React from "react";

export default function FloatingCreateButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: "fixed",
        bottom: "30px",
        right: "30px",
        width: "60px",
        height: "60px",
        borderRadius: "50%",
        backgroundColor: "#3498DB",
        color: "white",
        border: "none",
        cursor: "pointer",
        boxShadow: "0 4px 20px rgba(52, 152, 219, 0.4)",
        fontSize: "24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        transition: "all 0.3s ease"
      }}
      onMouseEnter={(e) => {
        e.target.style.transform = "scale(1.1)";
        e.target.style.boxShadow = "0 6px 25px rgba(52, 152, 219, 0.6)";
      }}
      onMouseLeave={(e) => {
        e.target.style.transform = "scale(1)";
        e.target.style.boxShadow = "0 4px 20px rgba(52, 152, 219, 0.4)";
      }}
      title="Create New Post"
    >
      ✏️
    </button>
  );
}
