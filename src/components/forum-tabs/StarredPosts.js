import React, { useState, useEffect } from 'react';
import { COLORS } from '../profile-component/constants';
import { db } from "../../firebase";
import { collection, query, orderBy, onSnapshot, doc, where } from "firebase/firestore"; // Import where

const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffSeconds = Math.floor((now - date) / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Just now';
  if (diffHours < 1) return `${diffMinutes} minutes ago`;
  if (diffDays < 1) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
};

export default function StarredPosts({ onPostClick, forumId, currentUser }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [starredPosts, setStarredPosts] = useState([]);
  const currentUserId = currentUser?.id; // Use currentUser.id

  useEffect(() => {
    if (!forumId || !currentUserId) return;

    const postsCollectionRef = collection(doc(db, "forums", forumId), "posts");
    // Query for posts where the current user ID is in the starredBy array
    const q = query(postsCollectionRef, where('starredBy', 'array-contains', currentUserId), orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setStarredPosts(postsData);
    });

    return () => unsubscribe();
  }, [forumId, currentUserId, currentUser]); // Add currentUser to dependency array

  const handlePostClick = (post) => {
    if (onPostClick) {
      onPostClick(post);
    }
  };

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '10px',
      padding: '15px',
      marginBottom: '15px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      border: '1px solid #ECF0F1'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
        cursor: 'pointer'
      }} onClick={() => setIsExpanded(!isExpanded)}>
        <h3 style={{ 
          margin: 0, 
          color: COLORS.dark, 
          fontSize: '18px',
          fontWeight: '700'
        }}>
          ⭐ Starred Posts
        </h3>
        <span style={{ 
          color: COLORS.lightText, 
          fontSize: '14px',
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.3s ease'
        }}>
          ▼
        </span>
      </div>

      {isExpanded && (
        <div>
          {starredPosts.length === 0 ? (
            <p style={{ 
              fontSize: '15px', 
              color: COLORS.lightText, 
              textAlign: 'center',
              fontStyle: 'italic',
              margin: '10px 0'
            }}>
              No starred posts
            </p>
          ) : (
            starredPosts.map((post) => (
              <div 
                key={post.id} 
                onClick={() => handlePostClick(post)}
                style={{
                  padding: '8px',
                  borderRadius: '6px',
                  backgroundColor: '#F8F9FA',
                  marginBottom: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  border: '1px solid transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#E8F4FD';
                  e.currentTarget.style.borderColor = '#3498DB';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#F8F9FA';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px'
                }}>
                  {/* Removed ranking number */}
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontSize: '15px', 
                      fontWeight: '600', 
                      color: COLORS.dark,
                      marginBottom: '4px',
                      lineHeight: '1.3',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {post.content}
                    </div>
                    <div style={{ 
                      fontSize: '13px', 
                      color: COLORS.lightText,
                      marginBottom: '4px'
                    }}>
                      by {post.author} • {formatTimestamp(post.timestamp)}
                    </div>
                    <div style={{
                      display: 'flex',
                      gap: '12px',
                      fontSize: '13px',
                      color: COLORS.lightText
                    }}>
                      <span>👍 {post.likes || 0}</span>
                      <span>💬 {post.comments?.length || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
