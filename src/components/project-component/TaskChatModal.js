import React, { useState, useEffect, useRef } from 'react';
import { COLORS, LAYOUT, BUTTON_STYLES, INPUT_STYLES } from '../profile-component/constants';
import { db, storage } from "../../firebase"; // Import db and storage
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, where, getDocs, getDoc } from "firebase/firestore"; // Import Firestore functions
import { useAuth } from '../../contexts/AuthContext'; // Import useAuth

export default function TaskChatModal({ isOpen, onClose, taskId, projectId }) {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const [mentionCandidates, setMentionCandidates] = useState([]); // project members only
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
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

  // Load project team members for mention suggestions (support emails or uids in team)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!projectId) { setMentionCandidates([]); return; }
        const pref = doc(db, 'projects', projectId);
        const psnap = await getDoc(pref);
        const team = psnap.exists() ? (psnap.data().team || []) : [];
        if (!team.length) { setMentionCandidates([]); return; }
        const emailList = team.filter(x => typeof x === 'string' && x.includes('@'));
        const uidList = team.filter(x => typeof x === 'string' && !x.includes('@'));
        const chunkSize = 10;
        const results = [];
        // Query by emails
        for (let i = 0; i < emailList.length; i += chunkSize) {
          const slice = emailList.slice(i, i + chunkSize);
          try {
            const q = query(collection(db, 'users'), where('email', 'in', slice));
            const snap = await getDocs(q);
            snap.forEach(u => { const d = u.data(); if (d.uid !== currentUser?.uid) results.push({ uid: d.uid || u.id, name: d.name || d.displayName || d.email || 'Member', email: d.email || '' }); });
          } catch {}
        }
        // Query by uid field
        for (let i = 0; i < uidList.length; i += chunkSize) {
          const slice = uidList.slice(i, i + chunkSize);
          try {
            const q = query(collection(db, 'users'), where('uid', 'in', slice));
            const snap = await getDocs(q);
            snap.forEach(u => { const d = u.data(); if (d.uid !== currentUser?.uid) results.push({ uid: d.uid || u.id, name: d.name || d.displayName || d.email || 'Member', email: d.email || '' }); });
          } catch {}
        }
        if (active) setMentionCandidates(results);
      } catch {
        if (active) setMentionCandidates([]);
      }
    })();
    return () => { active = false; };
  }, [projectId, currentUser?.uid]);

  const updateMentionState = (value) => {
    setNewMessage(value);
    const m = value.match(/(^|\s)@([A-Za-z0-9._%+-]*)$/);
    if (m) {
      const q = (m[2] || '').toLowerCase();
      const list = mentionCandidates.filter(u => (u.name || '').toLowerCase().startsWith(q) || (u.email || '').toLowerCase().startsWith(q)).slice(0, 6);
      setMentionQuery(q);
      setMentionIndex(0);
      setMentionOpen(list.length > 0);
    } else {
      setMentionOpen(false);
      setMentionQuery('');
    }
  };

  const insertMention = (user) => {
    const replaced = newMessage.replace(/(^|\s)@([A-Za-z0-9._%+-]*)$/, (m0, s1) => `${s1}@${user.email} `);
    setNewMessage(replaced);
    setMentionOpen(false);
    setMentionQuery('');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if ((newMessage.trim() || selectedFile) && taskId && projectId && currentUser) {
      try {
        // Use the same flat collection structure
        const messagesRef = collection(db, "taskMessages", `${projectId}_${taskId}`, "messages");
        let fileUrl = '';
        let fileName = '';
        if (selectedFile) {
          const fref = ref(storage, `taskMessages/${projectId}_${taskId}/${Date.now()}_${selectedFile.name}`);
          await uploadBytes(fref, selectedFile);
          fileUrl = await getDownloadURL(fref);
          fileName = selectedFile.name;
        }
        await addDoc(messagesRef, {
          text: newMessage.trim(),
          sender: currentUser.name || currentUser.email || "User",
          senderId: currentUser.uid,
          timestamp: serverTimestamp(),
          projectId: projectId,
          taskId: taskId,
          fileUrl,
          fileName
        });
        await notifyMentions(newMessage.trim());
        setNewMessage('');
        setSelectedFile(null);
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
                  {msg.fileUrl && (
                    <div style={{ marginTop: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '6px 8px' }}>
                      <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', textDecoration: 'underline' }}>{msg.fileName || 'Attachment'}</a>
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={{ display: "flex", gap: LAYOUT.smallGap, position: 'relative', alignItems: 'flex-end' }}>
          <textarea
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => updateMentionState(e.target.value)}
            onKeyPress={handleKeyPress}
            style={{
              ...INPUT_STYLES.base,
              flex: 1,
              minHeight: "40px",
              maxHeight: "100px",
              resize: "vertical",
            }}
          />
          {/* Selected file preview below input */}
          {selectedFile && (
            <div style={{ position: 'absolute', left: 20, bottom: 50, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', border: `1px solid ${COLORS.lightBorder}`, background: '#f3f4f6', color: COLORS.text, borderRadius: 999, padding: '4px 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }} title={selectedFile.name}>
              <span>{selectedFile.name}</span>
              <button onClick={() => setSelectedFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.lightText, fontSize: 14, lineHeight: 1 }}>×</button>
            </div>
          )}
          {mentionOpen && (
            <div style={{ position: 'absolute', bottom: 62, left: 20, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 8px 20px rgba(0,0,0,0.18)', padding: 6, zIndex: 2000, minWidth: 280 }}>
              {mentionCandidates
                .filter(u => (u.name || '').toLowerCase().startsWith(mentionQuery) || (u.email || '').toLowerCase().startsWith(mentionQuery))
                .slice(0,6)
                .map((u, i) => (
                  <div key={u.uid || u.email} onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}
                    style={{ padding: '6px 8px', borderRadius: 6, cursor: 'pointer', background: i === mentionIndex ? '#f1f5f9' : 'transparent', display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 13, color: '#111827', fontWeight: 600 }}>{u.name}</span>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{u.email}</span>
                  </div>
                ))}
            </div>
          )}
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={(e) => setSelectedFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
          <button onClick={() => fileInputRef.current && fileInputRef.current.click()} style={{ ...BUTTON_STYLES.secondary, padding: '10px 12px' }}>Attach</button>
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
