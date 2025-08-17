import React, { useState, useEffect } from "react";

export default function Discussion() {
  const [postText, setPostText] = useState('');
  const [posts, setPosts] = useState([]);

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

  const handlePostSubmit = () => {
    if (postText.trim()) {
      const newPost = {
        id: posts.length + 1,
        type: 'message',
        author: 'Current User',
        timestamp: 'Just now',
        content: postText,
        likes: 0,
        comments: []
      };
      setPosts([newPost, ...posts]);
      setPostText('');
    }
  };

  const handleLike = (postId) => {
    setPosts(posts.map(post => 
      post.id === postId 
        ? { ...post, likes: post.likes + 1 }
        : post
    ));
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
      {/* Post Creation Section */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '20px', 
        borderRadius: '10px', 
        marginBottom: '20px',
        border: '1px solid #ECF0F1'
      }}>
        <textarea
          value={postText}
          onChange={(e) => setPostText(e.target.value)}
          placeholder="Write a message..."
          style={{
            width: '100%',
            minHeight: '80px',
            padding: '12px',
            border: '1px solid #BDC3C7',
            borderRadius: '8px',
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginTop: '15px' 
        }}>
          <div>
            <button 
              style={actionButtonStyle}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#ECF0F1'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
            >
              📷 Picture
            </button>
            <button 
              style={actionButtonStyle}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#ECF0F1'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
            >
              📎 Attachment
            </button>
            <button 
              style={actionButtonStyle}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#ECF0F1'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
            >
              📅 Schedule Meeting
            </button>
            <button 
              style={actionButtonStyle}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#ECF0F1'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
            >
              📍 Location
            </button>
          </div>
          
          <button
            onClick={handlePostSubmit}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3498DB',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#2980B9'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#3498DB'}
          >
            Post
          </button>
        </div>
      </div>

      {/* Posts List */}
      <div>
        {posts.map((post) => {
          const typeLabel = getPostTypeLabel(post.type);
          
          return (
            <div key={post.id} style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '10px',
              marginBottom: '15px',
              border: '1px solid #ECF0F1'
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
                    color: '#7F8C8D',
                    fontSize: '12px'
                  }}
                >
                  👍 {post.likes} Like{post.likes !== 1 ? 's' : ''}
                </button>
                <button style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#7F8C8D',
                  fontSize: '12px'
                }}>
                  💬 {post.comments.length} Comment{post.comments.length !== 1 ? 's' : ''}
                </button>
              </div>

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
        })}
      </div>
    </div>
  );
}
