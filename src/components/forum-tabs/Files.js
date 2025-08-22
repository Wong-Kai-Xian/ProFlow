import React, { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, query, orderBy, onSnapshot, doc } from "firebase/firestore"; // Removed addDoc, serverTimestamp, deleteDoc
import { COLORS, BUTTON_STYLES } from "../profile-component/constants";

const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString();
};

export default function Files({ forumId }) { // Removed updateForumLastActivity prop
  const [files, setFiles] = useState([]);
  // Removed uploading and uploadProgress states

  useEffect(() => {
    if (!forumId) return;

    const postsCollectionRef = collection(doc(db, "forums", forumId), "posts");
    const q = query(postsCollectionRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allFilesFromPosts = [];
      snapshot.docs.forEach(postDoc => {
        const postData = postDoc.data();
        if (postData.files && postData.files.length > 0) {
          postData.files.forEach(file => {
            if (!file.type.startsWith('image') && !file.type.startsWith('video')) {
              allFilesFromPosts.push({
                ...file,
                postId: postDoc.id, // Keep track of the parent post ID
                uploadedBy: postData.author, // Use post author
                timestamp: postData.timestamp // Use post timestamp
              });
            }
          });
        }
      });
      // Sort files by timestamp (most recent first)
      allFilesFromPosts.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
      setFiles(allFilesFromPosts);
    });

    return () => unsubscribe();
  }, [forumId]);

  // Removed handleFileUpload and handleDeleteFile functions

  return (
    <div>
      <h3 style={{ marginTop: 0, color: COLORS.dark }}>Shared Files</h3>
      
      {/* Removed file input and upload progress display */}

      <div>
        {files.length === 0 ? (
          <p style={{ textAlign: "center", color: COLORS.lightText }}>No files shared yet.</p>
        ) : (
          files.map((file, index) => (
            <div key={file.url || index} style={{
              backgroundColor: 'white',
              padding: '15px',
              borderRadius: '10px',
              border: '1px solid #ECF0F1',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ 
                  fontSize: '24px', 
                  marginRight: '15px',
                  width: '40px',
                  textAlign: 'center'
                }}>
                  📁
                </div>
                <div>
                  <strong style={{ color: COLORS.dark }}>{file.name}</strong>
                  <div style={{ fontSize: '12px', color: COLORS.lightText }}>
                    {(file.size / (1024 * 1024)).toFixed(2)} MB • Uploaded by {file.uploadedBy} • {formatTimestamp(file.timestamp)}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <a 
                  href={file.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{
                    ...BUTTON_STYLES.secondary,
                    padding: '8px 15px',
                    fontSize: '12px',
                    textDecoration: 'none'
                  }}
                >
                  View
                </a>
                <a 
                  href={file.url} 
                  download // This attribute enables direct download
                  style={{
                    ...BUTTON_STYLES.primary,
                    padding: '8px 15px',
                    fontSize: '12px',
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
