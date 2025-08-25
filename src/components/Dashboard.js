import React, { useEffect, useState } from "react";
import Card from "./profile-component/Card"; // Corrected import path
import { COLORS, LAYOUT, BUTTON_STYLES } from "./profile-component/constants"; // Import COLORS, LAYOUT and BUTTON_STYLES
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'; // Import Recharts components
import { useAuth } from '../contexts/AuthContext'; // Import useAuth
import { db } from '../firebase'; // Import db
import { collection, query, where, getDocs } from 'firebase/firestore'; // Import Firestore functions

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

export default function Dashboard({ scope = 'private' }) {
  const [data, setData] = useState({
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    totalClients: 0,
    revenue: "$0",
    pendingTasks: 0,
    projectCompletionData: [
      { name: 'Total', value: 0, fill: COLORS.primary },
      { name: 'Active', value: 0, fill: COLORS.success },
      { name: 'Completed', value: 0, fill: COLORS.secondary },
    ]
  }); // Initialize with empty data
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [dashboardWidgets, setDashboardWidgets] = useState([]); // New state for managing widgets
  const { currentUser } = useAuth(); // Get currentUser from AuthContext
  const isPrivate = scope === 'private';
  const canEdit = !!currentUser;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch projects data (private: current user; public: all)
        let projectsSnapshot;
        if (isPrivate) {
          if (!currentUser) {
            setData({
              totalProjects: 0,
              activeProjects: 0,
              completedProjects: 0,
              totalClients: 0,
              revenue: "$0",
              pendingTasks: 0,
              projectCompletionData: [
                { name: 'Total', value: 0, fill: COLORS.primary },
                { name: 'Active', value: 0, fill: COLORS.success },
                { name: 'Completed', value: 0, fill: COLORS.secondary },
              ]
            });
            setDashboardWidgets([]);
            setLoading(false);
            return;
          }
          const projectsQuery = query(collection(db, 'projects'), where('userId', '==', currentUser.uid));
          projectsSnapshot = await getDocs(projectsQuery);
        } else {
          projectsSnapshot = await getDocs(collection(db, 'projects'));
        }
        const projects = projectsSnapshot.docs.map(doc => doc.data());

        const totalProjects = projects.length;
        const activeProjects = projects.filter(p => p.status === 'Active' || p.status === 'Working').length;
        const completedProjects = projects.filter(p => p.status === 'Completed' || p.status === 'Converted').length;

        // Fetch clients data (private: current user; public: all)
        let totalClients = 0;
        if (isPrivate) {
          const clientsQuery = query(collection(db, 'customerProfiles'), where('userId', '==', currentUser.uid));
          const clientsSnapshot = await getDocs(clientsQuery);
          totalClients = clientsSnapshot.docs.length;
        } else {
          const clientsSnapshot = await getDocs(collection(db, 'customerProfiles'));
          totalClients = clientsSnapshot.docs.length;
        }

        // For now, revenue and pending tasks are mock data or need more complex aggregation
        // You would expand this logic to calculate actual revenue and pending tasks from your project/task data
        const revenue = "$0"; // Placeholder
        const pendingTasks = 0; // Placeholder

        setData({
          totalProjects,
          activeProjects,
          completedProjects,
          totalClients,
          revenue,
          pendingTasks,
          projectCompletionData: [
            { name: 'Total', value: totalProjects, fill: COLORS.primary },
            { name: 'Active', value: activeProjects, fill: COLORS.success },
            { name: 'Completed', value: completedProjects, fill: COLORS.secondary },
          ]
        });

        // Initialize widgets if they are empty for a new user, or if existing widgets need data updates
        if (dashboardWidgets.length === 0) {
          setDashboardWidgets([
            { id: 'metrics-1', type: 'metrics' },
            { id: 'projectChart-1', type: 'projectChart' },
            { id: 'text-1', type: 'textWidget', content: 'Welcome to your customizable dashboard!' },
          ]);
        }
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        // Optionally set an error state here
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser, isPrivate]); // Re-run when currentUser or scope changes

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

  if (loading) {
    return <p style={{ color: COLORS.lightText, textAlign: 'center', padding: '20px' }}>Loading dashboard data...</p>;
  }

  // Removed the conditional rendering based on currentUser here

  return (
    <Card style={{
      height: "93%",
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: LAYOUT.smallGap }}>
        <h2 style={{ margin: 0, color: COLORS.text, fontSize: "18px" }}>Company Dashboard</h2>
        {canEdit && (
          <button 
            onClick={() => setEditMode(!editMode)}
            style={{ ...BUTTON_STYLES.secondary, padding: "4px 8px", fontSize: "12px" }}
          >
            {editMode ? "Done Editing" : "Edit Dashboard"}
          </button>
        )}
      </div>
      {(isPrivate ? !!currentUser : true) ? (
        <>
          {canEdit && editMode && (
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
            <Widget key={widget.id} onRemove={() => handleRemoveWidget(widget.id)} isEditing={canEdit && editMode}>
              {widget.type === 'metrics' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: LAYOUT.smallGap }}>
                  <div style={{ background: COLORS.cardBackground, padding: LAYOUT.gap, borderRadius: LAYOUT.borderRadius, textAlign: 'center', boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                    <h3 style={{ margin: '0 0 ' + LAYOUT.smallGap + ' 0', color: COLORS.primary, fontSize: "12px" }}>Total Projects</h3>
                    <p style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, color: COLORS.text }}>{data.totalProjects}</p>
                  </div>
                  <div style={{ background: COLORS.cardBackground, padding: LAYOUT.gap, borderRadius: LAYOUT.borderRadius, textAlign: 'center', boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                    <h3 style={{ margin: '0 0 ' + LAYOUT.smallGap + ' 0', color: COLORS.success, fontSize: "12px" }}>Active Projects</h3>
                    <p style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, color: COLORS.text }}>{data.activeProjects}</p>
                  </div>
                  <div style={{ background: COLORS.cardBackground, padding: LAYOUT.gap, borderRadius: LAYOUT.borderRadius, textAlign: 'center', boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                    <h3 style={{ margin: '0 0 ' + LAYOUT.smallGap + ' 0', color: COLORS.danger, fontSize: "12px" }}>Total Clients</h3>
                    <p style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, color: COLORS.text }}>{data.totalClients}</p>
                  </div>
                  <div style={{ background: COLORS.cardBackground, padding: LAYOUT.gap, borderRadius: LAYOUT.borderRadius, textAlign: 'center', boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                    <h3 style={{ margin: '0 0 ' + LAYOUT.smallGap + ' 0', color: COLORS.warning, fontSize: "12px" }}>Revenue</h3>
                    <p style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, color: COLORS.text }}>{data.revenue}</p>
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
      ) : (
        <p style={{ color: COLORS.danger, textAlign: 'center', padding: '20px' }}>Please log in to view the dashboard.</p>
      )}
    </Card>
  );
}