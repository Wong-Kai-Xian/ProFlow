import React, { useEffect, useState } from "react";
import Card from "./profile-component/Card"; // Corrected import path
import { COLORS, LAYOUT, BUTTON_STYLES } from "./profile-component/constants"; // Import COLORS, LAYOUT and BUTTON_STYLES
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'; // Import Recharts components

// Define a simple Widget component for demonstration
const Widget = ({ children, onRemove, isEditing }) => (
  <div style={{
    position: "relative",
    background: COLORS.cardBackground,
    padding: LAYOUT.gap,
    borderRadius: LAYOUT.borderRadius,
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
    marginBottom: LAYOUT.gap, // Add some margin bottom for spacing
    border: isEditing ? `2px dashed ${COLORS.primary}` : "none",
    transition: "border 0.2s ease-in-out"
  }}>
    {isEditing && (
      <button
        onClick={onRemove}
        style={{
          position: "absolute",
          top: LAYOUT.smallGap,
          right: LAYOUT.smallGap,
          ...BUTTON_STYLES.danger,
          padding: "4px 8px",
          fontSize: "10px",
          zIndex: 10
        }}
      >
        Remove
      </button>
    )}
    {children}
  </div>
);

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [dashboardWidgets, setDashboardWidgets] = useState([]); // New state for managing widgets

  useEffect(() => {
    // Simulate API call with mock data
    setTimeout(() => {
      setData({
        totalProjects: 12,
        activeProjects: 8,
        completedProjects: 4,
        totalClients: 15,
        revenue: "$45,000",
        pendingTasks: 23,
        projectCompletionData: [
          { name: 'Total', value: 12, fill: COLORS.primary },
          { name: 'Active', value: 8, fill: COLORS.success },
          { name: 'Completed', value: 4, fill: COLORS.secondary },
        ]
      });
      // Initialize widgets
      setDashboardWidgets([
        { id: 'metrics-1', type: 'metrics' },
        { id: 'projectChart-1', type: 'projectChart' },
        { id: 'text-1', type: 'textWidget', content: 'Welcome to your customizable dashboard!' },
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const handleAddWidget = (type) => {
    const newWidget = {
      id: `${type}-${Date.now()}`,
      type: type,
      // Add default content/data based on type if needed
      ...(type === 'textWidget' && { content: 'New Text Widget' })
    };
    setDashboardWidgets([...dashboardWidgets, newWidget]);
  };

  const handleRemoveWidget = (id) => {
    setDashboardWidgets(dashboardWidgets.filter(widget => widget.id !== id));
  };

  return (
    <Card style={{
      maxHeight: "600px", // Set a maximum height for the dashboard card
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: LAYOUT.smallGap }}>
        <h2 style={{ margin: 0, color: COLORS.text }}>Company Dashboard</h2>
        <button 
          onClick={() => setEditMode(!editMode)}
          style={{ ...BUTTON_STYLES.secondary, padding: "4px 8px", fontSize: "12px" }}
        >
          {editMode ? "Done Editing" : "Edit Dashboard"}
        </button>
      </div>
      {loading ? (
        <p style={{ color: COLORS.lightText }}>Loading dashboard data...</p>
      ) : (
        <>
          {editMode && (
            <div style={{ marginBottom: LAYOUT.gap }}>
              <h3 style={{ color: COLORS.text, marginBottom: LAYOUT.smallGap }}>Add Widget:</h3>
              <div style={{ display: "flex", gap: LAYOUT.smallGap }}>
                <button onClick={() => handleAddWidget('metrics')} style={{ ...BUTTON_STYLES.primary, padding: "4px 8px", fontSize: "10px" }}>Add Metrics</button>
                <button onClick={() => handleAddWidget('projectChart')} style={{ ...BUTTON_STYLES.primary, padding: "4px 8px", fontSize: "10px" }}>Add Chart</button>
                <button onClick={() => handleAddWidget('textWidget')} style={{ ...BUTTON_STYLES.primary, padding: "4px 8px", fontSize: "10px" }}>Add Text</button>
              </div>
            </div>
          )}

          {dashboardWidgets.map(widget => (
            <Widget key={widget.id} onRemove={() => handleRemoveWidget(widget.id)} isEditing={editMode}>
              {widget.type === 'metrics' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: LAYOUT.gap }}>
                  <div style={{ background: COLORS.cardBackground, padding: LAYOUT.gap, borderRadius: LAYOUT.borderRadius, textAlign: 'center', boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                    <h3 style={{ margin: '0 0 ' + LAYOUT.smallGap + ' 0', color: COLORS.primary, fontSize: "16px" }}>Total Projects</h3>
                    <p style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, color: COLORS.text }}>{data.totalProjects}</p>
                  </div>
                  <div style={{ background: COLORS.cardBackground, padding: LAYOUT.gap, borderRadius: LAYOUT.borderRadius, textAlign: 'center', boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                    <h3 style={{ margin: '0 0 ' + LAYOUT.smallGap + ' 0', color: COLORS.success, fontSize: "16px" }}>Active Projects</h3>
                    <p style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, color: COLORS.text }}>{data.activeProjects}</p>
                  </div>
                  <div style={{ background: COLORS.cardBackground, padding: LAYOUT.gap, borderRadius: LAYOUT.borderRadius, textAlign: 'center', boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                    <h3 style={{ margin: '0 0 ' + LAYOUT.smallGap + ' 0', color: COLORS.danger, fontSize: "16px" }}>Total Clients</h3>
                    <p style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, color: COLORS.text }}>{data.totalClients}</p>
                  </div>
                  <div style={{ background: COLORS.cardBackground, padding: LAYOUT.gap, borderRadius: LAYOUT.borderRadius, textAlign: 'center', boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                    <h3 style={{ margin: '0 0 ' + LAYOUT.smallGap + ' 0', color: COLORS.warning, fontSize: "16px" }}>Revenue</h3>
                    <p style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, color: COLORS.text }}>{data.revenue}</p>
                  </div>
                </div>
              )}
              {widget.type === 'projectChart' && (
                <>
                  <h3 style={{ marginTop: LAYOUT.gap, marginBottom: LAYOUT.smallGap, color: COLORS.text }}>Project Status Overview</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.projectCompletionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.lightBorder} />
                      <XAxis dataKey="name" stroke={COLORS.text} />
                      <YAxis stroke={COLORS.text} />
                      <Tooltip cursor={{ fill: COLORS.light }} />
                      <Legend />
                      <Bar dataKey="value" />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
              {widget.type === 'textWidget' && (
                <div style={{ padding: LAYOUT.smallGap }}>
                  <p style={{ color: COLORS.text, fontSize: "14px" }}>{widget.content}</p>
                </div>
              )}
            </Widget>
          ))}
        </>
      )}
    </Card>
  );
}