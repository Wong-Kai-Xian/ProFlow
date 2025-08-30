import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { COLORS, LAYOUT, INPUT_STYLES, BUTTON_STYLES } from "../profile-component/constants";
import { db } from "../../firebase"; // Import db
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, arrayUnion, arrayRemove, getDoc, deleteDoc, where, getDocs } from "firebase/firestore"; // Import Firestore functions
import { storage } from "../../firebase";
import { ref, deleteObject, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import CreatePostModal from "./CreatePostModal"; // Import CreatePostModal
import ConfirmationModal from "./ConfirmationModal"; // Import ConfirmationModal
import LocationModal from "./LocationModal";
import MeetingModal from "./MeetingModal";
import UserAvatar from "../shared/UserAvatar";

// Helper to format timestamp
const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'N/A';
  // Firestore Timestamp object might need to be converted to a Date object first
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString();
};

// Mention helpers
const makeSnippet = (text = '', maxLen = 120) => {
  try {
    const oneLine = String(text).replace(/\s+/g, ' ').trim();
    if (oneLine.length > maxLen) return oneLine.slice(0, Math.max(0, maxLen - 3)) + '...';
    return oneLine;
  } catch {
    return '';
  }
};

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
          const snippet = makeSnippet(text, 140);
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

// Notify forum members about a new post (except the author)
const notifyForumMembersNewPost = async ({ forumId, postId, db, currentUser, postText }) => {
  try {
    const fref = doc(db, 'forums', forumId);
    const fsnap = await getDoc(fref);
    if (!fsnap.exists()) return;
    const data = fsnap.data();
    const members = Array.isArray(data.members) ? data.members : [];
    const actor = currentUser?.displayName || currentUser?.name || currentUser?.email || 'Someone';
    const snippet = makeSnippet(postText || '', 140);
    for (const uid of members) {
      if (!uid || uid === (currentUser?.uid || '')) continue;
      try {
        await addDoc(collection(db, 'users', uid, 'notifications'), {
          unread: true,
          createdAt: serverTimestamp(),
          origin: 'forum',
          title: `New post by ${actor}`,
          message: snippet,
          refType: 'forumPost',
          forumId,
          postId
        });
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
  const [openCommentMenuIndex, setOpenCommentMenuIndex] = useState(null); // 3-dot menu state for comments
  const [commentFiles, setCommentFiles] = useState([]); // Files attached to new comment
  const [showCommentDeleteConfirmModal, setShowCommentDeleteConfirmModal] = useState(false); // State for comment delete confirmation modal
  const [commentToDelete, setCommentToDelete] = useState(null); // State to hold the comment to be deleted
  const hasStarred = post.starredBy?.includes(currentUserId); // New state to check if current user has starred
  const [authorName, setAuthorName] = useState(post.author || 'Anonymous');
  const [authorPhotoURL, setAuthorPhotoURL] = useState(post.authorPhotoURL || undefined);
  const [commentAuthorMap, setCommentAuthorMap] = useState({}); // authorId -> displayName
  const [showMeetingDetails, setShowMeetingDetails] = useState(false);

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
    if (newCommentText.trim() === '' && commentFiles.length === 0) return;
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
      let uploadedFileMetadata = [];
      if (commentFiles.length > 0) {
        const uploadPromises = commentFiles.map((file) => {
          return new Promise((resolve, reject) => {
            try {
              const storageRef = ref(storage, `forum_comments/${post.forumId}/${post.id}/${file.name}`);
              const task = uploadBytesResumable(storageRef, file);
              task.on('state_changed', () => {}, reject, async () => {
                try {
                  const url = await getDownloadURL(task.snapshot.ref);
                  uploadedFileMetadata.push({ name: file.name, url, type: file.type, size: file.size });
                  resolve();
                } catch (e) {
                  reject(e);
                }
              });
            } catch (e) {
              reject(e);
            }
          });
        });
        await Promise.all(uploadPromises);
      }
      
      const newComment = {
        author: currentUser?.name || currentUser?.displayName || currentUser?.email || "Anonymous",
        authorId: currentUserId,
        content: newCommentText.trim(),
        timestamp: new Date(),
        files: uploadedFileMetadata,
      };

      // Update with the new comments array
      await updateDoc(postRef, {
        comments: [...currentComments, newComment]
      });
      await notifyMentions({ text: newCommentText.trim(), forumId: post.forumId, postId: post.id, db, currentUser });
      // Notify post author if someone commented on their post
      try {
        const targetUserId = postData.authorId;
        if (targetUserId && targetUserId !== currentUserId) {
          const actor = currentUser?.displayName || currentUser?.name || currentUser?.email || 'Someone';
          const snippet = makeSnippet(newCommentText.trim(), 140);
          await addDoc(collection(db, 'users', targetUserId, 'notifications'), {
            unread: true,
            createdAt: serverTimestamp(),
            origin: 'forum',
            title: 'New comment on your post',
            message: `${actor}: ${snippet}`,
            refType: 'forumComment',
            forumId: post.forumId,
            postId: post.id
          });
        }
      } catch {}
      
      setNewCommentText(''); // Clear input after commenting
      setCommentFiles([]);
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

        {/* Meeting and Location Information */}
        {(post.meeting || post.location) && (
          <div style={{ 
            marginBottom: "16px", 
            display: "flex", 
            gap: "8px", 
            flexWrap: "wrap" 
          }}>
            {post.location && (
              <span style={{ 
                background: '#ecfdf5', 
                border: '1px solid #a7f3d0', 
                color: '#065f46', 
                padding: '6px 10px', 
                borderRadius: '6px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                📍 {post.location}
              </span>
            )}
            {post.meeting && (
              <button type="button" onClick={() => setShowMeetingDetails(true)} style={{ 
                background: '#fffbeb', 
                border: '1px solid #fde68a', 
                color: '#92400e', 
                padding: '6px 10px', 
                borderRadius: '6px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}>
                📅 {post.meeting.type} {post.meeting.fullDateTime}
              </button>
            )}
          </div>
        )}

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

      {/* Meeting details modal */}
      {showMeetingDetails && post.meeting && ReactDOM.createPortal((
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowMeetingDetails(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: '92%', maxWidth: 520, boxShadow: '0 20px 50px rgba(0,0,0,0.25)', padding: 18 }}>
            <h3 style={{ margin: 0, fontSize: 18, color: COLORS.dark }}>Meeting details</h3>
            <div style={{ marginTop: 10, display: 'grid', gap: 8, fontSize: 14, color: COLORS.text }}>
              {post.meeting.title && <div><strong style={{ color: COLORS.dark }}>Title:</strong> {post.meeting.title}</div>}
              <div><strong style={{ color: COLORS.dark }}>When:</strong> {post.meeting.fullDateTime || `${post.meeting.date} ${post.meeting.time}`}</div>
              {post.meeting.duration && <div><strong style={{ color: COLORS.dark }}>Duration:</strong> {post.meeting.duration}</div>}
              {post.meeting.mode === 'external' && post.meeting.link && (
                <div><strong style={{ color: COLORS.dark }}>Link:</strong> <a href={post.meeting.link} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>{post.meeting.link}</a></div>
              )}
              {post.meeting.mode === 'physical' && post.meeting.place && (
                <div><strong style={{ color: COLORS.dark }}>Location:</strong> {post.meeting.place}</div>
              )}
              {post.meeting.description && (
                <div><strong style={{ color: COLORS.dark }}>Notes:</strong><div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{post.meeting.description}</div></div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button onClick={() => setShowMeetingDetails(false)} style={{ background: 'transparent', border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      ), document.body)}

      {/* New Comment Input */}
      {showComments && (
        <>
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
          <input 
            type="file" 
            multiple 
            onChange={(e) => setCommentFiles(Array.from(e.target.files || []))}
            style={{ display: 'none' }} 
            id={`comment-file-input-${post.id}`}
          />
          <label htmlFor={`comment-file-input-${post.id}`} title="Attach files" style={{ ...BUTTON_STYLES.secondary, padding: '6px 10px', cursor: 'pointer' }}>📎</label>
          <button
            onClick={handleAddComment}
            disabled={newCommentText.trim() === '' && commentFiles.length === 0}
            style={{
              ...BUTTON_STYLES.primary,
              padding: '8px 15px',
              fontSize: '13px',
              whiteSpace: 'nowrap',
              opacity: (newCommentText.trim() === '' && commentFiles.length === 0) ? 0.6 : 1,
              cursor: (newCommentText.trim() === '' && commentFiles.length === 0) ? 'not-allowed' : 'pointer',
            }}
          >
            Comment
          </button>
        </div>
        {commentFiles.length > 0 && (
          <div style={{ marginTop: LAYOUT.tinyGap, fontSize: '12px', color: COLORS.lightText }}>
            {commentFiles.length} file(s) selected
          </div>
        )}
        </>
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
                  <div style={{ marginLeft: 'auto', position: 'relative', display: 'flex', gap: '5px' }}>
                    {/* If editing this comment, show Save/Cancel */}
                    {(
                      editingCommentId?.seconds === comment.timestamp?.seconds &&
                      editingCommentId?.nanoseconds === comment.timestamp?.nanoseconds
                    ) ? (
                      <>
                        <button onClick={() => handleUpdateComment(comment.timestamp)} style={{ ...BUTTON_STYLES.text, color: COLORS.primary, fontSize: '12px' }}>Save</button>
                        <button onClick={cancelEditComment} style={{ ...BUTTON_STYLES.text, color: COLORS.lightText, fontSize: '12px' }}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setOpenCommentMenuIndex(openCommentMenuIndex === index ? null : index); }}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '18px',
                            cursor: 'pointer',
                            color: '#6b7280',
                            padding: '4px 8px',
                            borderRadius: '6px'
                          }}
                          onMouseEnter={(e) => { e.target.style.backgroundColor = '#f3f4f6'; }}
                          onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; }}
                        >
                          •••
                        </button>
                        {openCommentMenuIndex === index && (
                          <div style={{
                            position: 'absolute',
                            top: '24px',
                            right: 0,
                            backgroundColor: COLORS.white,
                            borderRadius: LAYOUT.borderRadius,
                            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                            zIndex: 5
                          }}
                          onClick={(e) => e.stopPropagation()}
                          >
                            <button 
                              onClick={() => { startEditComment(comment.timestamp, comment.content); setOpenCommentMenuIndex(null); }}
                              style={{ ...BUTTON_STYLES.text, width: '100%', textAlign: 'left', padding: '8px 12px', color: COLORS.dark }}
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => { handleDeleteComment(comment); setOpenCommentMenuIndex(null); }}
                              style={{ ...BUTTON_STYLES.text, width: '100%', textAlign: 'left', padding: '8px 12px', color: COLORS.danger }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
              {(
                editingCommentId?.seconds === comment.timestamp?.seconds &&
                editingCommentId?.nanoseconds === comment.timestamp?.nanoseconds
              ) ? (
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
                <div style={{ paddingLeft: '20px' }}>
                  <p style={{ margin: '0', fontSize: '13px', color: COLORS.text }}>{comment.content}</p>
                  {Array.isArray(comment.files) && comment.files.length > 0 && (
                    <div style={{ marginTop: 6, display: 'grid', gap: 6 }}>
                      {comment.files.map((file, i) => (
                        <a key={i} href={file.url} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.primary, fontSize: '12px' }}>
                          📎 {file.name}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
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
  const [composerFiles, setComposerFiles] = useState([]);
  const [composerLocation, setComposerLocation] = useState('');
  const [composerMeeting, setComposerMeeting] = useState(null);
  const [showComposerLocationModal, setShowComposerLocationModal] = useState(false);
  const [showComposerMeetingModal, setShowComposerMeetingModal] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [composerFileProgress, setComposerFileProgress] = useState({});
  const [mentionCandidates, setMentionCandidates] = useState([]); // forum members for @ suggest
  const [postMentionOpen, setPostMentionOpen] = useState(false);
  const [postMentionQuery, setPostMentionQuery] = useState('');
  const [postMentionIndex, setPostMentionIndex] = useState(0);
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

  // Load forum members for mention suggestions (limit to this forum only)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!forumId) { setMentionCandidates([]); return; }
        const fref = doc(db, 'forums', forumId);
        const fsnap = await getDoc(fref);
        const members = fsnap.exists() ? (fsnap.data().members || []) : [];
        if (!members.length) { setMentionCandidates([]); return; }
        // Fetch user docs for these members in chunks
        const chunkSize = 10;
        const results = [];
        for (let i = 0; i < members.length; i += chunkSize) {
          const slice = members.slice(i, i + chunkSize);
          try {
            const q = query(collection(db, 'users'), where('uid', 'in', slice));
            const snap = await getDocs(q);
            snap.forEach(u => {
              const d = u.data();
              if (d.uid !== currentUser?.uid) results.push({ uid: d.uid || u.id, name: d.name || d.displayName || d.email || 'Member', email: d.email || '' });
            });
          } catch {}
        }
        if (active) setMentionCandidates(results);
      } catch {
        if (active) setMentionCandidates([]);
      }
    })();
    return () => { active = false; };
  }, [forumId, currentUser?.uid]);

  const updatePostMentionState = (value) => {
    setNewPostContent(value);
    const m = value.match(/(^|\s)@([A-Za-z0-9._%+-]*)$/);
    if (m) {
      const q = (m[2] || '').toLowerCase();
      const list = mentionCandidates.filter(u => (u.name || '').toLowerCase().startsWith(q) || (u.email || '').toLowerCase().startsWith(q)).slice(0, 6);
      setPostMentionQuery(q);
      setPostMentionIndex(0);
      setPostMentionOpen(list.length > 0);
    } else {
      setPostMentionOpen(false);
      setPostMentionQuery('');
    }
  };

  const insertPostMention = (user) => {
    // Replace the trailing @query with @email (our extractor expects email)
    const replaced = newPostContent.replace(/(^|\s)@([A-Za-z0-9._%+-]*)$/, (m0, s1) => `${s1}@${user.email} `);
    setNewPostContent(replaced);
    setPostMentionOpen(false);
    setPostMentionQuery('');
  };

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
    if ((!newPostContent.trim() && composerFiles.length === 0) || !forumId) return;

    try {
      setIsPosting(true);
      let uploadedFileMetadata = [];
      if (composerFiles.length > 0) {
        const uploadPromises = composerFiles.map((file) => {
          if (!(file instanceof File)) { uploadedFileMetadata.push(file); return Promise.resolve(); }
          return new Promise((resolve, reject) => {
            try {
              const storagePath = `forum_attachments/${forumId}/${file.name}`;
              const task = uploadBytesResumable(ref(storage, storagePath), file);
              task.on('state_changed', (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setComposerFileProgress(prev => ({ ...prev, [file.name]: progress }));
              }, reject, async () => {
                try {
                  const url = await getDownloadURL(task.snapshot.ref);
                  uploadedFileMetadata.push({ name: file.name, url, type: file.type, size: file.size });
                  resolve();
                } catch (e) { reject(e); }
              });
            } catch (e) { reject(e); }
          });
        });
        await Promise.all(uploadPromises);
      }

      const refDoc = await addDoc(collection(doc(db, "forums", forumId), "posts"), {
        content: newPostContent.trim(),
        author: currentUser?.name || currentUser?.displayName || currentUser?.email || "Anonymous", // Use currentUser.name
        authorId: currentUser?.uid, // Add authorId field
        timestamp: serverTimestamp(),
        likes: 0, // Initialize likes to 0
        comments: [], // Initialize comments as an empty array
        likedBy: [], // Initialize likedBy as an empty array
        starredBy: [], // Initialize starredBy as an empty array
        files: uploadedFileMetadata,
        location: composerLocation,
        meeting: composerMeeting,
      });
      // Auto-create a forum reminder when meeting is attached
      try {
        const m = composerMeeting;
        if (m && m.date && m.time) {
          const title = m.title || 'Meeting';
          const details = [m.description || '', (m.link ? `Link: ${m.link}` : ''), (m.place ? `Location: ${m.place}` : '')].filter(Boolean).join('\n');
          await addDoc(collection(db, `forums/${forumId}/reminders`), {
            type: 'meeting',
            title,
            date: m.date,
            time: m.time,
            description: details,
            priority: 'medium',
            duration: m.duration || '',
            createdFrom: { forumId, postId: refDoc.id },
            timestamp: serverTimestamp(),
          });
        }
      } catch {}
      await notifyMentions({ text: newPostContent.trim(), forumId, postId: refDoc.id, db, currentUser });
      // Notify all forum members of new post
      try { await notifyForumMembersNewPost({ forumId, postId: refDoc.id, db, currentUser, postText: newPostContent.trim() }); } catch {}
      setNewPostContent('');
      setComposerFiles([]);
      setComposerLocation('');
      setComposerMeeting(null);
      setComposerFileProgress({});
      setIsPosting(false);
      updateForumLastActivity(); // Update parent forum's last activity
      updateForumPostCount(1); // Increment post count
    } catch (error) {
      console.error("Error adding post: ", error);
      setIsPosting(false);
    }
  };

  return (
    <div style={{ padding: LAYOUT.gap, background: COLORS.background }}>
      {/* Post creation form */}
      <form onSubmit={handlePostSubmit} style={{ marginBottom: LAYOUT.gap, position: 'relative' }}>
        <textarea
          value={newPostContent}
          onChange={(e) => updatePostMentionState(e.target.value)}
          placeholder="Write a new post..."
          style={{
            ...INPUT_STYLES.textarea,
            width: "100%",
            minHeight: "80px",
            marginBottom: LAYOUT.smallGap,
          }}
        />
        {/* Quick composer actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <button
            type="button"
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.multiple = true;
              input.onchange = (e) => {
                const files = Array.from(e.target.files || []);
                setComposerFiles(prev => [...prev, ...files]);
              };
              input.click();
            }}
            style={{ ...BUTTON_STYLES.secondary, padding: '6px 10px' }}
            disabled={isPosting}
          >
            🖼️
          </button>
          <button
            type="button"
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.multiple = true;
              input.onchange = (e) => {
                const files = Array.from(e.target.files || []);
                setComposerFiles(prev => [...prev, ...files]);
              };
              input.click();
            }}
            style={{ ...BUTTON_STYLES.secondary, padding: '6px 10px' }}
            disabled={isPosting}
          >
            📎
          </button>
          <button
            type="button"
            onClick={() => setShowComposerMeetingModal(true)}
            style={{ ...BUTTON_STYLES.secondary, padding: '6px 10px' }}
            disabled={isPosting}
          >
            📅
          </button>
          <button
            type="button"
            onClick={() => setShowComposerLocationModal(true)}
            style={{ ...BUTTON_STYLES.secondary, padding: '6px 10px' }}
            disabled={isPosting}
          >
            📍
          </button>
        </div>
        {composerFiles.length > 0 && (
          <div style={{ marginBottom: 8, fontSize: 12, color: COLORS.lightText, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {composerFiles.map((file, idx) => (
              <span key={idx} style={{ background: '#eef2ff', border: '1px solid #c7d2fe', color: '#3730a3', padding: '2px 6px', borderRadius: 6 }}>
                {file.name || file.url}
                {composerFileProgress[file.name] !== undefined && (
                  <span style={{ marginLeft: 4 }}>({(composerFileProgress[file.name] || 0).toFixed(0)}%)</span>
                )}
                <button type="button" onClick={() => setComposerFiles(prev => prev.filter((_, i) => i !== idx))} style={{ marginLeft: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280' }}>×</button>
              </span>
            ))}
          </div>
        )}
        {(composerLocation || composerMeeting) && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            {composerLocation && (
              <span style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '2px 6px', borderRadius: 6 }}>
                📍 {composerLocation}
                <button type="button" onClick={() => setComposerLocation('')} style={{ marginLeft: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280' }}>×</button>
              </span>
            )}
            {composerMeeting && (
              <span style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '2px 6px', borderRadius: 6 }}>
                📅 {composerMeeting.type} {composerMeeting.fullDateTime}
                <button type="button" onClick={() => setComposerMeeting(null)} style={{ marginLeft: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280' }}>×</button>
              </span>
            )}
          </div>
        )}
        {postMentionOpen && (
          <div style={{ position: 'absolute', left: 0, bottom: 0, transform: 'translateY(100%)', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 8px 20px rgba(0,0,0,0.08)', padding: 6, zIndex: 20, minWidth: 280 }}>
            {mentionCandidates
              .filter(u => (u.name || '').toLowerCase().startsWith(postMentionQuery) || (u.email || '').toLowerCase().startsWith(postMentionQuery))
              .slice(0,6)
              .map((u, i) => (
                <div key={u.uid || u.email} onMouseDown={(e) => { e.preventDefault(); insertPostMention(u); }}
                  style={{ padding: '6px 8px', borderRadius: 6, cursor: 'pointer', background: i === postMentionIndex ? '#f1f5f9' : 'transparent', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 13, color: '#111827', fontWeight: 600 }}>{u.name}</span>
                  <span style={{ fontSize: 11, color: '#6b7280' }}>{u.email}</span>
                </div>
              ))}
          </div>
        )}
        <button
          type="submit" 
          style={{ ...BUTTON_STYLES.primary, width: "100%", padding: "10px", opacity: isPosting ? 0.7 : 1 }}
          disabled={isPosting}
        >
          {isPosting ? 'Posting...' : 'Post'}
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

      {/* Composer modals */}
      <LocationModal
        isOpen={showComposerLocationModal}
        onClose={() => setShowComposerLocationModal(false)}
        onSave={(loc) => setComposerLocation(loc)}
      />
      <MeetingModal
        isOpen={showComposerMeetingModal}
        onClose={() => setShowComposerMeetingModal(false)}
        onSave={(meeting) => setComposerMeeting(meeting)}
      />

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
