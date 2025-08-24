import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { DESIGN_SYSTEM } from '../../styles/designSystem';

export default function FinancePanel({ projectId }) {
  const [tab, setTab] = useState('expenses'); // 'expenses' | 'invoices'
  const [expenses, setExpenses] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showInsights, setShowInsights] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    const expRef = collection(db, 'projects', projectId, 'expenses');
    const invRef = collection(db, 'projects', projectId, 'invoices');
    const unsubExp = onSnapshot(query(expRef, orderBy('date', 'desc')), snap => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubInv = onSnapshot(query(invRef, orderBy('createdAt', 'desc')), snap => {
      setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubExp(); unsubInv(); };
  }, [projectId]);

  const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalInvoiced = invoices.reduce((s, inv) => s + (Number(inv.total) || 0), 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, inv) => s + (Number(inv.total) || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: DESIGN_SYSTEM.spacing.base, background: DESIGN_SYSTEM.pageThemes.projects.gradient, color: DESIGN_SYSTEM.colors.text.inverse, borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0` }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
          <h3 style={{ margin: 0, fontSize: DESIGN_SYSTEM.typography.fontSize.lg, fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold }}>Finance</h3>
          <div style={{ fontSize: DESIGN_SYSTEM.typography.fontSize.sm, opacity: 0.9 }}>
            Expenses: {totalExpenses.toFixed(2)} • Invoiced: {totalInvoiced.toFixed(2)} • Paid: {totalPaid.toFixed(2)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowExpenseModal(true)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>+ Expense</button>
          <button onClick={() => setShowInvoiceModal(true)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>+ Invoice</button>
          <button onClick={() => exportCsv(expenses, invoices)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>Export CSV</button>
          <button onClick={() => setShowInsights(v => !v)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: showInsights ? DESIGN_SYSTEM.colors.secondary[100] : DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>Insights</button>
        </div>
      </div>
      <div style={{ padding: DESIGN_SYSTEM.spacing.base }}>
        {showInsights && (
          <Insights expenses={expenses} invoices={invoices} />
        )}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={() => setTab('expenses')} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: tab === 'expenses' ? DESIGN_SYSTEM.colors.secondary[100] : DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>Expenses</button>
          <button onClick={() => setTab('invoices')} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: tab === 'invoices' ? DESIGN_SYSTEM.colors.secondary[100] : DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>Invoices</button>
        </div>
        {tab === 'expenses' ? (
          <ExpensesList projectId={projectId} items={expenses} />
        ) : (
          <InvoicesList projectId={projectId} items={invoices} />
        )}
      </div>

      {showExpenseModal && (
        <ExpenseModal projectId={projectId} onClose={() => setShowExpenseModal(false)} />
      )}
      {showInvoiceModal && (
        <InvoiceModal projectId={projectId} onClose={() => setShowInvoiceModal(false)} />
      )}
    </div>
  );
}

function ExpensesList({ projectId, items }) {
  const remove = async (id) => { try { await deleteDoc(doc(db, 'projects', projectId, 'expenses', id)); } catch {} };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 80px', gap: 8 }}>
      <HeaderRow cols={["Note", "Category", "Date", "Amount"]} />
      {items.length === 0 ? (
        <div style={{ gridColumn: '1 / -1', color: DESIGN_SYSTEM.colors.text.secondary, fontStyle: 'italic' }}>No expenses yet.</div>
      ) : items.map(e => (
        <React.Fragment key={e.id}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.note || ''}>{e.note || '-'}</div>
          <div>{e.category || '-'}</div>
          <div>{e.date || '-'}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{Number(e.amount || 0).toFixed(2)}</span>
            <button onClick={() => remove(e.id)} style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>Delete</button>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

function InvoicesList({ projectId, items }) {
  const markPaid = async (id) => { try { await updateDoc(doc(db, 'projects', projectId, 'invoices', id), { status: 'paid', paidAt: serverTimestamp() }); } catch {} };
  const remove = async (id) => { try { await deleteDoc(doc(db, 'projects', projectId, 'invoices', id)); } catch {} };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 100px 120px', gap: 8 }}>
      <HeaderRow cols={["Client", "Due Date", "Status", "Total", "Actions"]} />
      {items.length === 0 ? (
        <div style={{ gridColumn: '1 / -1', color: DESIGN_SYSTEM.colors.text.secondary, fontStyle: 'italic' }}>No invoices yet.</div>
      ) : items.map(inv => (
        <React.Fragment key={inv.id}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={inv.client || ''}>{inv.client || '-'}</div>
          <div>{inv.dueDate || '-'}</div>
          <div>
            <span style={{ padding: '2px 8px', borderRadius: 999, background: inv.status === 'paid' ? '#ECFDF5' : '#FEF3C7', color: inv.status === 'paid' ? '#065F46' : '#92400E', fontSize: 12 }}>{inv.status || 'unpaid'}</span>
          </div>
          <div>{Number(inv.total || 0).toFixed(2)}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {inv.status !== 'paid' && <button onClick={() => markPaid(inv.id)} style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>Mark paid</button>}
            <button onClick={() => remove(inv.id)} style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>Delete</button>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

function HeaderRow({ cols }) {
  return (
    <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'inherit', gap: 8, fontSize: 12, color: DESIGN_SYSTEM.colors.text.secondary, marginBottom: 4 }}>
      {cols.map((c, i) => (<div key={i} style={{ fontWeight: 600 }}>{c}</div>))}
    </div>
  );
}

function ExpenseModal({ projectId, onClose }) {
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('General');
  const [amount, setAmount] = useState('');
  const save = async () => {
    if (!projectId || !amount) return;
    try {
      await addDoc(collection(db, 'projects', projectId, 'expenses'), { note, date, category, amount: Number(amount), createdAt: serverTimestamp() });
      onClose();
    } catch {}
  };
  return (
    <Modal title="Add Expense" onClose={onClose} onSave={save}>
      <Field label="Note"><input value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} placeholder="Optional description" /></Field>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} /></Field>
        <Field label="Category"><input value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle} /></Field>
        <Field label="Amount"><input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} /></Field>
      </div>
    </Modal>
  );
}

function InvoiceModal({ projectId, onClose }) {
  const [client, setClient] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [total, setTotal] = useState('');
  const [status, setStatus] = useState('unpaid');
  const [notes, setNotes] = useState('');
  const save = async () => {
    if (!projectId || !client || !total) return;
    try {
      await addDoc(collection(db, 'projects', projectId, 'invoices'), { client, dueDate, total: Number(total), status, notes, createdAt: serverTimestamp() });
      onClose();
    } catch {}
  };
  return (
    <Modal title="Create Invoice" onClose={onClose} onSave={save}>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="Client"><input value={client} onChange={(e) => setClient(e.target.value)} style={inputStyle} /></Field>
        <Field label="Due Date"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} /></Field>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="Total"><input type="number" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} style={inputStyle} /></Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
          </select>
        </Field>
      </div>
      <Field label="Notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} /></Field>
    </Modal>
  );
}

function Modal({ title, children, onClose, onSave }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 3600, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: '92%', maxWidth: 640, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ padding: '6px 10px', border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, borderRadius: 8, background: DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>Close</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {children}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button onClick={onSave} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>Save</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: DESIGN_SYSTEM.colors.text.secondary, flex: 1 }}>
      <span style={{ marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle = { width: '100%', boxSizing: 'border-box', padding: 8, border: '1px solid #e5e7eb', borderRadius: 8 };

function exportCsv(expenses, invoices) {
  try {
    const expHeader = ['type','date','category','amount','note'];
    const expRows = expenses.map(e => ['expense', e.date || '', e.category || '', Number(e.amount || 0).toFixed(2), (e.note || '').replace(/\n/g,' ') ]);
    const invHeader = ['type','client','dueDate','status','total','notes'];
    const invRows = invoices.map(i => ['invoice', i.client || '', i.dueDate || '', i.status || 'unpaid', Number(i.total || 0).toFixed(2), (i.notes || '').replace(/\n/g,' ') ]);
    const all = [expHeader, ...expRows, invHeader, ...invRows];
    const csv = all.map(r => r.map(v => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g,'""') + '"' : v).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'finance-export.csv'; a.click(); URL.revokeObjectURL(url);
  } catch {}
}

function Insights({ expenses, invoices }) {
  const byMonth = {};
  const now = new Date();
  for (const e of expenses) {
    if (!e.date) continue;
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    byMonth[key] = (byMonth[key] || 0) + (Number(e.amount) || 0);
  }
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    months.push({ key, label: d.toLocaleString(undefined, { month: 'short' }), amount: byMonth[key] || 0 });
  }
  const aging = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  const today = new Date();
  for (const inv of invoices) {
    if (inv.status === 'paid') continue;
    if (!inv.dueDate) continue;
    const due = new Date(inv.dueDate);
    const diff = Math.ceil((today - due) / (1000*60*60*24));
    if (diff <= 30) aging['0-30'] += Number(inv.total || 0);
    else if (diff <= 60) aging['31-60'] += Number(inv.total || 0);
    else if (diff <= 90) aging['61-90'] += Number(inv.total || 0);
    else aging['90+'] += Number(inv.total || 0);
  }
  return (
    <div style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Monthly Expenses</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
          {months.map(m => (
            <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <div title={m.amount.toFixed(2)} style={{ height: Math.min(100, Math.round((m.amount || 0) / Math.max(1, Math.max(...months.map(x=>x.amount))) * 100)), background: '#93C5FD', borderRadius: 4 }} />
              <div style={{ textAlign: 'center', fontSize: 12, color: '#6b7280', marginTop: 4 }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>AR Aging (Unpaid)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {Object.entries(aging).map(([bucket, amt]) => (
            <div key={bucket} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{bucket} days</div>
              <div style={{ fontWeight: 700 }}>{Number(amt).toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

