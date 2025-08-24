import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, addDoc, updateDoc, doc, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import { DESIGN_SYSTEM, getPageContainerStyle, getContentContainerStyle } from '../styles/designSystem';

export default function FinancePage() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [activeTab, setActiveTab] = useState('invoices'); // invoices | expenses | quotes | customers | insights
  const [invoiceFilter, setInvoiceFilter] = useState({ status: 'all', customer: 'all' });
  const [expensesRows, setExpensesRows] = useState([]);
  const [invoiceRows, setInvoiceRows] = useState([]);
  const [quoteRows, setQuoteRows] = useState([]);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showEmailTpl, setShowEmailTpl] = useState(false);
  const [emailTpl, setEmailTpl] = useState({ subject: 'Invoice from ProFlow - {client}', body: 'Dear {client},\n\nPlease find the invoice for {project} due on {dueDate}.\nTotal: {total}\n\nBest regards,\nProFlow' });
  const [statementCustomer, setStatementCustomer] = useState(null);
  const [editInvoice, setEditInvoice] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showFinanceDefaults, setShowFinanceDefaults] = useState(false);
  const [financeDefaults, setFinanceDefaults] = useState({ taxRate: 0, discount: 0, recipients: '' });

  useEffect(() => {
    if (!currentUser?.uid) { setProjects([]); return; }
    const q = query(collection(db, 'projects'), where('userId', '==', currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [currentUser?.uid]);

  useEffect(() => {
    const loadTpl = async () => {
      try {
        if (!currentUser?.uid) return;
        const ref = doc(db, 'users', currentUser.uid, 'settings', 'financeEmail');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data();
          setEmailTpl({
            subject: d.subject || 'Invoice from ProFlow - {client}',
            body: d.body || 'Dear {client},\n\nPlease find the invoice for {project} due on {dueDate}.\nTotal: {total}\n\nBest regards,\nProFlow'
          });
        }
      } catch {}
    };
    loadTpl();
  }, [currentUser?.uid]);

  useEffect(() => {
    const loadDefaults = async () => {
      try {
        if (!currentUser?.uid) return;
        const ref = doc(db, 'users', currentUser.uid, 'settings', 'financeDefaults');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data();
          setFinanceDefaults({ taxRate: Number(d.taxRate||0), discount: Number(d.discount||0), recipients: d.recipients || '' });
        }
      } catch {}
    };
    loadDefaults();
  }, [currentUser?.uid]);

  useEffect(() => {
    const unsubs = [];
    const expBundle = [];
    const invBundle = [];
    const quoBundle = [];
    for (const p of projects) {
      const unsubExp = onSnapshot(collection(db, 'projects', p.id, 'expenses'), (s) => {
        const list = s.docs.map(d => ({ type: 'expense', projectId: p.id, projectName: p.name || p.id, date: d.data().date || '', category: d.data().category || '', amount: Number(d.data().amount || 0), note: d.data().note || '' }));
        // replace for project
        for (let i = expBundle.length - 1; i >= 0; i--) if (expBundle[i].projectId === p.id) expBundle.splice(i, 1);
        expBundle.push(...list);
        setExpensesRows([...expBundle]);
      });
      const unsubInv = onSnapshot(collection(db, 'projects', p.id, 'invoices'), (s) => {
        const list = s.docs.map(d => ({ id: d.id, type: 'invoice', projectId: p.id, projectName: p.name || p.id, client: d.data().client || '', dueDate: d.data().dueDate || '', status: d.data().status || 'unpaid', total: Number(d.data().total || 0) }));
        for (let i = invBundle.length - 1; i >= 0; i--) if (invBundle[i].projectId === p.id) invBundle.splice(i, 1);
        invBundle.push(...list);
        setInvoiceRows([...invBundle]);
      });
      const unsubQuo = onSnapshot(collection(db, 'projects', p.id, 'quotes'), (s) => {
        const list = s.docs.map(d => ({ id: d.id, type: 'quote', projectId: p.id, projectName: p.name || p.id, client: d.data().client || '', validUntil: d.data().validUntil || '', status: d.data().status || 'draft', total: Number(d.data().total || 0) }));
        for (let i = quoBundle.length - 1; i >= 0; i--) if (quoBundle[i].projectId === p.id) quoBundle.splice(i, 1);
        quoBundle.push(...list);
        setQuoteRows([...quoBundle]);
      });
      unsubs.push(unsubExp, unsubInv, unsubQuo);
    }
    return () => unsubs.forEach(u => { try { u(); } catch {} });
  }, [projects.map(p => p.id).join(',')]);

  // tab sync with URL
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const t = sp.get('tab');
    if (t && ['invoices','expenses','quotes','insights'].includes(t)) setActiveTab(t);
    const cust = sp.get('customer');
    if (cust) setInvoiceFilter(f => ({ ...f, customer: cust }));
  }, [location.search]);

  const setTab = (t) => {
    const sp = new URLSearchParams(location.search);
    sp.set('tab', t);
    navigate(`/finance?${sp.toString()}`, { replace: true });
    setActiveTab(t);
  };

  const customers = useMemo(() => {
    const set = new Set(['all']);
    invoiceRows.forEach(r => set.add(r.client || 'Unassigned'));
    return Array.from(set);
  }, [invoiceRows]);

  const customersRollup = useMemo(() => {
    const map = {};
    for (const r of invoiceRows) {
      const name = r.client || 'Unassigned';
      const m = map[name] || { name, invoiced: 0, paid: 0, unpaid: 0, count: 0, lastDue: '' };
      m.invoiced += Number(r.total || 0);
      m.count += 1;
      if (r.status === 'paid') m.paid += Number(r.total || 0); else m.unpaid += Number(r.total || 0);
      if (r.dueDate && (!m.lastDue || r.dueDate > m.lastDue)) m.lastDue = r.dueDate;
      map[name] = m;
    }
    return Object.values(map).sort((a,b) => b.unpaid - a.unpaid);
  }, [invoiceRows]);

  const filteredInvoices = invoiceRows.filter(r => {
    if (invoiceFilter.status !== 'all' && r.status !== invoiceFilter.status) return false;
    if (invoiceFilter.customer !== 'all' && (r.client || 'Unassigned') !== invoiceFilter.customer) return false;
    return true;
  });
  const invTotal = filteredInvoices.reduce((a,b) => a + (b.total||0), 0);
  const invUnpaid = filteredInvoices.filter(r => r.status !== 'paid').reduce((a,b) => a + (b.total||0), 0);
  const expTotal = expensesRows.reduce((a,b) => a + (b.amount||0), 0);

  const convertQuoteToInvoice = async (q) => {
    try {
      if (!q?.projectId) return;
      await addDoc(collection(db, 'projects', q.projectId, 'invoices'), {
        client: q.client || '',
        dueDate: q.validUntil || '',
        total: q.total || 0,
        status: 'unpaid',
        createdAt: serverTimestamp()
      });
      // Optionally update quote status
      await updateDoc(doc(db, 'projects', q.projectId, 'quotes', q.id), { status: 'converted', convertedAt: serverTimestamp() });
      setActiveTab('invoices');
    } catch {}
  };

  const [newQuote, setNewQuote] = useState({ projectId: '', client: '', total: '', validUntil: '' });
  const saveNewQuote = async () => {
    try {
      if (!newQuote.projectId || !newQuote.client || !newQuote.total) return;
      await addDoc(collection(db, 'projects', newQuote.projectId, 'quotes'), {
        client: newQuote.client,
        total: Number(newQuote.total || 0),
        validUntil: newQuote.validUntil || '',
        status: 'draft',
        createdAt: serverTimestamp()
      });
      setShowQuoteModal(false);
      setNewQuote({ projectId: '', client: '', total: '', validUntil: '' });
    } catch {}
  };

  const printInvoice = (inv) => {
    try {
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice - ${inv.client || ''}</title><style>
        body{font-family:Arial,sans-serif;color:#111827;margin:24px}
        .head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
        .brand{font-weight:700;font-size:20px}
        .muted{color:#6b7280;font-size:12px}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        th,td{border:1px solid #e5e7eb;padding:8px;text-align:left}
        .total{font-weight:700}
      </style></head><body>
        <div class="head">
          <div>
            <div class="brand">ProFlow</div>
            <div class="muted">Invoice</div>
          </div>
          <div class="muted">
            <div>Project: ${inv.projectName || ''}</div>
            <div>Client: ${inv.client || ''}</div>
            <div>Due: ${inv.dueDate || '-'}</div>
            <div>Status: ${inv.status || 'unpaid'}</div>
          </div>
        </div>
        <table>
          <thead><tr><th>Description</th><th style="width:140px">Amount</th></tr></thead>
          <tbody>
            <tr><td>Invoice Total</td><td>${Number(inv.total||0).toFixed(2)}</td></tr>
            <tr><td class="total">Total</td><td class="total">${Number(inv.total||0).toFixed(2)}</td></tr>
          </tbody>
        </table>
      </body></html>`;
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    } catch {}
  };

  const printQuote = (q) => {
    try {
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Quote - ${q.client || ''}</title><style>
        body{font-family:Arial,sans-serif;color:#111827;margin:24px}
        .head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
        .brand{font-weight:700;font-size:20px}
        .muted{color:#6b7280;font-size:12px}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        th,td{border:1px solid #e5e7eb;padding:8px;text-align:left}
        .total{font-weight:700}
      </style></head><body>
        <div class="head">
          <div>
            <div class="brand">ProFlow</div>
            <div class="muted">Quote</div>
          </div>
          <div class="muted">
            <div>Project: ${q.projectName || ''}</div>
            <div>Client: ${q.client || ''}</div>
            <div>Valid Until: ${q.validUntil || '-'}</div>
            <div>Status: ${q.status || 'draft'}</div>
          </div>
        </div>
        <table>
          <thead><tr><th>Description</th><th style="width:140px">Amount</th></tr></thead>
          <tbody>
            <tr><td>Quoted Total</td><td>${Number(q.total||0).toFixed(2)}</td></tr>
            <tr><td class="total">Total</td><td class="total">${Number(q.total||0).toFixed(2)}</td></tr>
          </tbody>
        </table>
      </body></html>`;
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    } catch {}
  };

  const updateInvoiceStatus = async (inv, newStatus) => {
    try {
      if (!inv?.projectId || !inv?.id) return;
      await updateDoc(doc(db, 'projects', inv.projectId, 'invoices', inv.id), { status: newStatus });
    } catch {}
  };

  const sendInvoiceEmail = async (inv) => {
    try {
      const vars = {
        '{client}': inv.client || '',
        '{project}': inv.projectName || '',
        '{dueDate}': inv.dueDate || '-',
        '{total}': Number(inv.total||0).toFixed(2),
        '{status}': inv.status || 'unpaid'
      };
      const subj = Object.entries(vars).reduce((s,[k,v]) => s.replaceAll(k, v), emailTpl.subject || 'Invoice from ProFlow - {client}');
      const bodyTxt = Object.entries(vars).reduce((s,[k,v]) => s.replaceAll(k, v), emailTpl.body || '');
      const subject = encodeURIComponent(subj);
      const body = encodeURIComponent(bodyTxt);
      const toRaw = (financeDefaults?.recipients || '').trim();
      const to = toRaw.split(',').map(s => s.trim()).filter(Boolean).join(',');
      const mailtoBase = to ? `mailto:${to}` : 'mailto:';
      window.location.href = `${mailtoBase}?subject=${subject}&body=${body}`;
      // Optionally note send time
      if (inv?.projectId && inv?.id) {
        try { await updateDoc(doc(db, 'projects', inv.projectId, 'invoices', inv.id), { emailedAt: serverTimestamp() }); } catch {}
      }
    } catch {}
  };

  const printStatement = (customer, invs) => {
    try {
      const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>Statement - ${customer}</title><style>
        body{font-family:Arial,sans-serif;color:#111827;margin:24px}
        .head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
        .brand{font-weight:700;font-size:20px}
        .muted{color:#6b7280;font-size:12px}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        th,td{border:1px solid #e5e7eb;padding:8px;text-align:left}
        .total{font-weight:700}
      </style></head><body>
        <div class=\"head\"><div><div class=\"brand\">ProFlow</div><div class=\"muted\">Customer Statement</div></div><div class=\"muted\">Customer: ${customer}</div></div>
        <table>
          <thead><tr><th>Project</th><th>Due</th><th>Status</th><th style=\"width:140px\">Amount</th></tr></thead>
          <tbody>
            ${invs.map(r => `<tr><td>${r.projectName||''}</td><td>${r.dueDate||'-'}</td><td>${r.status||'unpaid'}</td><td>${Number(r.total||0).toFixed(2)}</td></tr>`).join('')}
          </tbody>
        </table>
      </body></html>`;
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    } catch {}
  };

  return (
    <div style={getPageContainerStyle()}>
      <TopBar />
      <div style={{ ...getContentContainerStyle(), paddingTop: DESIGN_SYSTEM.spacing['2xl'] }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: DESIGN_SYSTEM.spacing.lg }}>
          <div style={{ background: DESIGN_SYSTEM.pageThemes.home.gradient, color: DESIGN_SYSTEM.colors.text.inverse, borderRadius: DESIGN_SYSTEM.borderRadius.lg, padding: DESIGN_SYSTEM.spacing.base, boxShadow: DESIGN_SYSTEM.shadows.md }}>
            <h2 style={{ margin: 0 }}>Finance</h2>
            <p style={{ margin: '4px 0 0 0', opacity: 0.9 }}>Cross‑project expenses and invoices</p>
          </div>

          <div style={{ background: DESIGN_SYSTEM.colors.background.primary, borderRadius: DESIGN_SYSTEM.borderRadius.lg, boxShadow: DESIGN_SYSTEM.shadows.sm, padding: DESIGN_SYSTEM.spacing.base }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {['invoices','expenses','quotes','customers','insights'].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: activeTab === t ? DESIGN_SYSTEM.colors.secondary[100] : DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12, textTransform: 'capitalize' }}>{t}</button>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <Stat label="Expenses" value={expTotal} />
                <Stat label="Invoiced" value={invTotal} />
                <Stat label="Unpaid" value={invUnpaid} />
              </div>
            </div>

            {activeTab === 'invoices' && (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <label style={{ fontSize: 12, color: DESIGN_SYSTEM.colors.text.secondary }}>
                    Status
                    <select value={invoiceFilter.status} onChange={(e) => setInvoiceFilter(f => ({ ...f, status: e.target.value }))} style={{ display: 'block', marginTop: 4 }}>
                      <option value="all">All</option>
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                    </select>
                  </label>
                  <label style={{ fontSize: 12, color: DESIGN_SYSTEM.colors.text.secondary }}>
                    Customer
                    <select value={invoiceFilter.customer} onChange={(e) => setInvoiceFilter(f => ({ ...f, customer: e.target.value }))} style={{ display: 'block', marginTop: 4 }}>
                      {customers.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <button onClick={() => setShowEmailTpl(true)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Email Template</button>
                    <button onClick={() => exportInvoicesCsv(filteredInvoices)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Export CSV</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 120px 120px 200px', gap: 8, fontSize: 12, color: DESIGN_SYSTEM.colors.text.secondary, fontWeight: 600 }}>
                    <div>Client</div>
                    <div>Project</div>
                    <div>Due</div>
                    <div>Amount</div>
                    <div>Actions</div>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    {filteredInvoices.length === 0 ? (
                      <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontStyle: 'italic' }}>No invoices</div>
                    ) : (
                      filteredInvoices.map((r, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 120px 120px 260px', gap: 8, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.client || 'Client'}</div>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.projectName}</div>
                          <div>{r.dueDate || '-'}</div>
                          <div>{r.total.toFixed(2)}</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button onClick={() => { setEditInvoice(r); setShowInvoiceModal(true); }} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>Edit</button>
                            <select value={r.status} onChange={(e) => updateInvoiceStatus(r, e.target.value)} style={{ padding: '4px 6px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                              <option value="unpaid">Unpaid</option>
                              <option value="paid">Paid</option>
                            </select>
                            <button onClick={() => sendInvoiceEmail(r)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>Email</button>
                            <button onClick={() => printInvoice(r)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>Print</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'expenses' && (
              <>
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                    <button onClick={() => exportExpensesCsv(expensesRows)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Export CSV</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 120px 120px', gap: 8, fontSize: 12, color: DESIGN_SYSTEM.colors.text.secondary, fontWeight: 600 }}>
                    <div>Project</div>
                    <div>Category</div>
                    <div>Date</div>
                    <div>Amount</div>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    {expensesRows.length === 0 ? (
                      <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontStyle: 'italic' }}>No expenses</div>
                    ) : (
                      expensesRows.map((r, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 120px 120px', gap: 8, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.projectName}</div>
                          <div>{r.category || '-'}</div>
                          <div>{r.date || '-'}</div>
                          <div>{r.amount.toFixed(2)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'quotes' && (
              <>
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setShowFinanceDefaults(true)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Finance Settings</button>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => exportQuotesCsv(quoteRows)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Export CSV</button>
                      <button onClick={() => { setNewQuote({ projectId: '', client: '', validUntil: '', items: [], taxRate: financeDefaults.taxRate || 0, discount: financeDefaults.discount || 0 }); setShowQuoteModal(true); }} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>+ New Quote</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 120px 120px 160px', gap: 8, fontSize: 12, color: DESIGN_SYSTEM.colors.text.secondary, fontWeight: 600 }}>
                    <div>Client</div>
                    <div>Project</div>
                    <div>Valid Until</div>
                    <div>Amount</div>
                    <div>Actions</div>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    {quoteRows.length === 0 ? (
                      <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontStyle: 'italic' }}>No quotes</div>
                    ) : (
                      quoteRows.map((r, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 120px 120px 160px', gap: 8, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.client || 'Client'} ({r.status})</div>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.projectName}</div>
                          <div>{r.validUntil || '-'}</div>
                          <div>{r.total.toFixed(2)}</div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => convertQuoteToInvoice(r)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>Convert to Invoice</button>
                            <button onClick={() => printQuote(r)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>Print</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <QuoteModal isOpen={showQuoteModal} onClose={() => setShowQuoteModal(false)} projects={projects} value={newQuote} onChange={setNewQuote} onSave={saveNewQuote} />
              </>
            )}

            {activeTab === 'insights' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  <Stat label="Total Expenses" value={expTotal} />
                  <Stat label="Total Invoiced" value={invTotal} />
                  <Stat label="Unpaid Invoices" value={invUnpaid} />
                </div>
              </>
            )}

            {activeTab === 'customers' && (
              <>
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                    <button onClick={() => exportCustomersCsv(customersRollup)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Export CSV</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 120px 80px 120px 140px', gap: 8, fontSize: 12, color: DESIGN_SYSTEM.colors.text.secondary, fontWeight: 600 }}>
                    <div>Customer</div>
                    <div>Invoiced</div>
                    <div>Paid</div>
                    <div>Unpaid</div>
                    <div># Inv</div>
                    <div>Last Due</div>
                    <div>Actions</div>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    {customersRollup.length === 0 ? (
                      <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontStyle: 'italic' }}>No data</div>
                    ) : (
                      customersRollup.map((c, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 120px 80px 120px 140px', gap: 8, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                          <div>
                            <a href={`#/finance?tab=invoices&customer=${encodeURIComponent(c.name)}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{c.name}</a>
                          </div>
                          <div>{c.invoiced.toFixed(2)}</div>
                          <div>{c.paid.toFixed(2)}</div>
                          <div style={{ color: c.unpaid > 0 ? '#b91c1c' : DESIGN_SYSTEM.colors.text.primary }}>{c.unpaid.toFixed(2)}</div>
                          <div>{c.count}</div>
                          <div>{c.lastDue || '-'}</div>
                          <div>
                            <button onClick={() => setStatementCustomer(c.name)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Statement</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {showEmailTpl && (
        <Modal title="Invoice Email Template" onClose={() => setShowEmailTpl(false)} onSave={async () => {
          try {
            if (!currentUser?.uid) return;
            await setDoc(doc(db, 'users', currentUser.uid, 'settings', 'financeEmail'), emailTpl, { merge: true });
            setShowEmailTpl(false);
            // lightweight cache
            localStorage.setItem(`proflow_notif_settings_${currentUser.uid}`, JSON.stringify({ dueSoonHours: 24 }));
          } catch {
            setShowEmailTpl(false);
          }
        }}>
          <Field label="Subject"><input value={emailTpl.subject} onChange={(e) => setEmailTpl(t => ({ ...t, subject: e.target.value }))} /></Field>
          <Field label="Body"><textarea value={emailTpl.body} onChange={(e) => setEmailTpl(t => ({ ...t, body: e.target.value }))} style={{ width: '100%', minHeight: 140, boxSizing: 'border-box' }} /></Field>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Placeholders: {`{client}`} {`{project}`} {`{dueDate}`} {`{total}`} {`{status}`}</div>
        </Modal>
      )}
      {showFinanceDefaults && (
        <Modal title="Finance Settings" onClose={() => setShowFinanceDefaults(false)} onSave={async () => {
          try {
            if (!currentUser?.uid) return;
            await setDoc(doc(db, 'users', currentUser.uid, 'settings', 'financeDefaults'), financeDefaults, { merge: true });
            setShowFinanceDefaults(false);
          } catch { setShowFinanceDefaults(false); }
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Field label="Default Tax Rate %"><input type="number" step="0.01" value={financeDefaults.taxRate} onChange={(e) => setFinanceDefaults(s => ({ ...s, taxRate: Number(e.target.value||0) }))} /></Field>
            <Field label="Default Discount"><input type="number" step="0.01" value={financeDefaults.discount} onChange={(e) => setFinanceDefaults(s => ({ ...s, discount: Number(e.target.value||0) }))} /></Field>
          </div>
          <Field label="Default Email Recipients (comma separated)"><input value={financeDefaults.recipients} onChange={(e) => setFinanceDefaults(s => ({ ...s, recipients: e.target.value }))} /></Field>
        </Modal>
      )}
      {statementCustomer && (() => {
        const list = invoiceRows.filter(r => (r.client || 'Unassigned') === statementCustomer);
        const sum = list.reduce((a,b) => a + (b.total || 0), 0);
        const unpaid = list.filter(r => r.status !== 'paid').reduce((a,b) => a + (b.total || 0), 0);
        return (
          <Modal title={`Statement - ${statementCustomer}`} onClose={() => setStatementCustomer(null)}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => exportInvoicesCsv(list)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Export CSV</button>
              <button onClick={() => printStatement(statementCustomer, list)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Print</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 120px', gap: 8, fontSize: 12, color: '#6b7280', fontWeight: 600, marginTop: 8 }}>
              <div>Project</div>
              <div>Due</div>
              <div>Status</div>
              <div>Amount</div>
            </div>
            <div style={{ marginTop: 6 }}>
              {list.length === 0 ? (
                <div style={{ color: '#6b7280', fontStyle: 'italic' }}>No invoices</div>
              ) : (
                list.map((r, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 120px', gap: 8, padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.projectName}</div>
                    <div>{r.dueDate || '-'}</div>
                    <div>{r.status || 'unpaid'}</div>
                    <div>{Number(r.total||0).toFixed(2)}</div>
                  </div>
                ))
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 12 }}>
              <div>Total: {sum.toFixed(2)}</div>
              <div>Unpaid: {unpaid.toFixed(2)}</div>
            </div>
          </Modal>
        );
      })()}
      {showInvoiceModal && editInvoice && (
        <InvoiceModal
          isOpen={showInvoiceModal}
          onClose={() => { setShowInvoiceModal(false); setEditInvoice(null); }}
          invoice={editInvoice}
          onSave={async (val) => {
            try {
              const items = (val.items || []).map(it => ({ description: it.description || '', qty: Number(it.qty||0), unitPrice: Number(it.unitPrice||0) }));
              const subtotal = items.reduce((a, it) => a + (it.qty*it.unitPrice), 0);
              const taxRate = Number(val.taxRate||0);
              const taxAmount = subtotal * (taxRate/100);
              const discount = Number(val.discount||0);
              const total = subtotal + taxAmount - discount;
              await updateDoc(doc(db, 'projects', editInvoice.projectId, 'invoices', editInvoice.id), {
                client: val.client || '',
                dueDate: val.dueDate || '',
                items, subtotal, taxRate, taxAmount, discount, total
              });
              setShowInvoiceModal(false); setEditInvoice(null);
            } catch { setShowInvoiceModal(false); setEditInvoice(null); }
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px' }}>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{Number(value || 0).toFixed(2)}</div>
    </div>
  );
}

// Quote creation modal (shown when showQuoteModal)
export function QuoteModal({ isOpen, onClose, projects, value, onChange, onSave }) {
  if (!isOpen) return null;
  return (
    <Modal title="Create Quote" onClose={onClose} onSave={onSave}>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="Project">
          <select value={value.projectId} onChange={(e) => onChange(v => ({ ...v, projectId: e.target.value }))} style={{ width: '100%' }}>
            <option value="">Select project</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
          </select>
        </Field>
        <Field label="Client"><input value={value.client} onChange={(e) => onChange(v => ({ ...v, client: e.target.value }))} /></Field>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="Valid Until"><input type="date" value={value.validUntil || ''} onChange={(e) => onChange(v => ({ ...v, validUntil: e.target.value }))} /></Field>
        <Field label="Tax Rate %"><input type="number" step="0.01" value={value.taxRate ?? 0} onChange={(e) => onChange(v => ({ ...v, taxRate: Number(e.target.value || 0) }))} /></Field>
        <Field label="Discount"><input type="number" step="0.01" value={value.discount ?? 0} onChange={(e) => onChange(v => ({ ...v, discount: Number(e.target.value || 0) }))} /></Field>
      </div>
      <div>
        <div style={{ fontWeight: 600, margin: '8px 0' }}>Items</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 140px 80px', gap: 8, fontSize: 12, color: '#6b7280' }}>
          <div>Description</div>
          <div>Qty</div>
          <div>Unit Price</div>
          <div></div>
        </div>
        <div style={{ marginTop: 6 }}>
          {(value.items || []).map((it, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 140px 80px', gap: 8, padding: '4px 0' }}>
              <input value={it.description || ''} onChange={(e) => onChange(v => { const items = [...(v.items||[])]; items[idx] = { ...items[idx], description: e.target.value }; return { ...v, items }; })} />
              <input type="number" step="1" value={it.qty ?? 0} onChange={(e) => onChange(v => { const items = [...(v.items||[])]; items[idx] = { ...items[idx], qty: Number(e.target.value || 0) }; return { ...v, items }; })} />
              <input type="number" step="0.01" value={it.unitPrice ?? 0} onChange={(e) => onChange(v => { const items = [...(v.items||[])]; items[idx] = { ...items[idx], unitPrice: Number(e.target.value || 0) }; return { ...v, items }; })} />
              <button onClick={() => onChange(v => { const items = [...(v.items||[])]; items.splice(idx,1); return { ...v, items }; })} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Remove</button>
            </div>
          ))}
          <div style={{ marginTop: 8 }}>
            <button onClick={() => onChange(v => ({ ...v, items: [...(v.items||[]), { description: '', qty: 1, unitPrice: 0 }] }))} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>+ Add Item</button>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 12 }}>
          {(() => {
            const items = value.items || [];
            const subtotal = items.reduce((a, it) => a + (Number(it.qty||0) * Number(it.unitPrice||0)), 0);
            const tax = subtotal * (Number(value.taxRate||0)/100);
            const discount = Number(value.discount||0);
            const total = subtotal + tax - discount;
            return (
              <>
                <div>Subtotal: {subtotal.toFixed(2)}</div>
                <div>Tax: {tax.toFixed(2)}</div>
                <div>Discount: {discount.toFixed(2)}</div>
                <div style={{ fontWeight: 700 }}>Total: {total.toFixed(2)}</div>
              </>
            );
          })()}
        </div>
      </div>
    </Modal>
  );
}

function exportInvoicesCsv(rows) {
  try {
    const header = ['client','project','dueDate','status','total'];
    const data = rows.map(r => [r.client || '', r.projectName || '', r.dueDate || '', r.status || 'unpaid', Number(r.total||0).toFixed(2)]);
    downloadCsv([header, ...data], 'invoices.csv');
  } catch {}
}

function exportExpensesCsv(rows) {
  try {
    const header = ['project','date','category','amount','note'];
    const data = rows.map(r => [r.projectName || '', r.date || '', r.category || '', Number(r.amount||0).toFixed(2), (r.note || '').replace(/\n/g,' ')]);
    downloadCsv([header, ...data], 'expenses.csv');
  } catch {}
}

function exportQuotesCsv(rows) {
  try {
    const header = ['client','project','validUntil','status','total'];
    const data = rows.map(r => [r.client || '', r.projectName || '', r.validUntil || '', r.status || 'draft', Number(r.total||0).toFixed(2)]);
    downloadCsv([header, ...data], 'quotes.csv');
  } catch {}
}

function exportCustomersCsv(rows) {
  try {
    const header = ['customer','invoiced','paid','unpaid','count','lastDue'];
    const data = rows.map(r => [r.name, r.invoiced.toFixed(2), r.paid.toFixed(2), r.unpaid.toFixed(2), r.count, r.lastDue || '']);
    downloadCsv([header, ...data], 'customers.csv');
  } catch {}
}

function downloadCsv(matrix, filename) {
  const csv = matrix.map(r => r.map(v => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g,'""') + '"' : v).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

function Modal({ title, onClose, children, onSave }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 3600, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: '92%', maxWidth: 640, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 12 }}>Close</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
        {onSave && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button onClick={onSave} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Save</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280', flex: 1 }}>
      <span style={{ marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  );
}

function InvoiceModal({ isOpen, onClose, invoice, onSave }) {
  const [form, setForm] = useState(() => ({
    client: invoice?.client || '',
    dueDate: invoice?.dueDate || '',
    items: Array.isArray(invoice?.items) ? invoice.items.map(it => ({ description: it.description || '', qty: Number(it.qty||0), unitPrice: Number(it.unitPrice||0) })) : [],
    taxRate: invoice?.taxRate || 0,
    discount: invoice?.discount || 0
  }));
  if (!isOpen) return null;
  return (
    <Modal title="Edit Invoice" onClose={onClose} onSave={() => onSave(form)}>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="Client"><input value={form.client} onChange={(e) => setForm(f => ({ ...f, client: e.target.value }))} /></Field>
        <Field label="Due Date"><input type="date" value={form.dueDate} onChange={(e) => setForm(f => ({ ...f, dueDate: e.target.value }))} /></Field>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="Tax Rate %"><input type="number" step="0.01" value={form.taxRate} onChange={(e) => setForm(f => ({ ...f, taxRate: Number(e.target.value||0) }))} /></Field>
        <Field label="Discount"><input type="number" step="0.01" value={form.discount} onChange={(e) => setForm(f => ({ ...f, discount: Number(e.target.value||0) }))} /></Field>
      </div>
      <div>
        <div style={{ fontWeight: 600, margin: '8px 0' }}>Items</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 140px 80px', gap: 8, fontSize: 12, color: '#6b7280' }}>
          <div>Description</div>
          <div>Qty</div>
          <div>Unit Price</div>
          <div></div>
        </div>
        <div style={{ marginTop: 6 }}>
          {(form.items || []).map((it, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 140px 80px', gap: 8, padding: '4px 0' }}>
              <input value={it.description || ''} onChange={(e) => setForm(f => { const items = [...(f.items||[])]; items[idx] = { ...items[idx], description: e.target.value }; return { ...f, items }; })} />
              <input type="number" step="1" value={it.qty ?? 0} onChange={(e) => setForm(f => { const items = [...(f.items||[])]; items[idx] = { ...items[idx], qty: Number(e.target.value || 0) }; return { ...f, items }; })} />
              <input type="number" step="0.01" value={it.unitPrice ?? 0} onChange={(e) => setForm(f => { const items = [...(f.items||[])]; items[idx] = { ...items[idx], unitPrice: Number(e.target.value || 0) }; return { ...f, items }; })} />
              <button onClick={() => setForm(f => { const items = [...(f.items||[])]; items.splice(idx,1); return { ...f, items }; })} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Remove</button>
            </div>
          ))}
          <div style={{ marginTop: 8 }}>
            <button onClick={() => setForm(f => ({ ...f, items: [...(f.items||[]), { description: '', qty: 1, unitPrice: 0 }] }))} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>+ Add Item</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}


