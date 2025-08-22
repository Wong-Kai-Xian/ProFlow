import React, { useState, useEffect } from "react";
import { COLORS } from "../profile-component/constants";
import { db } from "../../firebase";
import { collection, query, onSnapshot, doc } from "firebase/firestore";

export default function About({ forumData }) {
  const [filesSharedCount, setFilesSharedCount] = useState(0);
  const [meetingsScheduledCount, setMeetingsScheduledCount] = useState(0);
  const [actualPostCount, setActualPostCount] = useState(0);

  useEffect(() => {
    if (!forumData?.id) return;

    const postsCollectionRef = collection(doc(db, "forums", forumData.id), "posts");
    const unsubscribe = onSnapshot(postsCollectionRef, (snapshot) => {
      let totalFiles = 0;
      let totalMeetings = 0;
      let totalPosts = snapshot.docs.length; // Count actual posts

      snapshot.docs.forEach(postDoc => {
        const postData = postDoc.data();
        if (postData.files && postData.files.length > 0) {
          totalFiles += postData.files.length;
        }
        if (postData.meeting) {
          totalMeetings += 1;
        }
      });
      
      setActualPostCount(totalPosts);
      setFilesSharedCount(totalFiles);
      setMeetingsScheduledCount(totalMeetings);
    });

    return () => unsubscribe();
  }, [forumData?.id]);

  return (
    <div>
      <h3 style={{ marginTop: 0, color: COLORS.dark, fontSize: "16px", fontWeight: "700" }}>About This Forum</h3>
      
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '10px',
        border: '1px solid #ECF0F1',
        marginBottom: '20px'
      }}>
        <h4 style={{ color: COLORS.dark, marginTop: 0, fontSize: "15px", fontWeight: "600" }}>{forumData?.name || 'N/A'}</h4>
        <p style={{ color: COLORS.lightText, lineHeight: '1.6', fontSize: "15px" }}>
          {forumData?.description || 'No description provided.'}
        </p>
      </div>

      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '10px',
        border: '1px solid #ECF0F1',
        marginBottom: '20px'
      }}>
        <h4 style={{ color: COLORS.dark, marginTop: 0, fontSize: "15px", fontWeight: "600" }}>Forum Statistics</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: COLORS.primary }}>{actualPostCount}</div>
            <div style={{ fontSize: '14px', color: COLORS.lightText }}>Total Posts</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: COLORS.success }}>{forumData?.members?.length || 0}</div>
            <div style={{ fontSize: '14px', color: COLORS.lightText }}>Total Members</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: COLORS.warning }}>{filesSharedCount}</div>
            <div style={{ fontSize: '14px', color: COLORS.lightText }}>Files Shared</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: COLORS.danger }}>{meetingsScheduledCount}</div>
            <div style={{ fontSize: '14px', color: COLORS.lightText }}>Meetings Scheduled</div>
          </div>
        </div>
      </div>

      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '10px',
        border: '1px solid #ECF0F1'
      }}>
        <h4 style={{ color: '#2C3E50', marginTop: 0 }}>Forum Guidelines</h4>
        <ul style={{ color: '#7F8C8D', lineHeight: '1.6' }}>
          <li>Keep discussions relevant to the project</li>
          <li>Be respectful and professional in all interactions</li>
          <li>Use appropriate labels for meetings and file uploads</li>
          <li>Search existing posts before creating new ones</li>
          <li>Use @mentions to notify specific team members</li>
        </ul>
      </div>
    </div>
  );
}
