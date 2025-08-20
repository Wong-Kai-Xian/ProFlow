import React, { useEffect, useState } from "react";
import Card from "./profile-component/Card"; // Corrected import path
import { COLORS, LAYOUT } from "./profile-component/constants"; // Import COLORS and LAYOUT
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'; // Import Recharts components

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
        pendingTasks: 23,
        projectCompletionData: [ // Added data for chart
          { name: 'Total', value: 12, fill: COLORS.primary },
          { name: 'Active', value: 8, fill: COLORS.success },
          { name: 'Completed', value: 4, fill: COLORS.secondary },
        ]
      });
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <Card style={{ minHeight: '400px' }}> {/* Use Card component */}
      <h2 style={{ marginTop: 0, color: COLORS.text }}>Company Dashboard</h2>
      {loading ? (
        <p style={{ color: COLORS.lightText }}>Loading dashboard data...</p>
      ) : (
        <>
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
    </Card>
  );
}