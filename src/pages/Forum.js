import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import TopBar from "../components/TopBar";
import ForumTabs from "../components/ForumTabs";
import ProjectDetails from "../components/project-component/ProjectDetails";
import ForumReminders from "../components/forum-tabs/ForumReminders";
import TrendingPosts from "../components/forum-tabs/TrendingPosts";
import ActiveUsers from "../components/forum-tabs/ActiveUsers";
import FloatingCreateButton from "../components/forum-tabs/FloatingCreateButton";
import CreatePostModal from "../components/forum-tabs/CreatePostModal";

export default function Forum() {
  const { id } = useParams();
  const [forumData, setForumData] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [posts, setPosts] = useState([]);
  const [projectDetails, setProjectDetails] = useState(null);

  useEffect(() => {
    // Mock forum data - in real app this would come from backend based on ID
    const forums = [
      {
        id: 1,
        name: "Project Alpha Discussion",
        picture: "https://via.placeholder.com/800x200/3498DB/FFFFFF?text=Alpha",
        memberCount: 24,
        description: "Main discussion forum for Project Alpha development and updates"
      },
      {
        id: 2,
        name: "Client Feedback Hub",
        picture: "https://via.placeholder.com/800x200/E74C3C/FFFFFF?text=Feedback",
        memberCount: 18,
        description: "Centralized location for client feedback and responses"
      },
      {
        id: 3,
        name: "Team Updates",
        picture: "https://via.placeholder.com/800x200/27AE60/FFFFFF?text=Updates",
        memberCount: 32,
        description: "Daily standups, announcements, and team coordination"
      },
      {
        id: 4,
        name: "Technical Support",
        picture: "https://via.placeholder.com/800x200/F39C12/FFFFFF?text=Support",
        memberCount: 15,
        description: "Technical issues, bug reports, and troubleshooting"
      },
      {
        id: 5,
        name: "Design Reviews",
        picture: "https://via.placeholder.com/800x200/9B59B6/FFFFFF?text=Design",
        memberCount: 12,
        description: "UI/UX discussions, design feedback, and creative reviews"
      },
      {
        id: 6,
        name: "Marketing Strategy",
        picture: "https://via.placeholder.com/800x200/E67E22/FFFFFF?text=Marketing",
        memberCount: 8,
        description: "Marketing campaigns, social media, and promotional activities"
      }
    ];
    
    const forum = forums.find(f => f.id === parseInt(id)) || forums[0];
    setForumData(forum);
    
    // Mock project details for the forum
    setProjectDetails({
      name: forum.name,
      companyInfo: { 
        name: "Tech Solutions Inc", 
        industry: "Software Development", 
        contact: "john.doe@techsolutions.com" 
      },
      description: forum.description
    });
  }, [id]);

  const handlePostSubmit = (newPost) => {
    const postWithId = {
      ...newPost,
      id: posts.length + 1,
    };
    setPosts([postWithId, ...posts]);
  };

  const handleTrendingPostClick = (post) => {
    console.log("Navigate to trending post:", post);
  };
  return (
    <div style={{ fontFamily: 'Arial, sans-serif' }}>
      <TopBar />
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 2fr 1fr",
        gridTemplateRows: "auto 1fr",
        gap: "20px",
        padding: "10px",
        minHeight: "90vh"
      }}>
        {/* Left column: Project Details + Reminders + Trending Posts */}
        <div style={{ gridColumn: 1, gridRow: "1 / span 2", display: "flex", flexDirection: "column", gap: "8px", overflowY: "auto" }}>
          {projectDetails && (
            <ProjectDetails 
              project={projectDetails} 
              onSave={(updatedProject) => setProjectDetails(updatedProject)}
            />
          )}
          <ForumReminders />
          <TrendingPosts onPostClick={handleTrendingPostClick} />
        </div>

        {/* Middle Column - Tabbed Content (Posts Focus) */}
        <div style={{ gridColumn: 2, gridRow: "1 / span 2" }}>
          <ForumTabs forumData={forumData} />
        </div>

        {/* Right column: Online Members */}
        <div style={{ gridColumn: 3, gridRow: "1 / span 2", display: "flex", flexDirection: "column", gap: "8px", overflowY: "auto" }}>
          <ActiveUsers />
        </div>
      </div>

      {/* Floating Create Button */}
      <FloatingCreateButton onClick={() => setShowCreateModal(true)} />

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handlePostSubmit}
      />
    </div>
  );
}
