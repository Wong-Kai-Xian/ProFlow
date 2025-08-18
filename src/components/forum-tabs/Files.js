import React from "react";

export default function Files() {
  const files = [
    { id: 1, name: 'Project_Requirements.pdf', size: '2.3 MB', uploadedBy: 'John Smith', date: '3 days ago' },
    { id: 2, name: 'Design_Mockups.zip', size: '15.7 MB', uploadedBy: 'Sarah Johnson', date: '1 week ago' },
    { id: 3, name: 'Meeting_Notes.docx', size: '145 KB', uploadedBy: 'Mike Chen', date: '2 weeks ago' },
    { id: 4, name: 'Budget_Proposal.xlsx', size: '890 KB', uploadedBy: 'John Smith', date: '3 weeks ago' }
  ];

  return (
    <div>
      <h3 style={{ marginTop: 0, color: '#2C3E50' }}>Shared Files</h3>
      
      <div>
        {files.map((file) => (
          <div key={file.id} style={{
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
                📄
              </div>
              <div>
                <strong style={{ color: '#2C3E50' }}>{file.name}</strong>
                <div style={{ fontSize: '12px', color: '#7F8C8D' }}>
                  {file.size} • Uploaded by {file.uploadedBy} • {file.date}
                </div>
              </div>
            </div>
            <button style={{
              padding: '8px 15px',
              backgroundColor: '#3498DB',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '12px'
            }}>
              Download
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
