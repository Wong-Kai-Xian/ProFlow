// Shared constants and styles for profile components

export const COLORS = {
  primary: "#3498DB",
  secondary: "#2C3E50",
  success: "#27AE60",
  warning: "#F39C12",
  danger: "#E74C3C",
  light: "#ECF0F1",
  dark: "#2C3E50",
  background: "#f4f6f8",
  cardBackground: "#fff",
  border: "#ddd",
  lightBorder: "#eee",
  text: "#2C3E50",
  lightText: "#7F8C8D",
  aiBackground: "#e8f0fe",
  darkCardBackground: "#34495e",
  white: "#ffffff",
  gray: "#95a5a6",
  tertiary: "#6C757D" // A new color for the "My Invitations" button
};

export const BUTTON_STYLES = {
  primary: {
    background: "linear-gradient(90deg, #60A5FA 0%, #2563EB 100%)",
    color: "white",
    border: "1px solid rgba(37, 99, 235, 0.6)",
    padding: "8px 16px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    transition: "all 0.2s ease",
    boxShadow: "0 6px 14px rgba(37, 99, 235, 0.35), inset 0 0 0 1px rgba(255,255,255,0.15)"
  },
  secondary: {
    background: COLORS.light,
    color: COLORS.dark,
    border: `1px solid ${COLORS.border}`,
    padding: "8px 16px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    transition: "all 0.2s ease",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
  },
  primarySmall: {
    background: COLORS.primary,
    color: "white",
    border: "none",
    padding: "6px 12px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "500",
    transition: "all 0.2s ease",
    boxShadow: "0 1px 3px rgba(52, 152, 219, 0.2)"
  },
  secondarySmall: {
    background: COLORS.light,
    color: COLORS.dark,
    border: `1px solid ${COLORS.border}`,
    padding: "6px 12px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    transition: "all 0.2s ease",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)"
  },
  tertiary: {
    background: "transparent",
    color: COLORS.lightText,
    border: `1px solid ${COLORS.lightBorder}`,
    padding: "8px 16px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    transition: "all 0.2s ease"
  },
  success: {
    background: COLORS.success,
    color: "white",
    border: "none",
    padding: "8px 16px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    transition: "all 0.2s ease",
    boxShadow: "0 2px 4px rgba(39, 174, 96, 0.2)"
  }
};

export const INPUT_STYLES = {
  base: {
    padding: "12px 15px", // Increased padding
    borderRadius: "8px", // Slightly larger border radius
    border: `1px solid ${COLORS.border}`,
    fontSize: "15px", // Slightly larger font size
    outline: "none",
    fontFamily: "Arial, sans-serif",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease", // Add transition for hover/focus
    "&:focus": {
      borderColor: COLORS.primary,
      boxShadow: `0 0 0 3px ${COLORS.primary}30`, // Light shadow on focus
    },
  },
  textarea: {
    padding: "12px 15px", // Increased padding
    borderRadius: "8px", // Slightly larger border radius
    border: `1px solid ${COLORS.border}`,
    fontSize: "15px", // Slightly larger font size
    outline: "none",
    fontFamily: "Arial, sans-serif",
    resize: "vertical",
    minHeight: "80px", // Increased min-height
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    "&:focus": {
      borderColor: COLORS.primary,
      boxShadow: `0 0 0 3px ${COLORS.primary}30`,
    },
  },
  select: {
    padding: "12px 15px",
    borderRadius: "8px",
    border: `1px solid ${COLORS.border}`,
    fontSize: "15px",
    outline: "none",
    fontFamily: "Arial, sans-serif",
    backgroundColor: COLORS.white,
    cursor: "pointer",
    appearance: "none", // Remove default select arrow
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%237F8C8D'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
    backgroundSize: "16px",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    "&:focus": {
      borderColor: COLORS.primary,
      boxShadow: `0 0 0 3px ${COLORS.primary}30`,
    },
  }
};

export const CARD_STYLES = {
  base: {
    padding: "16px",
    borderRadius: "12px",
    background: COLORS.cardBackground,
    border: `1px solid ${COLORS.border}`,
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  },
  ai: {
    background: COLORS.aiBackground
  }
};

export const LAYOUT = {
  gap: "20px",
  smallGap: "8px",
  borderRadius: "12px",
  smallBorderRadius: "6px"
};

export const STAGES = ["Proposal", "Negotiation", "Complete"];

export const ACTIVITY_TYPES = ["Call", "Gmail", "Meeting", "Note"];
