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
  aiBackground: "#e8f0fe"
};

export const BUTTON_STYLES = {
  primary: {
    background: COLORS.primary,
    color: "white",
    border: "none",
    padding: "6px 12px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500"
  },
  secondary: {
    background: COLORS.light,
    color: COLORS.dark,
    border: `1px solid ${COLORS.border}`,
    padding: "6px 12px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px"
  }
};

export const INPUT_STYLES = {
  base: {
    padding: "8px 12px",
    borderRadius: "6px",
    border: `1px solid ${COLORS.border}`,
    fontSize: "14px",
    outline: "none",
    fontFamily: "Arial, sans-serif"
  },
  textarea: {
    padding: "8px 12px",
    borderRadius: "6px",
    border: `1px solid ${COLORS.border}`,
    fontSize: "14px",
    outline: "none",
    fontFamily: "Arial, sans-serif",
    resize: "vertical",
    minHeight: "60px"
  }
};

export const CARD_STYLES = {
  base: {
    padding: "16px",
    borderRadius: "12px",
    background: COLORS.cardBackground,
    border: `1px solid ${COLORS.border}`,
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
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

export const STAGES = ["Working", "Qualified", "Converted"];

export const ACTIVITY_TYPES = ["Call", "Gmail", "Meeting", "Note"];
