import React, { useState } from "react";
import Discussion from "./forum-tabs/Discussion";
import Media from "./forum-tabs/Media";
import Files from "./forum-tabs/Files";
import Members from "./forum-tabs/Members";
import About from "./forum-tabs/About";

export default function ForumTabs() {
  const [activeTab, setActiveTab] = useState('Discussion');

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
        return <Discussion />;
      case 'Media':
        return <Media />;
      case 'Files':
        return <Files />;
      case 'Members':
        return <Members />;
      case 'About':
        return <About />;
      default:
        return <Discussion />;
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
      <div style={{ padding: '20px', height: 'calc(100% - 60px)', overflow: 'auto' }}>
        {renderTabContent()}
      </div>
    </div>
  );
}
