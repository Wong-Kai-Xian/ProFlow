import React, { useState } from 'react';

export default function TrendingPosts({ onPostClick }) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Mock trending posts data
  const trendingPosts = [
    {
      id: 1,
      title: "Project Alpha milestone achieved! 🎉",
      author: "John Smith",
      likes: 24,
      comments: 8,
      timestamp: "2 hours ago"
    },
    {
      id: 2,
      title: "New design system implementation",
      author: "Sarah Johnson",
      likes: 18,
      comments: 12,
      timestamp: "4 hours ago"
    },
    {
      id: 3,
      title: "Client feedback on latest prototype",
      author: "Mike Chen",
      likes: 15,
      comments: 6,
      timestamp: "6 hours ago"
    },
    {
      id: 4,
      title: "Weekly team performance review",
      author: "Alice Wong",
      likes: 12,
      comments: 4,
      timestamp: "1 day ago"
    }
  ];

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
          color: '#2C3E50', 
          fontSize: '16px',
          fontWeight: '600'
        }}>
          🔥 Trending Posts
        </h3>
        <span style={{ 
          color: '#7F8C8D', 
          fontSize: '12px',
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.3s ease'
        }}>
          ▼
        </span>
      </div>

      {isExpanded && (
        <div>
          {trendingPosts.length === 0 ? (
            <p style={{ 
              fontSize: '12px', 
              color: '#7F8C8D', 
              textAlign: 'center',
              fontStyle: 'italic',
              margin: '10px 0'
            }}>
              No trending posts
            </p>
          ) : (
            trendingPosts.map((post, index) => (
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
                  e.target.style.backgroundColor = '#E8F4FD';
                  e.target.style.borderColor = '#3498DB';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#F8F9FA';
                  e.target.style.borderColor = 'transparent';
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px'
                }}>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: '#3498DB',
                    minWidth: '16px'
                  }}>
                    #{index + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontSize: '12px', 
                      fontWeight: '600', 
                      color: '#2C3E50',
                      marginBottom: '3px',
                      lineHeight: '1.3',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {post.title}
                    </div>
                    <div style={{ 
                      fontSize: '10px', 
                      color: '#7F8C8D',
                      marginBottom: '3px'
                    }}>
                      by {post.author} • {post.timestamp}
                    </div>
                    <div style={{
                      display: 'flex',
                      gap: '10px',
                      fontSize: '10px',
                      color: '#95A5A6'
                    }}>
                      <span>👍 {post.likes}</span>
                      <span>💬 {post.comments}</span>
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
