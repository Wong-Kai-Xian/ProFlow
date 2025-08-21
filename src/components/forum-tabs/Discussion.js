import React, { useState, useEffect } from "react";

export default function Discussion({ forumData }) {
  const [posts, setPosts] = useState([]);
  const [likedPosts, setLikedPosts] = useState(new Set());
  const [commentInputs, setCommentInputs] = useState({});
  const [showCommentInput, setShowCommentInput] = useState({});

  useEffect(() => {
    // Mock posts data
    setPosts([
      {
        id: 1,
        type: 'message',
        author: 'John Smith',
        timestamp: '2 hours ago',
        content: 'Great progress on the project so far! Looking forward to the next milestone.',
        likes: 5,
        comments: [
          { author: 'Sarah Johnson', content: 'Agreed! The team is doing amazing work.' },
          { author: 'Mike Chen', content: 'Thanks for the feedback!' }
        ]
      },
      {
        id: 2,
        type: 'meeting',
        author: 'Sarah Johnson',
        timestamp: '4 hours ago',
        content: 'Team standup meeting scheduled for tomorrow at 10 AM',
        meetingDetails: {
          title: 'Weekly Standup',
          date: 'Tomorrow, 10:00 AM',
          location: 'Conference Room A'
        },
        likes: 3,
        comments: []
      },
      {
        id: 3,
        type: 'file',
        author: 'Mike Chen',
        timestamp: '1 day ago',
        content: 'Uploaded project requirements document',
        fileDetails: {
          filename: 'Project_Requirements_v2.pdf',
          size: '2.3 MB'
        },
        likes: 8,
        comments: [
          { author: 'John Smith', content: 'Thanks for sharing this!' }
        ]
      }
    ]);
  }, []);



  const handleLike = (postId) => {
    const newLikedPosts = new Set(likedPosts);
    
    if (likedPosts.has(postId)) {
      // Unlike the post
      newLikedPosts.delete(postId);
      setPosts(posts.map(post => 
        post.id === postId 
          ? { ...post, likes: post.likes - 1 }
          : post
      ));
    } else {
      // Like the post
      newLikedPosts.add(postId);
      setPosts(posts.map(post => 
        post.id === postId 
          ? { ...post, likes: post.likes + 1 }
          : post
      ));
    }
    
    setLikedPosts(newLikedPosts);
  };

  const handleCommentToggle = (postId) => {
    setShowCommentInput(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  };

  const handleCommentChange = (postId, value) => {
    setCommentInputs(prev => ({
      ...prev,
      [postId]: value
    }));
  };

  const handleCommentSubmit = (postId) => {
    const commentText = commentInputs[postId];
    if (commentText && commentText.trim()) {
      const newComment = {
        author: 'Current User',
        content: commentText.trim()
      };
      
      setPosts(posts.map(post => 
        post.id === postId 
          ? { ...post, comments: [...post.comments, newComment] }
          : post
      ));
      
      // Clear the comment input
      setCommentInputs(prev => ({
        ...prev,
        [postId]: ''
      }));
      
      // Hide the comment input
      setShowCommentInput(prev => ({
        ...prev,
        [postId]: false
      }));
    }
  };





  const getPostTypeLabel = (type) => {
    switch(type) {
      case 'meeting':
        return { text: 'Meeting scheduled', color: '#F39C12' };
      case 'file':
        return { text: 'File uploaded', color: '#27AE60' };
      default:
        return null;
    }
  };

  const actionButtonStyle = {
    padding: '8px 12px',
    margin: '0 5px',
    border: '1px solid #BDC3C7',
    backgroundColor: 'white',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#7F8C8D',
    transition: 'all 0.3s ease'
  };

  return (
    <div>
      {/* Discussion Feed */}
      <div style={{ marginBottom: '20px' }}>
        {posts.length === 0 ? (
          <div style={{
            backgroundColor: 'white',
            padding: '40px',
            borderRadius: '10px',
            textAlign: 'center',
            border: '1px solid #ECF0F1'
          }}>
            <h3 style={{ color: '#7F8C8D', margin: '0 0 10px 0' }}>No posts yet</h3>
            <p style={{ color: '#95A5A6', margin: 0 }}>
              Be the first to start a discussion! Click the create button to get started.
            </p>
          </div>
        ) : (
          posts.map((post) => {
            const typeLabel = getPostTypeLabel(post.type);
            
                          return (
                <div key={post.id} id={`post-${post.id}`} style={{
                backgroundColor: 'white',
                padding: '25px',
                borderRadius: '12px',
                marginBottom: '20px',
                border: '1px solid #ECF0F1',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                transition: 'all 0.2s ease'
              }}>
              {/* Post Header */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start',
                marginBottom: '10px' 
              }}>
                <div>
                  <strong style={{ color: '#2C3E50' }}>{post.author}</strong>
                  <span style={{ color: '#7F8C8D', marginLeft: '10px', fontSize: '12px' }}>
                    {post.timestamp}
                  </span>
                  {typeLabel && (
                    <span style={{
                      backgroundColor: typeLabel.color,
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      marginLeft: '10px'
                    }}>
                      {typeLabel.text}
                    </span>
                  )}
                </div>
              </div>

              {/* Post Content */}
              <div style={{ marginBottom: '15px', color: '#2C3E50' }}>
                {post.content}
              </div>

              {/* Meeting Details */}
              {post.type === 'meeting' && post.meetingDetails && (
                <div style={{
                  backgroundColor: '#FEF9E7',
                  padding: '10px',
                  borderRadius: '5px',
                  marginBottom: '15px',
                  borderLeft: '4px solid #F39C12'
                }}>
                  <strong>{post.meetingDetails.title}</strong><br/>
                  <small>📅 {post.meetingDetails.date}</small><br/>
                  <small>📍 {post.meetingDetails.location}</small>
                </div>
              )}

              {/* File Details */}
              {post.type === 'file' && post.fileDetails && (
                <div style={{
                  backgroundColor: '#E8F8F5',
                  padding: '10px',
                  borderRadius: '5px',
                  marginBottom: '15px',
                  borderLeft: '4px solid #27AE60'
                }}>
                  <strong>📄 {post.fileDetails.filename}</strong><br/>
                  <small>Size: {post.fileDetails.size}</small>
                </div>
              )}

              {/* Post Actions */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '15px',
                paddingTop: '10px',
                borderTop: '1px solid #ECF0F1'
              }}>
                <button
                  onClick={() => handleLike(post.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: likedPosts.has(post.id) ? '#3498DB' : '#7F8C8D',
                    fontSize: '12px',
                    fontWeight: likedPosts.has(post.id) ? 'bold' : 'normal'
                  }}
                >
                  {likedPosts.has(post.id) ? '👍' : '👍'} {post.likes} Like{post.likes !== 1 ? 's' : ''}
                </button>
                <button 
                  onClick={() => handleCommentToggle(post.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#7F8C8D',
                    fontSize: '12px'
                  }}
                >
                  💬 {post.comments.length} Comment{post.comments.length !== 1 ? 's' : ''}
                </button>
              </div>

              {/* Comment Input */}
              {showCommentInput[post.id] && (
                <div style={{ 
                  marginTop: '15px', 
                  paddingTop: '15px',
                  borderTop: '1px solid #ECF0F1'
                }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                    <textarea
                      value={commentInputs[post.id] || ''}
                      onChange={(e) => handleCommentChange(post.id, e.target.value)}
                      placeholder="Write a comment..."
                      style={{
                        flex: 1,
                        minHeight: '60px',
                        padding: '8px 12px',
                        border: '1px solid #BDC3C7',
                        borderRadius: '5px',
                        fontSize: '12px',
                        fontFamily: 'Arial, sans-serif',
                        resize: 'vertical',
                        outline: 'none'
                      }}
                    />
                    <button
                      onClick={() => handleCommentSubmit(post.id)}
                      style={{
                        padding: '8px 15px',
                        backgroundColor: '#3498DB',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Post Comment
                    </button>
                  </div>
                </div>
              )}

              {/* Comments */}
              {post.comments.length > 0 && (
                <div style={{ marginTop: '15px', paddingLeft: '20px' }}>
                  {post.comments.map((comment, index) => (
                    <div key={index} style={{
                      backgroundColor: '#F8F9F9',
                      padding: '8px 12px',
                      borderRadius: '5px',
                      marginBottom: '8px'
                    }}>
                      <strong style={{ fontSize: '12px', color: '#2C3E50' }}>
                        {comment.author}
                      </strong>
                      <div style={{ fontSize: '12px', color: '#7F8C8D', marginTop: '2px' }}>
                        {comment.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
        )}
      </div>
    </div>
  );
}
