import React, { useState } from "react";
import Discussion from "./forum-tabs/Discussion";
import Media from "./forum-tabs/Media";
import Files from "./forum-tabs/Files";
import Members from "./forum-tabs/Members";
import About from "./forum-tabs/About";

export default function ForumTabs({ forumData }) {
  const [activeTab, setActiveTab] = useState('Discussion');
  
  // Default forum data if none provided
  const defaultForum = {
    id: 1,
    name: "Project Alpha Discussion",
    picture: "https://via.placeholder.com/800x200/3498DB/FFFFFF?text=Forum+Banner",
    description: "Main discussion forum for Project Alpha development, updates, and team collaboration"
  };
  
  const currentForum = forumData || defaultForum;

  const tabs = ['Discussion', 'Media', 'Files', 'Members', 'About'];

  const tabStyle = {
    padding: '12px 20px',
    margin: '0 2px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    borderRadius: '8px 8px 0 0',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.3s ease',
    color: '#7F8C8D'
  };

  const activeTabStyle = {
    ...tabStyle,
    backgroundColor: '#3498DB',
    color: 'white',
    fontWeight: '600'
  };

  const hoverTabStyle = {
    backgroundColor: '#ECF0F1',
    color: '#2C3E50'
  };

  const renderTabContent = () => {
    switch(activeTab) {
      case 'Discussion':
        return <Discussion forumData={currentForum} />;
      case 'Media':
        return <Media />;
      case 'Files':
        return <Files />;
      case 'Members':
        return <Members />;
      case 'About':
        return <About />;
      default:
        return <Discussion forumData={currentForum} />;
    }
  };

  return (
    <div style={{ 
      background: '#F8F9F9', 
      borderRadius: '10px', 
      overflow: 'hidden',
      height: '100%',
      minHeight: '600px'
    }}>
      {/* Forum Banner */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '200px',
        borderRadius: '10px 10px 0 0',
        overflow: 'hidden',
        backgroundImage: `url(${currentForum.picture})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}>
        {/* Overlay for better text readability */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
          padding: '20px',
          color: 'white'
        }}>
          <h1 style={{ margin: '0 0 5px 0', fontSize: '24px', fontWeight: 'bold' }}>
            {currentForum.name}
          </h1>
          <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>
            {currentForum.description}
          </p>
        </div>
      </div>

      {/* Tab Headers */}
      <div style={{ 
        display: 'flex', 
        backgroundColor: '#FFFFFF',
        borderBottom: '2px solid #ECF0F1',
        padding: '0 15px'
      }}>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={activeTab === tab ? activeTabStyle : tabStyle}
            onMouseEnter={(e) => {
              if (activeTab !== tab) {
                Object.assign(e.target.style, hoverTabStyle);
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab) {
                Object.assign(e.target.style, tabStyle);
              }
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ padding: '20px', height: 'calc(100% - 260px)', overflow: 'auto' }}>
        {renderTabContent()}
      </div>
    </div>
  );
}
