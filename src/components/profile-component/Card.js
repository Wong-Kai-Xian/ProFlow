// src/components/profile-component/Card.js
import React from "react";
import { CARD_STYLES } from "./constants"; // Import CARD_STYLES

export default function Card({ children, style }) {
  return (
    <div
      style={{
        ...CARD_STYLES.base,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
