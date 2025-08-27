import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Card from "./profile-component/Card";
import { COLORS, LAYOUT } from "./profile-component/constants";

import { db } from "../firebase";
import { collection, onSnapshot, query, orderBy, where } from "firebase/firestore";
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

export default function HomeGroupForum() {

  const [forums, setForums] = useState([]);
  const postsUnsubsRef = useRef([]);
  const [unreadMap, setUnreadMap] = useState({}); // forumId -> unread count for current user
  const navigate = useNavigate();
  const { currentUser } = useAuth(); // Get currentUser from AuthContext

  useEffect(() => {
    if (!currentUser) {
      setForums([]);
      setUnreadMap({});
      return;
    }

    // Query for forums where the current user is a member
    const q = query(collection(db, "forums"), where("members", "array-contains", currentUser.uid), orderBy('lastActivity', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const forumsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setForums(forumsData);

      // Reset existing post listeners
      postsUnsubsRef.current.forEach(unsub => { try { unsub(); } catch {} });
      postsUnsubsRef.current = [];

      // Attach live post count listeners per forum
      forumsData.forEach(f => {
        const postsRef = collection(db, 'forums', f.id, 'posts');
        const unsubPosts = onSnapshot(postsRef, (snap) => {
          const count = snap.size;
          setForums(prev => prev.map(x => x.id === f.id ? { ...x, actualPostCount: count } : x));
        });
        postsUnsubsRef.current.push(unsubPosts);
      });
    });

    // Also listen to this user's notifications to compute unread per forum
    const notifRef = collection(db, 'users', currentUser.uid, 'notifications');
    const unsubNotifs = onSnapshot(notifRef, (snap) => {
      const counts = {};
      snap.docs.forEach(d => {
        const n = d.data();
        if (n && n.unread && n.origin === 'forum' && n.forumId) {
          counts[n.forumId] = (counts[n.forumId] || 0) + 1;
        }
      });
      setUnreadMap(counts);
    });

    return () => {
      try { unsubscribe(); } catch {}
      postsUnsubsRef.current.forEach(unsub => { try { unsub(); } catch {} });
      postsUnsubsRef.current = [];
      try { unsubNotifs(); } catch {}
    };
  }, [currentUser]); // Add currentUser to dependency array

  const getActivityDate = (forum) => {
    const postCount = typeof forum.actualPostCount === 'number' ? forum.actualPostCount : (forum.posts || 0);
    
    if (postCount > 0) {
      // Show last activity if there are posts
      if (forum.lastActivity && typeof forum.lastActivity.toDate === 'function') {
        return forum.lastActivity.toDate().toLocaleString();
      }
    }
    
    // Show creation date if no posts or no lastActivity
    if (forum.createdAt && typeof forum.createdAt.toDate === 'function') {
      return forum.createdAt.toDate().toLocaleString();
    } else if (forum.timestamp && typeof forum.timestamp.toDate === 'function') {
      return forum.timestamp.toDate().toLocaleString();
    }
    
    return 'N/A';
  };

  const sortForums = () => {
    if (!Array.isArray(forums)) return [];
    let sorted = [...forums];
    // Sort by recent activity by default
    sorted.sort((a, b) => {
      const dateA = a.lastActivity && typeof a.lastActivity.toDate === 'function' ? a.lastActivity.toDate() : new Date(0);
      const dateB = b.lastActivity && typeof b.lastActivity.toDate === 'function' ? b.lastActivity.toDate() : new Date(0);
      return dateB - dateA;
    });
    return sorted;
  };

  return (
    <Card style={{
      height: "100%",
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: LAYOUT.smallGap }}>
        <h3 style={{ margin: 0, color: COLORS.dark, fontSize: "18px", fontWeight: "700", whiteSpace: "nowrap" }}>General Forum</h3>
      </div>

      {/* Forum List */}
      <ul style={{ listStyle: 'none', padding: 0, maxHeight: "250px", overflowY: "auto", flexGrow: 1 }} className="thin-scrollbar">
        {sortForums().map((forum) => (
          <li key={forum.id} style={{
            position: "relative",
            background: COLORS.cardBackground,
            margin: LAYOUT.smallGap + " 0",
            padding: `${LAYOUT.gap} 15px`,
            borderRadius: LAYOUT.borderRadius,
            borderLeft: `4px solid ${COLORS.primary}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
            transition: "all 0.2s ease",
            cursor: "pointer"
          }}
          onClick={() => navigate(`/forum/${forum.id}`)}
          onMouseEnter={(e) => {
            e.target.style.transform = "translateY(-1px)";
            e.target.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.1)";
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = "translateY(0)";
            e.target.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.05)";
          }}>
            <div>
              <strong style={{ color: COLORS.dark, fontSize: "14px", fontWeight: "600" }}>{forum.name}</strong>
              <br />
              <small style={{ color: COLORS.lightText, fontSize: "12px" }}>
                {(typeof forum.actualPostCount === 'number' ? forum.actualPostCount : (forum.posts || 0))} posts
                <br />
                {(typeof forum.actualPostCount === 'number' ? forum.actualPostCount : (forum.posts || 0)) > 0 ? 'Last activity: ' : 'Created: '}{getActivityDate(forum)}
              </small>
            </div>
            {(unreadMap[forum.id] || 0) > 0 && (
              <div style={{
                position: "absolute",
                top: "8px",
                right: "8px",
                background: COLORS.danger,
                color: "white",
                borderRadius: "50%",
                width: "20px",
                height: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: "bold",
                zIndex: 1
              }}>
                {unreadMap[forum.id]}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
