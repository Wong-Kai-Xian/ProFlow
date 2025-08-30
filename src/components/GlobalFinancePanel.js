import React, { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { DESIGN_SYSTEM } from '../styles/designSystem';

export default function GlobalFinancePanel() {
  const { currentUser } = useAuth();
  const [projects, setProjects] = useState([]);
  const [totals, setTotals] = useState({ expenses: 0, invoiced: 0, paid: 0 });
  const [byCustomer, setByCustomer] = useState([]);
  const custCacheRef = useRef({}); // { [projectId]: { [customer]: { invoiced, unpaid } } }

  useEffect(() => {
    if (!currentUser?.uid) { setProjects([]); return; }
    const q = query(collection(db, 'projects'), where('userId', '==', currentUser.uid));
    const unsub = onSnapshot(q, async (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setProjects(list);
    });
    return () => unsub();
  }, [currentUser?.uid]);

  useEffect(() => {
    const unsubs = [];
    let totalExpenses = 0;
    let totalInvoiced = 0;
    let totalPaid = 0;
    // reset caches when project list changes
    custCacheRef.current = {};
    for (const p of projects) {
      const cust = p.customerName || p.customer?.name || 'Unassigned';
      const expUnsub = onSnapshot(collection(db, 'projects', p.id, 'expenses'), (s) => {
        const sum = s.docs.reduce((acc, d) => acc + toUsdExpense(d.data()), 0);
        totalExpenses = recomputeTotals('expenses', p.id, sum, totalExpenses);
        setTotals({ expenses: totalExpenses, invoiced: totalInvoiced, paid: totalPaid });
      });
      const invUnsub = onSnapshot(collection(db, 'projects', p.id, 'invoices'), (s) => {
        let sumInv = 0; let sumPaid = 0;
        const perProject = {};
        for (const d of s.docs) {
          const data = d.data();
          const amtUsd = toUsdInvoice(data);
          sumInv += amtUsd;
          if ((data.status || '').toLowerCase() === 'paid') sumPaid += amtUsd;
          const name = data.client || cust;
          const row = perProject[name] || { name, invoiced: 0, unpaid: 0 };
          row.invoiced += amtUsd;
          if ((data.status || '').toLowerCase() !== 'paid') row.unpaid += amtUsd;
          perProject[name] = row;
        }
        totalInvoiced = recomputeTotals('invoiced', p.id, sumInv, totalInvoiced);
        totalPaid = recomputeTotals('paid', p.id, sumPaid, totalPaid);
        setTotals({ expenses: totalExpenses, invoiced: totalInvoiced, paid: totalPaid });
        // update project customer cache and aggregate across projects
        custCacheRef.current[p.id] = perProject;
        const agg = {};
        Object.values(custCacheRef.current).forEach(map => {
          Object.values(map || {}).forEach(row => {
            const r = agg[row.name] || { name: row.name, invoiced: 0, unpaid: 0 };
            r.invoiced += Number(row.invoiced || 0);
            r.unpaid += Number(row.unpaid || 0);
            agg[row.name] = r;
          });
        });
        const rows = Object.values(agg).sort((a,b) => b.unpaid - a.unpaid).slice(0, 5);
        setByCustomer(rows);
      });
      unsubs.push(expUnsub, invUnsub);
    }
    return () => unsubs.forEach(u => { try { u(); } catch {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects.map(p => p.id).join(',')]);

  const net = totals.invoiced - totals.expenses;
  const unpaid = totals.invoiced - totals.paid;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ background: DESIGN_SYSTEM.pageThemes.home.gradient, padding: DESIGN_SYSTEM.spacing.base, color: DESIGN_SYSTEM.colors.text.inverse, borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0` }}>
        <h3 style={{ margin: 0, fontSize: DESIGN_SYSTEM.typography.fontSize.lg, fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold }}>Finance Overview</h3>
        <p style={{ margin: '4px 0 0 0', fontSize: DESIGN_SYSTEM.typography.fontSize.sm, opacity: 0.9 }}>Totals across your projects</p>
      </div>
      <div style={{ padding: DESIGN_SYSTEM.spacing.base, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
        <Metric label="Expenses" value={totals.expenses} color="#ef4444" />
        <Metric label="Invoiced" value={totals.invoiced} color="#3b82f6" />
        <Metric label="Paid" value={totals.paid} color="#10b981" />
        <Metric label="Net" value={net} color={net >= 0 ? '#10b981' : '#ef4444'} />
      </div>
      <div style={{ padding: DESIGN_SYSTEM.spacing.base }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Top customers by unpaid</div>
        {byCustomer.length === 0 ? (
          <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontStyle: 'italic' }}>No data</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px', gap: 8 }}>
            <div style={{ fontSize: 12, color: DESIGN_SYSTEM.colors.text.secondary, fontWeight: 600 }}>Customer</div>
            <div style={{ fontSize: 12, color: DESIGN_SYSTEM.colors.text.secondary, fontWeight: 600 }}>Invoiced</div>
            <div style={{ fontSize: 12, color: DESIGN_SYSTEM.colors.text.secondary, fontWeight: 600 }}>Unpaid</div>
            {byCustomer.map(row => (
              <React.Fragment key={row.name}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.name}>{row.name}</div>
                <div>{row.invoiced.toFixed(2)}</div>
                <div style={{ color: row.unpaid > 0 ? '#b91c1c' : DESIGN_SYSTEM.colors.text.primary }}>{row.unpaid.toFixed(2)}</div>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, color }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
      <div style={{ fontWeight: 700, color }}>{Number(value || 0).toFixed(2)}</div>
    </div>
  );
}

// Keep rolling totals per project id
const cache = { expenses: {}, invoiced: {}, paid: {} };
function recomputeTotals(kind, pid, sum, curTotal) {
  cache[kind][pid] = sum;
  return Object.values(cache[kind]).reduce((a, b) => a + (Number(b) || 0), 0);
}

// USD converters
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
  // Fallbacks: if already USD, or unknown
  if (cur === base) return total;
  return total;
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
  return amount;
}


