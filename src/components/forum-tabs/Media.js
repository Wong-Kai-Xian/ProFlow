import React, { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, query, orderBy, onSnapshot, doc } from "firebase/firestore"; // Removed addDoc, serverTimestamp, deleteDoc
import { COLORS, BUTTON_STYLES } from "../profile-component/constants";

const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString();
};

export default function Media({ forumId }) { // Removed updateForumLastActivity prop
  const [mediaItems, setMediaItems] = useState([]);
  // Removed uploading and uploadProgress states

  useEffect(() => {
    if (!forumId) return;

    const postsCollectionRef = collection(doc(db, "forums", forumId), "posts");
    const q = query(postsCollectionRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allMediaFromPosts = [];
      snapshot.docs.forEach(postDoc => {
        const postData = postDoc.data();
        if (postData.files && postData.files.length > 0) {
          postData.files.forEach(file => {
            if (file.type.startsWith('image') || file.type.startsWith('video')) {
              allMediaFromPosts.push({
                ...file,
                postId: postDoc.id, // Keep track of the parent post ID
                uploadedBy: postData.author, // Use post author
                timestamp: postData.timestamp // Use post timestamp
              });
            }
          });
        }
      });
      // Sort media items by timestamp (most recent first)
      allMediaFromPosts.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
      setMediaItems(allMediaFromPosts);
    });

    return () => unsubscribe();
  }, [forumId]);

  // Removed handleMediaUpload and handleDeleteMedia functions

  return (
    <div>
      <h3 style={{ marginTop: 0, color: COLORS.dark }}>Media Gallery</h3>
      
      {/* Removed file input and upload progress display */}

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
        gap: '15px' 
      }}>
        {mediaItems.length === 0 ? (
          <p style={{ textAlign: "center", color: COLORS.lightText, gridColumn: "1 / -1" }}>No media shared yet.</p>
        ) : (
          mediaItems.map((item, index) => (
          <div key={item.url || index} style={{
            backgroundColor: 'white',
            padding: '15px',
            borderRadius: '10px',
            border: '1px solid #ECF0F1',
            textAlign: 'center'
          }}>
            <div style={{
              height: '120px',
              backgroundColor: COLORS.light,
              borderRadius: '5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '10px',
              overflow: 'hidden'
            }}>
                {item.type.startsWith('image') ? (
                  <img src={item.url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : item.type.startsWith('video') ? (
                  <video src={item.url} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  'Unsupported Media'
                )}
              </div>
              <strong style={{ color: COLORS.dark, fontSize: '14px' }}>{item.name}</strong>
              <div style={{ fontSize: '12px', color: COLORS.lightText, marginTop: '5px' }}>
                By {item.uploadedBy} • {formatTimestamp(item.timestamp)}
            </div>
            <div style={{ marginTop: '10px' }}>
              <a 
                href={item.url} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  ...BUTTON_STYLES.secondary,
                  padding: '6px 10px',
                  fontSize: '11px',
                  textDecoration: 'none',
                  marginRight: '5px'
                }}
              >
                View
              </a>
              <a 
                href={item.url} 
                download // This attribute enables direct download
                style={{
                  ...BUTTON_STYLES.primary,
                  padding: '6px 10px',
                  fontSize: '11px',
                  textDecoration: 'none'
                }}
              >
                Download
              </a>
            </div>
          </div>
          ))
        )}
      </div>
    </div>
  );
}
