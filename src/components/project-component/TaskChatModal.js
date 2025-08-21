import React, { useState, useEffect, useRef } from 'react';
import { COLORS, LAYOUT, BUTTON_STYLES, INPUT_STYLES } from '../profile-component/constants';

export default function TaskChatModal({ isOpen, onClose, taskId, initialMessages = [] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      // In a real application, you would save this message to a backend
      // For now, we'll just add it to the local state
      const newMsg = { id: messages.length + 1, text: newMessage.trim(), sender: "User", timestamp: new Date().toLocaleTimeString() };
      setMessages((prevMessages) => [...prevMessages, newMsg]);
      setNewMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000
    }}>
      <div style={{
        background: COLORS.background,
        padding: LAYOUT.gap,
        borderRadius: LAYOUT.borderRadius,
        boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
        width: "500px",
        height: "600px", // Increased height for chat view
        display: "flex",
        flexDirection: "column",
        gap: LAYOUT.smallGap,
      }}>
        <h3 style={{ margin: 0, color: COLORS.text }}>Task Chat (Task ID: {taskId})</h3>
        
        <div style={{
          flexGrow: 1,
          border: `1px solid ${COLORS.lightBorder}`,
          borderRadius: LAYOUT.borderRadius,
          padding: LAYOUT.smallGap,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          backgroundColor: COLORS.cardBackground,
        }}>
          {messages.length === 0 ? (
            <p style={{ color: COLORS.lightText, textAlign: "center", fontStyle: "italic" }}>No messages yet.</p>
          ) : (
            messages.map((msg, index) => (
              <div key={index} style={{
                alignSelf: msg.sender === "User" ? "flex-end" : "flex-start",
                background: msg.sender === "User" ? COLORS.primary : COLORS.secondary,
                color: "white",
                padding: "8px 12px",
                borderRadius: "18px",
                maxWidth: "80%",
              }}>
                <div style={{ fontSize: "10px", opacity: 0.8, marginBottom: "4px" }}>{msg.sender} at {msg.timestamp}</div>
                {msg.text}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={{ display: "flex", gap: LAYOUT.smallGap }}>
          <textarea
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            style={{
              ...INPUT_STYLES.base,
              flex: 1,
              minHeight: "40px",
              maxHeight: "100px",
              resize: "vertical",
            }}
          />
          <button onClick={handleSendMessage} style={{ ...BUTTON_STYLES.primary, padding: "10px 15px" }}>
            Send
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: LAYOUT.smallGap }}>
          <button onClick={onClose} style={{ ...BUTTON_STYLES.secondary }}>
            Close Chat
          </button>
        </div>
      </div>
    </div>
  );
}
