import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, where, getDoc } from 'firebase/firestore';
import { DESIGN_SYSTEM } from '../../styles/designSystem';
import ProjectQuotesPanel from './ProjectQuotesPanel';
import { useAuth } from '../../contexts/AuthContext';

export default function FinancePanel({ projectId }) {
  const { currentUser } = useAuth();
  const [tab, setTab] = useState('expenses'); // 'expenses' | 'invoices' | 'quotes'
  const [expenses, setExpenses] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [projectCustomer, setProjectCustomer] = useState({ name: '', currency: '', taxRate: undefined });
  const [customersBook, setCustomersBook] = useState([]);

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

  useEffect(() => {
    const loadProjectCustomer = async () => {
      try {
        if (!projectId) return;
        const pref = doc(db, 'projects', projectId);
        const psnap = await (await import('firebase/firestore')).getDoc(pref);
        const pdata = psnap.exists() ? psnap.data() : {};
        const customerId = pdata.customerId;
        if (!customerId) { setProjectCustomer({ name: pdata.customerName || '', currency: '', taxRate: undefined }); return; }
        const cref = doc(db, 'customerProfiles', customerId);
        const csnap = await (await import('firebase/firestore')).getDoc(cref);
        if (csnap.exists()) {
          const c = csnap.data() || {};
          setProjectCustomer({
            name: c.customerProfile?.name || c.companyProfile?.company || '',
            currency: c.financeDefaults?.currency || c.customerProfile?.currency || '',
            taxRate: c.financeDefaults?.taxRate ?? c.customerProfile?.taxRate
          });
        } else {
          setProjectCustomer({ name: pdata.customerName || '', currency: '', taxRate: undefined });
        }
      } catch { setProjectCustomer({ name: '', currency: '', taxRate: undefined }); }
    };
    loadProjectCustomer();
  }, [projectId]);

  useEffect(() => {
    if (!currentUser?.uid) { setCustomersBook([]); return; }
    const qref = query(collection(db, 'customerProfiles'), where('userId', '==', currentUser.uid));
    const unsub = onSnapshot(qref, snap => {
      const list = snap.docs.map(d => {
        const data = d.data() || {};
        const name = data.customerProfile?.name || data.companyProfile?.company || d.id;
        const currency = data.financeDefaults?.currency || data.customerProfile?.currency || '';
        const taxRate = data.financeDefaults?.taxRate ?? data.customerProfile?.taxRate;
        return { id: d.id, name, currency, taxRate };
      }).sort((a,b) => (a.name||'').localeCompare(b.name||''));
      setCustomersBook(list);
    });
    return () => unsub();
  }, [currentUser?.uid]);

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
          <button onClick={() => setTab('quotes')} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: tab === 'quotes' ? DESIGN_SYSTEM.colors.secondary[100] : DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>Quotes</button>
        </div>
        {tab === 'expenses' ? (
          <ExpensesList projectId={projectId} items={expenses} />
        ) : tab === 'invoices' ? (
          <InvoicesList projectId={projectId} items={invoices} />
        ) : (
          <ProjectQuotesPanel projectId={projectId} />
        )}
      </div>

      {showExpenseModal && (
        <ExpenseModal projectId={projectId} onClose={() => setShowExpenseModal(false)} />
      )}
      {showInvoiceModal && (
        <InvoiceModal projectId={projectId} onClose={() => setShowInvoiceModal(false)} initialClient={projectCustomer.name} initialCurrency={projectCustomer.currency} initialTaxRate={projectCustomer.taxRate} customersBook={customersBook} />
      )}
    </div>
  );
}

function getCardStyleSafe() {
  try {
    // Lazy import to avoid circular styled refs; fallback to simple border box
    const base = DESIGN_SYSTEM;
    return {
      border: `1px solid ${base.colors.secondary[200]}`,
      borderRadius: base.borderRadius.lg,
      background: base.colors.background.primary,
      boxShadow: base.shadows.sm,
      overflow: 'hidden'
    };
  } catch {
    return { border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', overflow: 'hidden' };
  }
}

function ExpensesList({ projectId, items }) {
  const remove = async (id) => { try { await deleteDoc(doc(db, 'projects', projectId, 'expenses', id)); } catch {} };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 220px', gap: 8 }}>
      <HeaderRow cols={["Note", "Category", "Date", "Amount (Cust/Base)"]} />
      {items.length === 0 ? (
        <div style={{ gridColumn: '1 / -1', color: DESIGN_SYSTEM.colors.text.secondary, fontStyle: 'italic' }}>No expenses yet.</div>
      ) : items.map(e => (
        <React.Fragment key={e.id}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.note || ''}>{e.note || '-'}</div>
          <div>{e.category || '-'}</div>
          <div>{e.date || '-'}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{(() => { const cur=(e.currency||'USD').toUpperCase(); const base=(e.fxBase||cur).toUpperCase(); const fmt=(n,c)=>{ try{return new Intl.NumberFormat(undefined,{ style:'currency', currency:c }).format(Number(n||0)); } catch { return `${c} ${Number(n||0).toFixed(2)}`; } }; const amt=Number(e.amount||0); const amtBase=(typeof e.amountBase==='number')?Number(e.amountBase):(cur===base?amt:(Number(e.fxRate||0)>0?amt/Number(e.fxRate):amt)); return `${fmt(amt,cur)}  •  ${fmt(amtBase,base)}`; })()}</span>
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
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 80px 100px 100px 120px', gap: 8 }}>
      <HeaderRow cols={["Client", "Due Date", "Status", "Tax %", "Discount", "Total", "Actions"]} />
      {items.length === 0 ? (
        <div style={{ gridColumn: '1 / -1', color: DESIGN_SYSTEM.colors.text.secondary, fontStyle: 'italic' }}>No invoices yet.</div>
      ) : items.map(inv => (
        <React.Fragment key={inv.id}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={inv.client || ''}>{inv.client || '-'}</div>
          <div>{inv.dueDate || '-'}</div>
          <div>
            <span style={{ padding: '2px 8px', borderRadius: 999, background: inv.status === 'paid' ? '#ECFDF5' : '#FEF3C7', color: inv.status === 'paid' ? '#065F46' : '#92400E', fontSize: 12 }}>{inv.status || 'unpaid'}</span>
          </div>
          <div>{Number(inv.taxRate || 0).toFixed(2)}</div>
          <div>{(() => { const cur=(inv.currency||'USD').toUpperCase(); const base=(inv.fxBase||cur).toUpperCase(); const fmt=(n,c)=>{ try{return new Intl.NumberFormat(undefined,{ style:'currency', currency:c }).format(Number(n||0)); } catch { return `${c} ${Number(n||0).toFixed(2)}`; } }; const disc=Number(inv.discount||0); const discBase=(typeof inv.discountBase==='number')?Number(inv.discountBase):(cur===base?disc:(Number(inv.fxRate||0)>0?disc/Number(inv.fxRate):disc)); return `${fmt(disc,cur)}  •  ${fmt(discBase,base)}`; })()}</div>
          <div>{(() => { const cur=(inv.currency||'USD').toUpperCase(); const base=(inv.fxBase||cur).toUpperCase(); const fmt=(n,c)=>{ try{return new Intl.NumberFormat(undefined,{ style:'currency', currency:c }).format(Number(n||0)); } catch { return `${c} ${Number(n||0).toFixed(2)}`; } }; const tot=Number(inv.total||0); const totBase=(typeof inv.totalBase==='number')?Number(inv.totalBase):(cur===base?tot:(Number(inv.fxRate||0)>0?tot/Number(inv.fxRate):tot)); return `${fmt(tot,cur)}  •  ${fmt(totBase,base)}`; })()}</div>
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
  const [currency, setCurrency] = useState('');
  const [fxBase, setFxBase] = useState('USD');
  useEffect(() => {
    const loadBase = async () => {
      try {
        if (!projectId) return;
        const defaultsRef = doc(db, 'users', (await (await import('../../contexts/AuthContext')).useAuth)?.currentUser?.uid || '');
      } catch {}
    };
  }, [projectId]);
  const [fxRate, setFxRate] = useState(1);
  const save = async () => {
    if (!projectId || !amount) return;
    try {
      await addDoc(collection(db, 'projects', projectId, 'expenses'), { note, date, category, amount: Number(amount), currency: currency || undefined, fxBase: fxBase || undefined, fxRate: Number(fxRate || 1), createdAt: serverTimestamp() });
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
        <Field label="Currency (ISO)"><input list="proflow-currencies" value={currency} onChange={(e) => setCurrency((e.target.value||'').toUpperCase())} style={inputStyle} placeholder="e.g., USD" />
          <datalist id="proflow-currencies">
            <option value="USD" />
            <option value="EUR" />
            <option value="GBP" />
            <option value="MYR" />
            <option value="SGD" />
            <option value="AUD" />
            <option value="CAD" />
            <option value="JPY" />
            <option value="CNY" />
            <option value="INR" />
          </datalist>
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="FX Base"><input list="proflow-currencies" value={fxBase} onChange={(e) => setFxBase((e.target.value||'').toUpperCase())} style={inputStyle} placeholder="USD" /></Field>
        <Field label="FX Rate (to base)"><input type="number" step="0.0001" value={fxRate} onChange={(e) => setFxRate(e.target.value)} style={inputStyle} placeholder="1.0" /></Field>
      </div>
    </Modal>
  );
}

function InvoiceModal({ projectId, onClose, initialClient, initialCurrency, initialTaxRate, customersBook = [] }) {
  const [client, setClient] = useState(initialClient || '');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState('unpaid');
  const [currency, setCurrency] = useState((initialCurrency || '').toUpperCase());
  const [fxBase, setFxBase] = useState('USD');
  const [fxRate, setFxRate] = useState(1);
  const [taxRate, setTaxRate] = useState(typeof initialTaxRate === 'number' ? initialTaxRate : 0);
  const [discount, setDiscount] = useState(0);
  const [items, setItems] = useState([]); // items grid
  const fetchRate = async () => {
    try {
      const base = (fxBase || '').toUpperCase();
      const cur = (currency || '').toUpperCase();
      if (!cur || !base) { alert('Please select Currency and FX Base first'); return; }
      const resp = await fetch(`https://api.exchangerate.host/latest?base=${encodeURIComponent(base)}&api_key=eb803299bef64dc80de605049727ccf4`);
      const data = await resp.json();
      if (data && data.rates && data.rates[cur] != null) setFxRate(Number(data.rates[cur]));
    } catch {}
  };
  const save = async () => {
    if (!projectId || !client) return;
    try {
      const safeItems = (items || []).map(it => ({ description: it.description || '', qty: Number(it.qty||0), unitPrice: Number(it.unitPrice||0) }));
      const subtotal = safeItems.reduce((a, it) => a + (Number(it.qty||0) * Number(it.unitPrice||0)), 0);
      const taxAmount = subtotal * (Number(taxRate || 0) / 100);
      const discountNum = Number(discount || 0);
      const finalTotal = subtotal + taxAmount - discountNum;
      const rate = Number(fxRate || 1);
      const baseCode = (fxBase || 'USD').toUpperCase();
      const curCode = (currency || 'USD').toUpperCase();
      const isSame = baseCode === curCode;
      const toBase = (n) => isSame ? Number(n||0) : Number(n||0) / (rate || 1);
      await addDoc(collection(db, 'projects', projectId, 'invoices'), { client, dueDate, items: safeItems, subtotal, taxRate: Number(taxRate || 0), taxAmount, discount: discountNum, total: finalTotal, status, currency: currency || undefined, fxBase: fxBase || undefined, fxRate: Number(fxRate || 1), createdAt: serverTimestamp(),
        subtotalBase: toBase(subtotal), taxAmountBase: toBase(taxAmount), discountBase: toBase(discountNum), totalBase: toBase(finalTotal)
      });
      onClose();
    } catch {}
  };
  return (
    <Modal title="Create Invoice" onClose={onClose} onSave={save}>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="Client">
          <select value={client} onChange={(e) => {
            const name = e.target.value; setClient(name);
            const c = customersBook.find(x => x.name === name);
            if (c) { if (c.currency) setCurrency((c.currency||'').toUpperCase()); if (typeof c.taxRate === 'number') setTaxRate(c.taxRate); }
          }} style={inputStyle}>
            <option value="">Select customer</option>
            {customersBook.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Due Date"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} /></Field>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
          </select>
        </Field>
        <Field label="Currency (ISO)"><input list="proflow-currencies" value={currency} onChange={(e) => setCurrency((e.target.value||'').toUpperCase())} style={inputStyle} placeholder="e.g., USD" /></Field>
        <Field label="Tax %"><input type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} style={inputStyle} /></Field>
        <Field label="Discount"><input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} style={inputStyle} /></Field>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="FX Rate (to base)"><div style={{ display: 'flex', gap: 8 }}><input type="number" step="0.0001" value={fxRate} onChange={(e) => setFxRate(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="1.0" /><button onClick={fetchRate} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Fetch Rate</button></div></Field>
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
          {(items || []).map((it, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 140px 80px', gap: 8, padding: '4px 0' }}>
              <input value={it.description || ''} onChange={(e) => setItems(v => { const arr = [...(v||[])]; arr[idx] = { ...arr[idx], description: e.target.value }; return arr; })} />
              <input type="number" step="1" value={it.qty ?? ''} onChange={(e) => setItems(v => { const arr = [...(v||[])]; arr[idx] = { ...arr[idx], qty: Number(e.target.value||0) }; return arr; })} />
              <input type="number" step="0.01" value={it.unitPrice ?? ''} onChange={(e) => setItems(v => { const arr = [...(v||[])]; arr[idx] = { ...arr[idx], unitPrice: Number(e.target.value||0) }; return arr; })} />
              <button onClick={() => setItems(v => { const arr = [...(v||[])]; arr.splice(idx,1); return arr; })} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Remove</button>
            </div>
          ))}
          <div style={{ marginTop: 8 }}>
            <button onClick={() => setItems(v => ([...(v||[]), { description: '', qty: 1, unitPrice: 0 }]))} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>+ Add Item</button>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 12, padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fafafa' }}>
          {(() => {
            const subtotal = (items||[]).reduce((a, it) => a + (Number(it.qty||0) * Number(it.unitPrice||0)), 0);
            const tax = subtotal * (Number(taxRate || 0) / 100);
            const disc = Number(discount || 0);
            const finalTotal = subtotal + tax - disc;
            const cur = (currency || 'USD').toUpperCase();
            const base = (fxBase || 'USD').toUpperCase();
            const rate = Number(fxRate || 1);
            const isSame = cur === base;
            const toBase = (n) => isSame ? Number(n||0) : Number(n||0) / (rate || 1);
            const fmt = (n,c) => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(Number(n||0)); } catch { return `${c} ${Number(n||0).toFixed(2)}`; } };
            return (
              <>
                <div>Subtotal: {fmt(subtotal, cur)} ({fmt(toBase(subtotal), base)})</div>
                <div>Tax: {fmt(tax, cur)} ({fmt(toBase(tax), base)})</div>
                <div>Discount: {fmt(disc, cur)} ({fmt(toBase(disc), base)})</div>
                <div style={{ fontWeight: 700 }}>Total: {fmt(finalTotal, cur)} ({fmt(toBase(finalTotal), base)})</div>
              </>
            );
          })()}
        </div>
      </div>
      <datalist id="proflow-currencies">
        <option value="USD" />
        <option value="EUR" />
        <option value="GBP" />
        <option value="MYR" />
        <option value="SGD" />
        <option value="AUD" />
        <option value="CAD" />
        <option value="JPY" />
        <option value="CNY" />
        <option value="INR" />
      </datalist>
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

