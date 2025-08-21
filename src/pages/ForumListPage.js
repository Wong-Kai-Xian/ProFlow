import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import ForumList from "../components/ForumList";
import CreateForumModal from "../components/forum-component/CreateForumModal";
import { COLORS, BUTTON_STYLES } from "../components/profile-component/constants";

export default function ForumListPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingForum, setEditingForum] = useState(null);
  const [forums, setForums] = useState([]);
  const navigate = useNavigate();

  const handleForumSelect = (forum) => {
    console.log("Selected forum:", forum);
    navigate(`/forum/${forum.id}`);
  };

  const handleCreateForum = (newForum) => {
    const forumWithId = {
      ...newForum,
      id: Date.now() // Simple ID generation
    };
    setForums([...forums, forumWithId]);
    setShowCreateModal(false);
  };

  const handleEditForum = (forum) => {
    setEditingForum(forum);
    setShowCreateModal(true);
  };

  const handleUpdateForum = (updatedForum) => {
    setForums(forums.map(f => 
      f.id === editingForum.id 
        ? { ...editingForum, ...updatedForum }
        : f
    ));
    setEditingForum(null);
    setShowCreateModal(false);
  };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", minHeight: "100vh", backgroundColor: COLORS.background }}>
      <TopBar />
      
      <div style={{ padding: "30px" }}>
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          marginBottom: "30px" 
        }}>
          <h1 style={{ 
            margin: 0, 
            color: COLORS.dark, 
            fontSize: "28px", 
            fontWeight: "700" 
          }}>
            Community
          </h1>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              ...BUTTON_STYLES.primary,
              padding: "12px 24px",
              fontSize: "16px",
              fontWeight: "600",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(52, 152, 219, 0.3)",
              transition: "all 0.3s ease"
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = "0 6px 16px rgba(52, 152, 219, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "0 4px 12px rgba(52, 152, 219, 0.3)";
            }}
          >
            Create Forum
          </button>
        </div>
        
        {/* Full-width Forum List */}
        <ForumList 
          onForumSelect={handleForumSelect} 
          onEditForum={handleEditForum}
          customForums={forums}
        />
      </div>

      {/* Create/Edit Forum Modal */}
      <CreateForumModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingForum(null);
        }}
        onConfirm={editingForum ? handleUpdateForum : handleCreateForum}
        editingForum={editingForum}
      />
    </div>
  );
}
