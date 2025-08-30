import React, { useEffect, useState } from "react";
import Card from "./profile-component/Card"; // Corrected import path
import { COLORS, LAYOUT, BUTTON_STYLES } from "./profile-component/constants"; // Import COLORS, LAYOUT and BUTTON_STYLES
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'; // Import Recharts components
import { useAuth } from '../contexts/AuthContext'; // Import useAuth
import { db } from '../firebase'; // Import db
import { collection, query, where, getDocs } from 'firebase/firestore'; // Import Firestore functions

// Flexible date parser for YYYY-MM-DD or Firestore Timestamp-like objects
function parseDateFlexible(value) {
  try {
    if (!value) return null;
    if (typeof value === 'string') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }
    if (value?.toDate) {
      const d = value.toDate();
      return d && !isNaN(d.getTime()) ? d : null;
    }
    return null;
  } catch {
    return null;
  }
}

// USD converters using stored base fields and fx metadata
function toUsdInvoice(inv) {
  const base = 'USD';
  const totalBase = Number(inv?.totalBase);
  if (Number.isFinite(totalBase)) return totalBase;
  const cur = String(inv?.currency || base).toUpperCase();
  const fxBase = String(inv?.fxBase || base).toUpperCase();
  const total = Number(inv?.total || 0);
  const rate = Number(inv?.fxRate || 0);
  if (fxBase === base) {
    return cur === base ? total : (rate > 0 ? (total / rate) : total);
  }
  if (cur === base) return total;
  return total; // fallback if legacy record without base/rate
}

function toUsdExpense(exp) {
  const base = 'USD';
  const amountBase = Number(exp?.amountBase);
  if (Number.isFinite(amountBase)) return amountBase;
  const cur = String(exp?.currency || base).toUpperCase();
  const fxBase = String(exp?.fxBase || base).toUpperCase();
  const amount = Number(exp?.amount || 0);
  const rate = Number(exp?.fxRate || 0);
  if (fxBase === base) {
    return cur === base ? amount : (rate > 0 ? (amount / rate) : amount);
  }
  if (cur === base) return amount;
  return amount; // fallback if legacy record without base/rate
}

// Compact X-axis tick for long project names with tooltip
function ProjectNameTick({ x, y, payload }) {
  try {
    const full = String(payload?.value ?? '');
    const short = full.length > 16 ? (full.slice(0, 16) + '…') : full;
    return (
      <g transform={`translate(${x},${y})`}>
        <text dy={14} textAnchor="end" transform="rotate(-35)" fill={COLORS.text} style={{ fontSize: 10 }}>
          {short}
          <title>{full}</title>
        </text>
      </g>
    );
  } catch {
    return null;
  }
}

// Compute a max character length for labels based on item count
function calcLabelMaxChars(count) {
  if (!Number.isFinite(count) || count <= 0) return 12;
  if (count <= 6) return 14;
  if (count <= 8) return 12;
  if (count <= 10) return 10;
  if (count <= 14) return 8;
  return 6;
}

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
          // Merge ownership/team queries similar to FinancePage
          const seen = new Map();
          const queries = [
            query(collection(db, 'projects'), where('userId', '==', currentUser.uid)),
            query(collection(db, 'projects'), where('createdBy', '==', currentUser.uid)),
            query(collection(db, 'projects'), where('team', 'array-contains', currentUser.uid)),
          ];
          for (const q of queries) {
            try {
              const snap = await getDocs(q);
              snap.docs.forEach(d => { if (!seen.has(d.id)) seen.set(d.id, d); });
            } catch {}
          }
          projectsSnapshot = { docs: Array.from(seen.values()) };
        } else {
          projectsSnapshot = await getDocs(collection(db, 'projects'));
        }
        const projects = projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const totalProjects = projects.length;
        const activeProjects = projects.filter(p => p.status === 'Active' || p.status === 'Working').length;
        const completedProjects = projects.filter(p => p.status === 'Completed' || p.status === 'Converted').length;

        // Fetch clients data (private: current user; public: all)
        let totalClients = 0;
        let customersList = [];
        if (isPrivate) {
          const clientsQuery = query(collection(db, 'customerProfiles'), where('userId', '==', currentUser.uid));
          const clientsSnapshot = await getDocs(clientsQuery);
          totalClients = clientsSnapshot.docs.length;
          customersList = clientsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        } else {
          const clientsSnapshot = await getDocs(collection(db, 'customerProfiles'));
          totalClients = clientsSnapshot.docs.length;
          customersList = clientsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        // For now, revenue and pending tasks are mock data or need more complex aggregation
        // You would expand this logic to calculate actual revenue and pending tasks from your project/task data
        const revenue = "$0"; // Placeholder
        const pendingTasks = 0; // Placeholder

        // Aggregate finance subcollections per project
        const invoices = [];
        const expenses = [];
        const quotes = [];
        try {
          await Promise.all(projects.map(async (p) => {
            try {
              const invSnap = await getDocs(collection(db, 'projects', p.id, 'invoices'));
              invSnap.docs.forEach(d => invoices.push({ projectId: p.id, projectName: p.name || p.id, ...d.data() }));
            } catch {}
            try {
              const expSnap = await getDocs(collection(db, 'projects', p.id, 'expenses'));
              expSnap.docs.forEach(d => expenses.push({ projectId: p.id, projectName: p.name || p.id, ...d.data() }));
            } catch {}
            try {
              const quoSnap = await getDocs(collection(db, 'projects', p.id, 'quotes'));
              quoSnap.docs.forEach(d => quotes.push({ projectId: p.id, projectName: p.name || p.id, ...d.data() }));
            } catch {}
          }));
        } catch {}

        // Top customers by revenue (paid invoices) in USD
        const revenueByCustomer = new Map();
        for (const inv of invoices) {
          const status = String(inv.status || 'unpaid').toLowerCase();
          if (status !== 'paid') continue; // count revenue on paid only
          const key = inv.client || 'Unknown';
          const amt = toUsdInvoice(inv);
          revenueByCustomer.set(key, (revenueByCustomer.get(key) || 0) + amt);
        }
        const topCustomers = Array.from(revenueByCustomer.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a,b) => b.value - a.value)
          .slice(0, 5);
        const paidRevenueAll = Array.from(revenueByCustomer.values()).reduce((s, v) => s + Number(v || 0), 0);

        // Quotes/Invoices per month (last 6 months)
        const now = new Date();
        const monthKeys = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
          monthKeys.push(key);
        }
        const monthAgg = {};
        monthKeys.forEach(k => { monthAgg[k] = { month: k, quotes: 0, invoices: 0 }; });
        for (const q of quotes) {
          const d = parseDateFlexible(q.createdAt) || parseDateFlexible(q.validUntil) || now;
          const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
          if (monthAgg[key]) monthAgg[key].quotes += 1;
        }
        for (const inv of invoices) {
          const d = parseDateFlexible(inv.createdAt) || parseDateFlexible(inv.dueDate) || now;
          const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
          if (monthAgg[key]) monthAgg[key].invoices += 1;
        }
        const quotesInvoicesMonthlyData = monthKeys.map(k => monthAgg[k]);

        // Revenue & Cost per project (use totals regardless of status), USD
        const financeByProject = new Map();
        projects.forEach(p => financeByProject.set(p.id, { projectId: p.id, projectName: p.name || p.id, revenue: 0, cost: 0 }));
        invoices.forEach(inv => {
          const rec = financeByProject.get(inv.projectId) || { projectId: inv.projectId, projectName: inv.projectName || inv.projectId, revenue: 0, cost: 0 };
          rec.revenue += toUsdInvoice(inv);
          financeByProject.set(inv.projectId, rec);
        });
        expenses.forEach(exp => {
          const rec = financeByProject.get(exp.projectId) || { projectId: exp.projectId, projectName: exp.projectName || exp.projectId, revenue: 0, cost: 0 };
          rec.cost += toUsdExpense(exp);
          financeByProject.set(exp.projectId, rec);
        });
        const projectFinanceData = Array.from(financeByProject.values()).sort((a,b) => (b.revenue - a.revenue)).slice(0, 6);

        // Ratios (overall)
        const totalRevenueAll = projectFinanceData.reduce((s, r) => s + Number(r.revenue || 0), 0);
        const totalCostAll = projectFinanceData.reduce((s, r) => s + Number(r.cost || 0), 0);
        const revenueCostRatio = totalCostAll > 0 ? (totalRevenueAll / totalCostAll) : (totalRevenueAll > 0 ? Infinity : 0);
        const grossMarginPct = totalRevenueAll > 0 ? ((totalRevenueAll - totalCostAll) / totalRevenueAll) * 100 : 0;

        // New customers this month (best-effort using createdAt or lastContact)
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const newCustomers = [];
        for (const c of customersList) {
          const created = parseDateFlexible(c.createdAt) || parseDateFlexible(c.lastContact);
          if (created && created >= startOfMonth && created < endOfMonth) {
            const name = c.customerProfile?.name || c.companyProfile?.company || c.id;
            newCustomers.push(name);
          }
        }

        setData({
          totalProjects,
          activeProjects,
          completedProjects,
          totalClients,
          revenue: `$${paidRevenueAll.toFixed(2)}`,
          pendingTasks,
          projectCompletionData: [
            { name: 'Total', value: totalProjects, fill: COLORS.primary },
            { name: 'Active', value: activeProjects, fill: COLORS.success },
            { name: 'Completed', value: completedProjects, fill: COLORS.secondary },
          ],
          topCustomers,
          quotesInvoicesMonthlyData,
          projectFinanceData,
          totalRevenueAll,
          totalCostAll,
          revenueCostRatio,
          grossMarginPct,
          newCustomersThisMonth: newCustomers.length,
          newCustomersNames: newCustomers
        });

        // Initialize widgets if they are empty for a new user, or if existing widgets need data updates
        if (dashboardWidgets.length === 0) {
          setDashboardWidgets([
            { id: 'metrics-1', type: 'metrics' },
            { id: 'projectChart-1', type: 'projectChart' },
            { id: 'topCustomers-1', type: 'topCustomers' },
            { id: 'newCustomers-1', type: 'newCustomers' },
            { id: 'quotesInvoicesMonthly-1', type: 'quotesInvoicesMonthly' },
            { id: 'projectFinance-1', type: 'projectFinance' },
            { id: 'keyRatios-1', type: 'keyRatios' },
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
                <button onClick={() => handleAddWidget('topCustomers')} style={{ ...BUTTON_STYLES.primary, padding: "4px 8px", fontSize: "10px" }}>Top Customers</button>
                <button onClick={() => handleAddWidget('newCustomers')} style={{ ...BUTTON_STYLES.primary, padding: "4px 8px", fontSize: "10px" }}>New Customers</button>
                <button onClick={() => handleAddWidget('quotesInvoicesMonthly')} style={{ ...BUTTON_STYLES.primary, padding: "4px 8px", fontSize: "10px" }}>Quotes vs Invoices</button>
                <button onClick={() => handleAddWidget('projectFinance')} style={{ ...BUTTON_STYLES.primary, padding: "4px 8px", fontSize: "10px" }}>Project Finance</button>
                <button onClick={() => handleAddWidget('keyRatios')} style={{ ...BUTTON_STYLES.primary, padding: "4px 8px", fontSize: "10px" }}>Key Ratios</button>
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
              {widget.type === 'topCustomers' && (
                <>
                  <h3 style={{ marginTop: LAYOUT.gap, marginBottom: LAYOUT.smallGap, color: COLORS.text }}>Top Customers by Revenue (Paid)</h3>
                  {(!data.topCustomers || data.topCustomers.length === 0) ? (
                    <p style={{ color: COLORS.lightText, margin: 0 }}>No paid invoices yet.</p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                      {data.topCustomers.map((c, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', background: COLORS.cardBackground, padding: '8px 12px', borderRadius: LAYOUT.borderRadius, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                          <span style={{ color: COLORS.text }}>{idx + 1}. {c.name}</span>
                          <span style={{ color: COLORS.primary, fontWeight: 700 }}>${Number(c.value || 0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              {widget.type === 'newCustomers' && (
                <div style={{ background: COLORS.cardBackground, padding: LAYOUT.gap, borderRadius: LAYOUT.borderRadius }}>
                  <h3 style={{ margin: 0, color: COLORS.text, marginBottom: 6 }}>New Customers This Month</h3>
                  <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.success }}>{Number(data.newCustomersThisMonth || 0)}</div>
                  {Array.isArray(data.newCustomersNames) && data.newCustomersNames.length > 0 && (
                    <p style={{ marginTop: 6, color: COLORS.lightText, fontSize: 12 }}>Recent: {data.newCustomersNames.slice(0,5).join(', ')}{data.newCustomersNames.length > 5 ? '…' : ''}</p>
                  )}
                </div>
              )}
              {widget.type === 'quotesInvoicesMonthly' && (
                <>
                  <h3 style={{ marginTop: LAYOUT.gap, marginBottom: LAYOUT.smallGap, color: COLORS.text }}>Quotes/Invoices per Month</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.quotesInvoicesMonthlyData || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.lightBorder} />
                      <XAxis dataKey="month" stroke={COLORS.text} />
                      <YAxis stroke={COLORS.text} />
                      <Tooltip cursor={{ fill: COLORS.light }} />
                      <Legend />
                      <Bar dataKey="quotes" fill={COLORS.secondary} name="Quotes" />
                      <Bar dataKey="invoices" fill={COLORS.primary} name="Invoices" />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
              {widget.type === 'projectFinance' && (
                <>
                  <h3 style={{ marginTop: LAYOUT.gap, marginBottom: LAYOUT.smallGap, color: COLORS.text }}>Revenue & Cost per Project</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.projectFinanceData || []} margin={{ top: 8, right: 16, bottom: 40, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.lightBorder} />
                      <XAxis
                        dataKey="projectName"
                        stroke={COLORS.text}
                        interval={0}
                        height={50}
                        tick={({ x, y, payload }) => {
                          try {
                            const full = String(payload?.value ?? '');
                            const maxChars = calcLabelMaxChars((data.projectFinanceData || []).length);
                            const short = full.length > maxChars ? (full.slice(0, maxChars) + '…') : full;
                            return (
                              <g transform={`translate(${x},${y})`}>
                                <text dy={14} textAnchor="end" transform="rotate(-35)" fill={COLORS.text} style={{ fontSize: 10 }}>
                                  {short}
                                  <title>{full}</title>
                                </text>
                              </g>
                            );
                          } catch { return null; }
                        }}
                      />
                      <YAxis stroke={COLORS.text} />
                      <Tooltip cursor={{ fill: COLORS.light }} />
                      <Legend />
                      <Bar dataKey="revenue" fill={COLORS.success} name="Revenue" />
                      <Bar dataKey="cost" fill={COLORS.danger} name="Cost" />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
              {widget.type === 'keyRatios' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: LAYOUT.smallGap }}>
                  <div style={{ background: COLORS.cardBackground, padding: LAYOUT.gap, borderRadius: LAYOUT.borderRadius, textAlign: 'center', boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                    <h3 style={{ margin: '0 0 ' + LAYOUT.smallGap + ' 0', color: COLORS.primary, fontSize: "12px" }}>Total Revenue</h3>
                    <p style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: COLORS.text }}>${Number(data.totalRevenueAll || 0).toFixed(2)}</p>
                  </div>
                  <div style={{ background: COLORS.cardBackground, padding: LAYOUT.gap, borderRadius: LAYOUT.borderRadius, textAlign: 'center', boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                    <h3 style={{ margin: '0 0 ' + LAYOUT.smallGap + ' 0', color: COLORS.danger, fontSize: "12px" }}>Total Cost</h3>
                    <p style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: COLORS.text }}>${Number(data.totalCostAll || 0).toFixed(2)}</p>
                  </div>
                  <div style={{ background: COLORS.cardBackground, padding: LAYOUT.gap, borderRadius: LAYOUT.borderRadius, textAlign: 'center', boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                    <h3 style={{ margin: '0 0 ' + LAYOUT.smallGap + ' 0', color: COLORS.success, fontSize: "12px" }}>Revenue/Cost Ratio</h3>
                    <p style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: COLORS.text }}>
                      {data.revenueCostRatio === Infinity ? '∞' : Number(data.revenueCostRatio || 0).toFixed(2)}
                    </p>
                  </div>
                  <div style={{ background: COLORS.cardBackground, padding: LAYOUT.gap, borderRadius: LAYOUT.borderRadius, textAlign: 'center', boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                    <h3 style={{ margin: '0 0 ' + LAYOUT.smallGap + ' 0', color: COLORS.secondary, fontSize: "12px" }}>Gross Margin %</h3>
                    <p style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: COLORS.text }}>
                      {Number(data.grossMarginPct || 0).toFixed(1)}%
                    </p>
                  </div>
                </div>
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