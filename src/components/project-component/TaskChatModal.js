import React, { useState, useEffect, useRef } from 'react';
import { COLORS, LAYOUT, BUTTON_STYLES, INPUT_STYLES } from '../profile-component/constants';
import { db } from "../../firebase"; // Import db
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc } from "firebase/firestore"; // Import Firestore functions
import { useAuth } from '../../contexts/AuthContext'; // Import useAuth

export default function TaskChatModal({ isOpen, onClose, taskId, projectId }) {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && taskId && projectId) {
      // Use a flat collection structure: taskMessages/{projectId}_{taskId}/messages
      const messagesRef = collection(db, "taskMessages", `${projectId}_${taskId}`, "messages");
      const q = query(messagesRef, orderBy("timestamp", "asc"));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messagesList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMessages(messagesList);
      }, (error) => {
        console.error("Error fetching chat messages: ", error);
      });

      return () => unsubscribe(); // Cleanup on unmount or when modal closes
    } else {
      setMessages([]); // Clear messages when modal is closed or no task/project ID
    }
  }, [isOpen, taskId, projectId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (newMessage.trim() && taskId && projectId && currentUser) {
      try {
        // Use the same flat collection structure
        const messagesRef = collection(db, "taskMessages", `${projectId}_${taskId}`, "messages");
        await addDoc(messagesRef, {
          text: newMessage.trim(),
          sender: currentUser.name || currentUser.email || "User",
          senderId: currentUser.uid,
          timestamp: serverTimestamp(),
          projectId: projectId,
          taskId: taskId
        });
        setNewMessage('');
      } catch (error) {
        console.error("Error sending message: ", error);
        alert("Failed to send message. Please try again.");
      }
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
            messages.map((msg, index) => {
              const isCurrentUser = msg.senderId === currentUser?.uid;
              return (
                <div key={index} style={{
                  alignSelf: isCurrentUser ? "flex-end" : "flex-start",
                  background: isCurrentUser ? COLORS.primary : COLORS.secondary,
                  color: "white",
                  padding: "10px 14px",
                  borderRadius: "18px",
                  maxWidth: "80%",
                  margin: "4px 0",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
                }}>
                  <div style={{ 
                    fontSize: "10px", 
                    opacity: 0.9, 
                    marginBottom: "4px",
                    fontWeight: "500"
                  }}>
                    {msg.sender} {msg.timestamp && typeof msg.timestamp === 'object' && msg.timestamp.toDate 
                      ? `• ${msg.timestamp.toDate().toLocaleTimeString()}` 
                      : ''
                    }
                  </div>
                  <div style={{ fontSize: "14px", lineHeight: "1.4" }}>
                    {msg.text}
                  </div>
                </div>
              );
            })
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
