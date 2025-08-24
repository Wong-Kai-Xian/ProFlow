import React, { useState, useEffect, useRef } from 'react';
import { COLORS, LAYOUT, BUTTON_STYLES, INPUT_STYLES } from '../profile-component/constants';
import { db } from "../../firebase"; // Import db
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, where, getDocs } from "firebase/firestore"; // Import Firestore functions
import { useAuth } from '../../contexts/AuthContext'; // Import useAuth

export default function TaskChatModal({ isOpen, onClose, taskId, projectId }) {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  // Mention helpers
  const extractMentionEmails = (text = '') => {
    const emails = new Set();
    const regex = /@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
    let m;
    while ((m = regex.exec(text)) !== null) {
      emails.add(m[1].toLowerCase());
    }
    return Array.from(emails);
  };

  const notifyMentions = async (text) => {
    try {
      const emails = extractMentionEmails(text);
      if (emails.length === 0) return;
      for (const email of emails) {
        try {
          const uq = query(collection(db, 'users'), where('email', '==', email));
          const snap = await getDocs(uq);
          for (const udoc of snap.docs) {
            const uid = udoc.id;
            if (!uid || uid === (currentUser?.uid || '')) continue;
            const snippet = (text || '').slice(0, 140);
            await addDoc(collection(db, 'users', uid, 'notifications'), {
              unread: true,
              createdAt: serverTimestamp(),
              origin: 'task',
              title: 'You were mentioned in a task chat',
              message: `${currentUser?.displayName || currentUser?.name || currentUser?.email || 'Someone'}: ${snippet}`,
              refType: 'mention',
              projectId,
              taskId
            });
          }
        } catch {}
      }
    } catch {}
  };

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
        await notifyMentions(newMessage.trim());
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
