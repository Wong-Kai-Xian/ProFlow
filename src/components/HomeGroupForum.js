import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Card from "./profile-component/Card";
import { COLORS, LAYOUT } from "./profile-component/constants";
import Switch from "./Switch";
import { db } from "../firebase";
import { collection, onSnapshot, query, orderBy, where } from "firebase/firestore";
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

export default function HomeGroupForum() {
  const [sortBy, setSortBy] = useState("recent");
  const [forums, setForums] = useState([]);
  const postsUnsubsRef = useRef([]);
  const navigate = useNavigate();
  const { currentUser } = useAuth(); // Get currentUser from AuthContext

  useEffect(() => {
    if (!currentUser) {
      setForums([]);
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

    return () => {
      try { unsubscribe(); } catch {}
      postsUnsubsRef.current.forEach(unsub => { try { unsub(); } catch {} });
      postsUnsubsRef.current = [];
    };
  }, [currentUser]); // Add currentUser to dependency array

  const sortForums = () => {
    if (!Array.isArray(forums)) return [];
    let sorted = [...forums];
    if (sortBy === "recent") {
      sorted.sort((a, b) => {
        const dateA = a.lastActivity && typeof a.lastActivity.toDate === 'function' ? a.lastActivity.toDate() : new Date(0);
        const dateB = b.lastActivity && typeof b.lastActivity.toDate === 'function' ? b.lastActivity.toDate() : new Date(0);
        return dateB - dateA;
      });
    } else if (sortBy === "notifications") {
      sorted.sort((a, b) => b.notifications - a.notifications);
    }
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
      {/* Header with top-right button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: LAYOUT.smallGap }}>
        <h3 style={{ margin: 0, color: COLORS.dark, fontSize: "18px", fontWeight: "700", whiteSpace: "nowrap" }}>General Forum</h3>
        <div style={{ display: "flex", gap: LAYOUT.smallGap, alignItems: "center" }}>
          <Switch
            isOn={sortBy === "notifications"}
            handleToggle={() => setSortBy(sortBy === "recent" ? "notifications" : "recent")}
            onColor={COLORS.primary}
            offColor={COLORS.lightText}
            labelText=""
            title={`Sort by: ${sortBy === "recent" ? "Notifications" : "Recent"}`}
          />
        </div>
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
                Last activity: {forum.lastActivity && typeof forum.lastActivity.toDate === 'function' ? forum.lastActivity.toDate().toLocaleString() : 'N/A'}
              </small>
            </div>
            {forum.notifications > 0 && (
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
                {forum.notifications}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
