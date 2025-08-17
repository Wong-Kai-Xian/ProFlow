import React, { useEffect, useState } from "react";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call with mock data
    setTimeout(() => {
      setData({
        totalProjects: 12,
        activeProjects: 8,
        completedProjects: 4,
        totalClients: 15,
        revenue: "$45,000",
        pendingTasks: 23
      });
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <div style={{ 
      background: '#ECF0F1', 
      padding: '20px', 
      borderRadius: '10px', 
      height: '100%',
      minHeight: '400px'
    }}>
      <h2 style={{ marginTop: 0, color: '#2C3E50' }}>Company Dashboard</h2>
      {loading ? (
        <p>Loading dashboard data...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
          <div style={{ background: 'white', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#3498DB' }}>Total Projects</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{data.totalProjects}</p>
          </div>
          <div style={{ background: 'white', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#27AE60' }}>Active Projects</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{data.activeProjects}</p>
          </div>
          <div style={{ background: 'white', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#E74C3C' }}>Total Clients</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{data.totalClients}</p>
          </div>
          <div style={{ background: 'white', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#F39C12' }}>Revenue</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{data.revenue}</p>
          </div>
        </div>
      )}
    </div>
  );
}