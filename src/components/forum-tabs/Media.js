import React from "react";

export default function Media() {
  const mediaItems = [
    { id: 1, type: 'image', title: 'Project Screenshot', url: '#', uploadedBy: 'John Smith', date: '2 days ago' },
    { id: 2, type: 'video', title: 'Demo Video', url: '#', uploadedBy: 'Sarah Johnson', date: '1 week ago' },
    { id: 3, type: 'image', title: 'UI Mockup', url: '#', uploadedBy: 'Mike Chen', date: '2 weeks ago' }
  ];

  return (
    <div>
      <h3 style={{ marginTop: 0, color: '#2C3E50' }}>Media Gallery</h3>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
        gap: '15px' 
      }}>
        {mediaItems.map((item) => (
          <div key={item.id} style={{
            backgroundColor: 'white',
            padding: '15px',
            borderRadius: '10px',
            border: '1px solid #ECF0F1',
            textAlign: 'center'
          }}>
            <div style={{
              height: '120px',
              backgroundColor: '#ECF0F1',
              borderRadius: '5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '10px'
            }}>
              {item.type === 'image' ? '🖼️' : '🎥'}
            </div>
            <strong style={{ color: '#2C3E50', fontSize: '14px' }}>{item.title}</strong>
            <div style={{ fontSize: '12px', color: '#7F8C8D', marginTop: '5px' }}>
              By {item.uploadedBy} • {item.date}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
