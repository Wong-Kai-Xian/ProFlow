import React, { useState, useEffect } from "react";
import { COLORS, LAYOUT, INPUT_STYLES, BUTTON_STYLES } from "../profile-component/constants";
import { db } from "../../firebase"; // Import db
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, arrayUnion, arrayRemove, getDoc, deleteDoc, where, getDocs } from "firebase/firestore"; // Import Firestore functions
import { storage } from "../../firebase";
import { ref, deleteObject } from "firebase/storage";
import CreatePostModal from "./CreatePostModal"; // Import CreatePostModal
import ConfirmationModal from "./ConfirmationModal"; // Import ConfirmationModal
import UserAvatar from "../shared/UserAvatar";

// Helper to format timestamp
const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'N/A';
  // Firestore Timestamp object might need to be converted to a Date object first
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString();
};

// Mention helpers
const extractMentionEmails = (text = "") => {
  const emails = new Set();
  const regex = /@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    emails.add(m[1].toLowerCase());
  }
  return Array.from(emails);
};

const notifyMentions = async ({ text, forumId, postId, db, currentUser }) => {
  try {
    const emails = extractMentionEmails(text);
    if (emails.length === 0) return;
    for (const email of emails) {
      try {
        const uq = query(collection(db, 'users'), where('email', '==', email));
        const snap = await getDocs(uq);
        for (const udoc of snap.docs) {
          const uid = udoc.id;
          if (uid === (currentUser?.uid || '')) continue;
          const snippet = (text || '').slice(0, 140);
          await addDoc(collection(db, 'users', uid, 'notifications'), {
            unread: true,
            createdAt: serverTimestamp(),
            origin: 'forum',
            title: 'You were mentioned',
            message: `${currentUser?.displayName || currentUser?.email || 'Someone'}: ${snippet}`,
            refType: 'mention',
            forumId,
            postId
          });
        }
      } catch {}
    }
  } catch {}
};

// PostItem Sub-component (if you want to keep it separate or move it here)
const PostItem = ({ post, onLike, onEdit, onDelete, currentUser }) => {
  const currentUserId = currentUser?.uid; // Use currentUser.uid (Firebase Auth)
  const hasLiked = post.likedBy?.includes(currentUserId);
  const [showOptions, setShowOptions] = useState(false); // State for three-dot menu
  const [showComments, setShowComments] = useState(false); // State for comments section
  const [numVisibleComments, setNumVisibleComments] = useState(2); // Number of comments initially visible
  const [newCommentText, setNewCommentText] = useState(''); // State for new comment input
  const [editingCommentId, setEditingCommentId] = useState(null); // State for ID of comment being edited
  const [editedCommentText, setEditedCommentText] = useState(''); // State for text of comment being edited
  const [showCommentDeleteConfirmModal, setShowCommentDeleteConfirmModal] = useState(false); // State for comment delete confirmation modal
  const [commentToDelete, setCommentToDelete] = useState(null); // State to hold the comment to be deleted
  const hasStarred = post.starredBy?.includes(currentUserId); // New state to check if current user has starred
  const [authorName, setAuthorName] = useState(post.author || 'Anonymous');
  const [authorPhotoURL, setAuthorPhotoURL] = useState(post.authorPhotoURL || undefined);
  const [commentAuthorMap, setCommentAuthorMap] = useState({}); // authorId -> displayName

  // Fetch live author display for post and comments
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (post.authorId) {
          const u = await getDoc(doc(db, 'users', post.authorId));
          if (!cancelled && u.exists()) {
            const d = u.data();
            setAuthorName(d.name || d.displayName || d.email || post.author || 'Anonymous');
            setAuthorPhotoURL(d.photoURL || post.authorPhotoURL);
          }
        }
      } catch {}
      try {
        const ids = Array.from(new Set((post.comments || []).map(c => c.authorId).filter(Boolean)));
        if (ids.length === 0) { if (!cancelled) setCommentAuthorMap({}); return; }
        const map = {};
        const chunk = 10;
        for (let i = 0; i < ids.length; i += chunk) {
          const slice = ids.slice(i, i + chunk);
          try {
            const q = query(collection(db, 'users'), where('uid', 'in', slice));
            const snap = await getDocs(q);
            snap.forEach(docu => { const d = docu.data(); map[d.uid || docu.id] = d.name || d.displayName || d.email || 'Member'; });
          } catch {}
        }
        if (!cancelled) setCommentAuthorMap(map);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [post.authorId, (post.comments || []).length]);

  const renderFilePreview = (file) => {
    const mediaStyle = {
      maxWidth: '100%',
      maxHeight: '400px', // A standard height for media in a feed
      width: 'auto',
      height: 'auto',
      borderRadius: '8px',
      objectFit: 'contain', // Ensures the entire image/video is visible without cropping
      display: 'block', // Remove extra space below image
      margin: '0 auto' // Center the media if it's smaller than maxWidth
    };

    if (file.type.startsWith('image')) {
      return <img src={file.url} alt={file.name} style={mediaStyle} />;
    } else if (file.type.startsWith('video')) {
      return <video src={file.url} controls style={mediaStyle} />;
    } else {
      // Generic file display for other types
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: COLORS.light,
          padding: '10px',
          borderRadius: '8px',
          marginTop: LAYOUT.tinyGap
        }}>
          <span style={{ fontSize: '24px', marginRight: '10px' }}>📄</span>
          <a href={file.url} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.primary, textDecoration: 'none', fontWeight: '600' }}>{file.name}</a>
          <span style={{ fontSize: '12px', color: COLORS.lightText, marginLeft: '10px' }}>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
        </div>
      );
    }
  };

  const handleAddComment = async () => {
    if (newCommentText.trim() === '') return;
    if (!post?.forumId || !post?.id || !currentUserId) {
      console.error("Missing required data for comment:", { forumId: post?.forumId, postId: post?.id, userId: currentUserId });
      return;
    }

    try {
      const postRef = doc(db, "forums", post.forumId, "posts", post.id);
      
      // Get current post data first
      const postSnap = await getDoc(postRef);
      if (!postSnap.exists()) {
        console.error("Post does not exist");
        return;
      }

      const postData = postSnap.data();
      const currentComments = postData.comments || [];
      
      const newComment = {
        author: currentUser?.name || currentUser?.displayName || currentUser?.email || "Anonymous",
        authorId: currentUserId,
        content: newCommentText.trim(),
        timestamp: new Date(),
      };

      // Update with the new comments array
      await updateDoc(postRef, {
        comments: [...currentComments, newComment]
      });
      await notifyMentions({ text: newCommentText.trim(), forumId: post.forumId, postId: post.id, db, currentUser });
      
      setNewCommentText(''); // Clear input after commenting
      setShowComments(true);
      setNumVisibleComments(prev => Math.max(prev, currentComments.length + 1));
    } catch (error) {
      console.error("Error adding comment: ", error);
    }
  };

  const startEditComment = (commentId, content) => {
    setEditingCommentId(commentId);
    setEditedCommentText(content);
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditedCommentText('');
  };

  const handleUpdateComment = async (commentId) => {
    if (editedCommentText.trim() === '') {
      alert("Comment cannot be empty.");
      return;
    }

    try {
      const postRef = doc(db, "forums", post.forumId, "posts", post.id);
      const postSnap = await getDoc(postRef);

      if (postSnap.exists()) {
        const postData = postSnap.data();
        const updatedComments = postData.comments.map(comment => 
          comment.timestamp.seconds === commentId.seconds && comment.timestamp.nanoseconds === commentId.nanoseconds
            ? { ...comment, content: editedCommentText.trim() } : comment
        );
        await updateDoc(postRef, { comments: updatedComments });
        cancelEditComment();
      }
    } catch (error) {
      console.error("Error updating comment: ", error);
    }
  };

  const handleDeleteComment = (comment) => {
    setCommentToDelete(comment);
    setShowCommentDeleteConfirmModal(true);
  };

  const confirmDeleteComment = async () => {
    if (!commentToDelete) return;

    try {
      const postRef = doc(db, "forums", post.forumId, "posts", post.id);
      await updateDoc(postRef, {
        comments: arrayRemove(commentToDelete)
      });
      setCommentToDelete(null);
      setShowCommentDeleteConfirmModal(false);
    } catch (error) {
      console.error("Error deleting comment: ", error);
      setCommentToDelete(null);
      setShowCommentDeleteConfirmModal(false);
    }
  };

  const handleStar = async () => {
    if (!post.forumId || !post.id || !currentUserId) return;

    const postRef = doc(db, "forums", post.forumId, "posts", post.id);
    try {
      const postSnap = await getDoc(postRef);
      let currentStarredBy = postSnap.exists() ? (postSnap.data().starredBy || []) : [];

      if (hasStarred) {
        // User already starred, so unstar
        currentStarredBy = currentStarredBy.filter(id => id !== currentUserId);
      } else {
        // User hasn't starred, so star
        currentStarredBy = [...currentStarredBy, currentUserId];
      }

      await updateDoc(postRef, {
        starredBy: currentStarredBy
      });
    } catch (error) {
      console.error("Error starring post:", error);
    }
  };

  return (
    <div id={`post-${post.id}`} style={{
      backgroundColor: "white",
      borderRadius: "16px",
      padding: "0",
      marginBottom: "24px",
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
      border: "1px solid #e5e7eb",
      overflow: "hidden",
      transition: "all 0.2s ease"
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = "0 8px 25px rgba(0, 0, 0, 0.08)";
      e.currentTarget.style.transform = "translateY(-2px)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.05)";
      e.currentTarget.style.transform = "translateY(0)";
    }}>
      {/* Post Header */}
      <div style={{ 
        padding: "20px 20px 16px 20px", 
        borderBottom: "1px solid #f3f4f6"
      }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* User Avatar */}
          <div style={{ marginRight: '12px' }}>
            <a href={post.authorId ? `/profile/${post.authorId}` : undefined} style={{ textDecoration: 'none' }}>
              <UserAvatar 
                user={{ 
                  name: authorName,
                  photoURL: authorPhotoURL 
                }} 
                size={48}
                showBorder={true}
                borderColor="rgba(102, 126, 234, 0.3)"
              />
            </a>
          </div>
          <div style={{ flexGrow: 1 }}>
            <a href={post.authorId ? `/profile/${post.authorId}` : undefined} style={{ textDecoration: 'none' }}>
            <strong style={{ 
              color: "#1f2937", 
              fontSize: "16px", 
              fontWeight: "600" 
            }}>
              {authorName}
            </strong>
            </a>
            <div style={{ 
              fontSize: "14px", 
              color: "#6b7280", 
              marginTop: '2px' 
            }}>
              {formatTimestamp(post.timestamp)}
            </div>
          </div>
          {/* Three-dot menu */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowOptions(!showOptions)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                color: "#6b7280",
                padding: '8px',
                borderRadius: '50%',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#f3f4f6';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
              }}
            >
              •••
            </button>
          {showOptions && (
            <div style={{
              position: 'absolute',
              top: '30px',
              right: '0',
              backgroundColor: COLORS.white,
              borderRadius: LAYOUT.borderRadius,
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              zIndex: 10
            }}>
              <button 
                onClick={() => { onEdit(post); setShowOptions(false); }}
                style={{
                  ...BUTTON_STYLES.text,
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 15px',
                  color: COLORS.dark
                }}
              >
                Edit
              </button>
              <button 
                onClick={() => { onDelete(post.id); setShowOptions(false); }}
                style={{
                  ...BUTTON_STYLES.text,
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 15px',
                  color: COLORS.danger
                }}
              >
                Delete
              </button>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Post Content */}
      <div style={{ padding: "0 20px 16px 20px" }}>
        <p style={{ 
          margin: "0 0 16px 0", 
          color: "#374151", 
          fontSize: "15px",
          lineHeight: "1.6",
          whiteSpace: "pre-wrap"
        }}>
          {post.content}
        </p>

      {/* Attached Files/Media */}
      {post.files && post.files.length > 0 && (
        <div style={{ marginBottom: LAYOUT.smallGap, display: 'grid', gap: LAYOUT.tinyGap }}>
          {post.files.map((file, index) => (
            <React.Fragment key={index}>
              {renderFilePreview(file)}
            </React.Fragment>
          ))}
        </div>
      )}

      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: '1px solid #f3f4f6',
        padding: '16px 20px',
        backgroundColor: '#fafafa'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => onLike(post.id, currentUserId)}
            style={{
              background: hasLiked ? '#eff6ff' : 'transparent',
              border: hasLiked ? '1px solid #3b82f6' : '1px solid #e5e7eb',
              borderRadius: '20px',
              padding: '8px 16px',
              color: hasLiked ? '#3b82f6' : '#6b7280',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!hasLiked) {
                e.target.style.backgroundColor = '#f3f4f6';
                e.target.style.borderColor = '#9ca3af';
              }
            }}
            onMouseLeave={(e) => {
              if (!hasLiked) {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.borderColor = '#e5e7eb';
              }
            }}
          >
            👍 {post.likes || 0}
          </button>
          
          <button 
            onClick={handleStar}
            style={{
              background: hasStarred ? '#fffbeb' : 'transparent',
              border: hasStarred ? '1px solid #f59e0b' : '1px solid #e5e7eb',
              borderRadius: '20px',
              padding: '8px 16px',
              color: hasStarred ? '#f59e0b' : '#6b7280',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!hasStarred) {
                e.target.style.backgroundColor = '#f3f4f6';
                e.target.style.borderColor = '#9ca3af';
              }
            }}
            onMouseLeave={(e) => {
              if (!hasStarred) {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.borderColor = '#e5e7eb';
              }
            }}
          >
            {hasStarred ? '⭐' : '☆'} Star
          </button>
        </div>
        <button 
          onClick={() => setShowComments(!showComments)}
          style={{
            background: showComments ? '#f0f9ff' : 'transparent',
            border: showComments ? '1px solid #0ea5e9' : '1px solid #e5e7eb',
            borderRadius: '20px',
            padding: '8px 16px',
            color: showComments ? '#0ea5e9' : '#6b7280',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (!showComments) {
              e.target.style.backgroundColor = '#f3f4f6';
              e.target.style.borderColor = '#9ca3af';
            }
          }}
          onMouseLeave={(e) => {
            if (!showComments) {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.borderColor = '#e5e7eb';
            }
          }}
        >
          💬 {post.comments?.length || 0} Comments
        </button>
      </div>

      {/* New Comment Input */}
      {showComments && (
        <div style={{ marginTop: LAYOUT.smallGap, display: 'flex', gap: LAYOUT.tinyGap, alignItems: 'center' }}>
          <textarea
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder="Write a comment..."
            style={{
              ...INPUT_STYLES.textarea,
              flexGrow: 1,
              minHeight: '40px',
              maxHeight: '80px',
              padding: '8px',
              fontSize: '13px',
              marginBottom: '0'
            }}
          />
          <button
            onClick={handleAddComment}
            disabled={newCommentText.trim() === ''}
            style={{
              ...BUTTON_STYLES.primary,
              padding: '8px 15px',
              fontSize: '13px',
              whiteSpace: 'nowrap',
              opacity: newCommentText.trim() === '' ? 0.6 : 1,
              cursor: newCommentText.trim() === '' ? 'not-allowed' : 'pointer',
            }}
          >
            Comment
          </button>
        </div>
      )}

      {/* Comments Section */}
      {showComments && (
        <div style={{
          marginTop: LAYOUT.smallGap,
          paddingTop: LAYOUT.smallGap,
          borderTop: `1px solid ${COLORS.border}`
        }}>
          {post.comments && post.comments.slice(0, numVisibleComments).map((comment, index) => (
            <div key={index} style={{ marginBottom: LAYOUT.tinyGap, padding: '5px 0', borderBottom: `1px dashed ${COLORS.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '3px' }}>
                <span style={{ fontSize: '14px', marginRight: '5px', color: COLORS.dark }}>🗣️</span>
                <strong style={{ fontSize: '13px', color: COLORS.dark }}>{commentAuthorMap[comment.authorId] || comment.author || 'Anonymous'}:</strong>
                <span style={{ fontSize: '11px', color: COLORS.lightText, marginLeft: '8px' }}>{formatTimestamp(comment.timestamp)}</span>
                {/* Comment Actions */}
                {comment.authorId === currentUserId && (
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '5px' }}>
                    {editingCommentId === (comment.timestamp?.seconds || null) && editingCommentId === (comment.timestamp?.nanoseconds || null) ? (
                      <>
                        <button onClick={() => handleUpdateComment(comment.timestamp)} style={{ ...BUTTON_STYLES.text, color: COLORS.primary, fontSize: '12px' }}>Save</button>
                        <button onClick={cancelEditComment} style={{ ...BUTTON_STYLES.text, color: COLORS.lightText, fontSize: '12px' }}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEditComment(comment.timestamp, comment.content)} style={{ ...BUTTON_STYLES.text, color: COLORS.primary, fontSize: '12px' }}>Edit</button>
                        <button onClick={() => handleDeleteComment(comment)} style={{ ...BUTTON_STYLES.text, color: COLORS.danger, fontSize: '12px' }}>Delete</button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {editingCommentId === (comment.timestamp?.seconds || null) && editingCommentId === (comment.timestamp?.nanoseconds || null) ? (
                <textarea
                  value={editedCommentText}
                  onChange={(e) => setEditedCommentText(e.target.value)}
                  style={{
                    ...INPUT_STYLES.textarea,
                    width: '100%',
                    minHeight: '60px',
                    marginTop: '5px',
                    marginBottom: '0',
                    fontSize: '13px'
                  }}
                />
              ) : (
                <p style={{ margin: '0', fontSize: '13px', color: COLORS.text, paddingLeft: '20px' }}>{comment.content}</p>
              )}
            </div>
          ))}

          {post.comments && post.comments.length > numVisibleComments && (
            <button 
              onClick={() => setNumVisibleComments(prev => prev + 5)} // Load 5 more comments
              style={{
                ...BUTTON_STYLES.text,
                color: COLORS.primary,
                fontSize: '12px',
                padding: '5px 0'
              }}
            >
              See More Comments
            </button>
          )}

          {post.comments && post.comments.length > 0 && (
            <button 
              onClick={() => setShowComments(false)} // Hide comments
              style={{
                ...BUTTON_STYLES.text,
                color: COLORS.lightText,
                fontSize: '12px',
                padding: '5px 0',
                marginLeft: LAYOUT.smallGap
              }}
            >
              Hide Comments
            </button>
          )}
        </div>
      )}
      {/* Comment Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showCommentDeleteConfirmModal}
        onClose={() => setShowCommentDeleteConfirmModal(false)}
        onConfirm={confirmDeleteComment}
        message="Are you sure you want to delete this comment? This action cannot be undone."
      />
    </div>
  );
};

export default function Discussion({ forumData, posts, setPosts, forumId, updateForumLastActivity, updateForumPostCount, currentUser }) {
  const [newPostContent, setNewPostContent] = useState('');
  const [editingPost, setEditingPost] = useState(null); // New state to track which post is being edited
  const [showCreatePostModal, setShowCreatePostModal] = useState(false); // State to control CreatePostModal visibility
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false); // State for delete confirmation modal
  const [postToDeleteId, setPostToDeleteId] = useState(null); // State to hold the ID of the post to be deleted
  // The `posts` state is now managed by Forum.js and passed down.
  // This component will directly use and update `posts` via the props.

  // Fetch posts from Firestore in real-time
  useEffect(() => {
    if (!forumId) return;

    const postsCollectionRef = collection(doc(db, "forums", forumId), "posts");
    const q = query(postsCollectionRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => {
        const data = doc.data();
        // Removed temporary 'starredBy' initialization. It's now handled by handleStar.
        return {
          id: doc.id,
          forumId: forumId, // Add forumId to post data
          ...data
        }
      });
      setPosts(postsData); // Update parent's posts state
    });

    return () => unsubscribe();
  }, [forumId, setPosts]); // Add setPosts to dependency array

  const handleLike = async (postId, userId) => {
    if (!forumId || !postId || !userId) return;

    const postRef = doc(db, "forums", forumId, "posts", postId);
    const postSnap = await getDoc(postRef);

    if (postSnap.exists()) {
      const postData = postSnap.data();
      const likedBy = postData.likedBy || [];

      if (likedBy.includes(userId)) {
        // User already liked, so unlike
        await updateDoc(postRef, {
          likes: increment(-1),
          likedBy: arrayRemove(userId)
        });
      } else {
        // User hasn't liked, so like
        await updateDoc(postRef, {
          likes: increment(1),
          likedBy: arrayUnion(userId)
        });
      }
      updateForumLastActivity();
    }
  };

  const handleEditPost = (post) => {
    setEditingPost(post);
    setShowCreatePostModal(true);
  };

  const handleUpdatePost = async (updatedPostData) => {
    if (!forumId || !editingPost?.id) return;

    try {
      const postRef = doc(db, "forums", forumId, "posts", editingPost.id);
      await updateDoc(postRef, updatedPostData);
      setEditingPost(null);
      setShowCreatePostModal(false);
      updateForumLastActivity();
    } catch (error) {
      console.error("Error updating post: ", error);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!forumId || !postId) return;

    setPostToDeleteId(postId);
    setShowDeleteConfirmModal(true);
  };

  const confirmDeletePost = async () => {
    if (!forumId || !postToDeleteId) return;

    try {
      // First get the post to check for files
      const postRef = doc(db, "forums", forumId, "posts", postToDeleteId);
      const postSnap = await getDoc(postRef);
      
      if (postSnap.exists()) {
        const postData = postSnap.data();
        
        // Delete files from storage if they exist
        if (postData.files && postData.files.length > 0) {
          const deletePromises = postData.files.map(async (file) => {
            try {
              if (file.url) {
                // Extract file path from URL
                const url = new URL(file.url);
                const pathMatch = url.pathname.match(/\/o\/(.+?)\?/);
                if (pathMatch) {
                  const filePath = decodeURIComponent(pathMatch[1]);
                  const fileRef = ref(storage, filePath);
                  await deleteObject(fileRef);
                  console.log(`Deleted file: ${filePath}`);
                }
              }
            } catch (fileError) {
              console.error("Error deleting file:", fileError);
              // Continue with post deletion even if file deletion fails
            }
          });
          
          await Promise.allSettled(deletePromises);
        }
      }
      
      // Delete the post document
      await deleteDoc(postRef);
      updateForumLastActivity();
      updateForumPostCount(-1); // Decrement post count
      setShowDeleteConfirmModal(false);
      setPostToDeleteId(null);
    } catch (error) {
      console.error("Error deleting post: ", error);
      setShowDeleteConfirmModal(false);
      setPostToDeleteId(null);
    }
  };

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (newPostContent.trim() === '' || !forumId) return;

    try {
      const ref = await addDoc(collection(doc(db, "forums", forumId), "posts"), {
        content: newPostContent.trim(),
        author: currentUser?.name || currentUser?.displayName || currentUser?.email || "Anonymous", // Use currentUser.name
        authorId: currentUser?.uid, // Add authorId field
        timestamp: serverTimestamp(),
        likes: 0, // Initialize likes to 0
        comments: [], // Initialize comments as an empty array
        likedBy: [], // Initialize likedBy as an empty array
        starredBy: [], // Initialize starredBy as an empty array
      });
      await notifyMentions({ text: newPostContent.trim(), forumId, postId: ref.id, db, currentUser });
      setNewPostContent('');
      updateForumLastActivity(); // Update parent forum's last activity
      updateForumPostCount(1); // Increment post count
    } catch (error) {
      console.error("Error adding post: ", error);
    }
  };

  return (
    <div style={{ padding: LAYOUT.gap, background: COLORS.background }}>
      {/* Post creation form */}
      <form onSubmit={handlePostSubmit} style={{ marginBottom: LAYOUT.gap }}>
                    <textarea
          value={newPostContent}
          onChange={(e) => setNewPostContent(e.target.value)}
          placeholder="Write a new post..."
                      style={{
            ...INPUT_STYLES.textarea,
            width: "100%",
            minHeight: "80px",
            marginBottom: LAYOUT.smallGap,
                      }}
                    />
                    <button
          type="submit" 
          style={{ ...BUTTON_STYLES.primary, width: "100%", padding: "10px" }}
        >
          Post
                    </button>
      </form>

      {/* Posts List */}
      <div>
        {posts.length === 0 ? (
          <p style={{ textAlign: "center", color: COLORS.lightText, marginTop: LAYOUT.gap }}>No posts yet. Be the first to start a discussion!</p>
        ) : (
          posts.map(post => (
            <PostItem key={post.id} post={post} onLike={handleLike} onEdit={handleEditPost} onDelete={handleDeletePost} currentUser={currentUser} />
          ))
        )}
      </div>

      {/* Create/Edit Post Modal (moved from Forum.js) */}
      <CreatePostModal
        isOpen={showCreatePostModal}
        onClose={() => {
          setShowCreatePostModal(false);
          setEditingPost(null);
        }}
        forumId={forumId}
        updateForumLastActivity={updateForumLastActivity}
        updateForumPostCount={updateForumPostCount}
        editingPost={editingPost}
        onConfirm={handleUpdatePost}
        currentUser={currentUser}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirmModal}
        onClose={() => setShowDeleteConfirmModal(false)}
        onConfirm={confirmDeletePost}
        message="Are you sure you want to delete this post? This action cannot be undone."
      />
    </div>
  );
}
