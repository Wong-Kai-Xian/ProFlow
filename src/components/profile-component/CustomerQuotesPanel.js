import { renderQuotePdf } from '../../utils/quotePdf';
import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, onSnapshot, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { DESIGN_SYSTEM, getCardStyle } from '../../styles/designSystem';
import { useAuth } from '../../contexts/AuthContext';
import { logLeadEvent, recomputeAndSaveForCustomer } from '../../services/leadScoreService';

export default function CustomerQuotesPanel({ customerId, projects = [], customerProfile = {}, readOnly = false }) {
  const { currentUser } = useAuth();
  const [quotes, setQuotes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ client: '', validUntil: '', taxRate: 0, discount: 0, items: [], currency: '', fxBase: 'USD', fxRate: 1 });
  const [globalFxBase, setGlobalFxBase] = useState('USD');
  const [editingId, setEditingId] = useState(null);
  

  useEffect(() => {
    if (!customerId) { setQuotes([]); return; }
    const col = collection(db, 'customerProfiles', customerId, 'quotesDrafts');
    const unsub = onSnapshot(col, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(q => !q.projectId) // show only customer-level quotes, not ones linked to a project
        .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
      setQuotes(list);
    });
    return () => unsub();
  }, [customerId]);

  useEffect(() => {
    const loadBase = async () => {
      try {
        if (!currentUser?.uid) return;
        const ref = doc(db, 'users', currentUser.uid, 'settings', 'financeDefaults');
        const snap = await (await import('firebase/firestore')).getDoc(ref);
        if (snap.exists()) {
          const d = snap.data() || {};
          // Force base to USD for quote entry; inputs are in USD per requirement
          const b = 'USD';
          setGlobalFxBase((b).toUpperCase());
        }
      } catch {}
    };
    loadBase();
  }, [currentUser?.uid]);

  const subtotal = useMemo(() => (form.items || []).reduce((a,it)=> a + (Number(it.qty||0) * Number(it.unitPrice||0)), 0), [form.items]);

  const openNew = () => {
    const defaultTax = (customerProfile?.financeDefaults?.taxRate ?? customerProfile?.taxRate ?? 0);
    setForm({ client: customerProfile?.name || customerProfile?.email || '', validUntil: '', taxRate: defaultTax, discount: 0, items: [{ description: '', qty: 1, unitPrice: 0 }], currency: 'USD', fxBase: 'USD', fxRate: 1 });
    setEditingId(null);
    setShowModal(true);
  };

  const saveQuote = async () => {
    try {
      if (!customerId) return;
      const col = collection(db, 'customerProfiles', customerId, 'quotesDrafts');
      const items = (form.items || []).map(it => ({ description: it.description || '', qty: Number(it.qty||0), unitPrice: Number(it.unitPrice||0) }));
      // All inputs are in USD (base)
      const subtotalBase = items.reduce((a,it)=> a + (it.qty*it.unitPrice), 0);
      const taxRate = Number(form.taxRate || 0);
      const discountBase = Number(form.discount || 0);
      const taxAmountBase = subtotalBase * (taxRate / 100);
      const totalBase = subtotalBase + taxAmountBase - discountBase;
      const cur = (form.currency || 'USD').toUpperCase();
      const base = 'USD';
      const rate = Number(form.fxRate || 1);
      const isSame = cur === base;
      const toCurrency = (n) => isSame ? Number(n||0) : Number(n||0) * (rate || 1);
      // Store both converted (customer currency) and base (USD)
      const subtotal = toCurrency(subtotalBase);
      const taxAmount = toCurrency(taxAmountBase);
      const discount = toCurrency(discountBase);
      const total = toCurrency(totalBase);
      const payload = { client: form.client || '', validUntil: form.validUntil || '', taxRate, discount, items, subtotal, taxAmount, total, currency: (form.currency || undefined), fxBase: base, fxRate: Number(form.fxRate || 1), subtotalBase, taxAmountBase, discountBase, totalBase };
      if (editingId) {
        try {
          await (await import('firebase/firestore')).updateDoc(doc(db, 'customerProfiles', customerId, 'quotesDrafts', editingId), { ...payload, updatedAt: serverTimestamp() });
        } catch {}
      } else {
        await addDoc(col, { ...payload, status: 'draft', createdAt: serverTimestamp() });
        try {
          await logLeadEvent(customerId, 'quoteCreated', { totalBase, currency: (form.currency || 'USD').toUpperCase() });
          await recomputeAndSaveForCustomer({ userId: currentUser?.uid, customerId, companyProfile: {} });
        } catch {}
      }
      setShowModal(false);
      setEditingId(null);
    } catch {}
  };

  const removeDraft = async (q) => {
    try { await deleteDoc(doc(db, 'customerProfiles', customerId, 'quotesDrafts', q.id)); } catch {}
  };

  

  const printDraft = (q) => { try { renderQuotePdf(q, { title: 'Quotation' }); } catch {} };

  return (
    <div style={getCardStyle('customers')}>
      <div style={{
        background: DESIGN_SYSTEM.pageThemes.customers.gradient,
        color: DESIGN_SYSTEM.colors.text.inverse,
        padding: DESIGN_SYSTEM.spacing.base,
        borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{ margin: 0, fontSize: DESIGN_SYSTEM.typography.fontSize.lg, fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold }}>Customer Quotes (Drafts)</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {!readOnly && (
            <button onClick={openNew} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>+ New Quote</button>
          )}
        </div>
      </div>
      <div style={{ padding: DESIGN_SYSTEM.spacing.base }}>
        <div style={{ overflowX: 'auto' }}>
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 2fr) 140px 80px 180px 200px 240px', gap: 8, fontSize: 12, color: DESIGN_SYSTEM.colors.text.secondary, fontWeight: 600 }}>
              <div>Client</div>
              <div>Valid Until</div>
              <div>Tax %</div>
              <div>Discount (USD/Currency)</div>
              <div>Total (USD/Currency)</div>
              <div>Actions</div>
            </div>
            <div style={{ marginTop: 6 }}>
              {quotes.length === 0 ? (
                <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontStyle: 'italic' }}>No draft quotes</div>
              ) : (
                quotes.map((q) => (
                  <div key={q.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 2fr) 140px 80px 180px 200px 240px', gap: 8, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <div title={(q.client || 'Client')} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal' }}>{q.client || 'Client'}</div>
                    <div>{q.validUntil || '-'}</div>
                    <div>{Number(q.taxRate || 0).toFixed(2)}</div>
                    <div>{(() => { const base='USD'; const fxBase=(q.fxBase||base).toUpperCase(); const curRaw=(q.currency||''); const cur=(curRaw||base).toUpperCase(); const fmt=(n,c)=>{ try{return new Intl.NumberFormat(undefined,{style:'currency',currency:c}).format(Number(n||0));}catch{return `${c} ${Number(n||0).toFixed(2)}`;}}; const rate=Number(q.fxRate||0); const discCur=Number(q.discount||0); let discBase=(typeof q.discountBase==='number' && fxBase===base)?Number(q.discountBase):NaN; if(!Number.isFinite(discBase)){ if(cur===base){ discBase=discCur; } else if(fxBase===base && rate>0){ discBase=discCur/rate; } } if(!curRaw || cur===base){ return `${fmt(discBase, base)}`; } const discInCur = Number.isFinite(discCur) ? discCur : (Number.isFinite(discBase) && rate>0 ? discBase*rate : discBase); return `${fmt(discBase, base)}  •  ${fmt(discInCur, cur)}`; })()}</div>
                    <div>{(() => { const base='USD'; const fxBase=(q.fxBase||base).toUpperCase(); const curRaw=(q.currency||''); const cur=(curRaw||base).toUpperCase(); const fmt=(n,c)=>{ try{return new Intl.NumberFormat(undefined,{style:'currency',currency:c}).format(Number(n||0));}catch{return `${c} ${Number(n||0).toFixed(2)}`;}}; const rate=Number(q.fxRate||0); const totCur=Number(q.total||0); let totBase=(typeof q.totalBase==='number' && fxBase===base)?Number(q.totalBase):NaN; if(!Number.isFinite(totBase)){ if(cur===base){ totBase=totCur; } else if(fxBase===base && rate>0){ totBase=totCur/rate; } } if(!curRaw || cur===base){ return `${fmt(totBase, base)}`; } const totInCur = Number.isFinite(totCur) ? totCur : (Number.isFinite(totBase) && rate>0 ? totBase*rate : totBase); return `${fmt(totBase, base)}  •  ${fmt(totInCur, cur)}`; })()}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => printDraft(q)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Print</button>
                      {!readOnly && (
                        <>
                          <button onClick={() => { setEditingId(q.id); setForm({ client: q.client || '', validUntil: q.validUntil || '', taxRate: Number(q.taxRate||0), discount: Number(q.discountBase ?? q.discount ?? 0), items: Array.isArray(q.items) ? q.items.map(it => ({ description: it.description||'', qty: Number(it.qty||0), unitPrice: Number(it.unitPrice||0) })) : [], currency: (q.currency || ''), fxBase: (q.fxBase || 'USD'), fxRate: Number(q.fxRate || 1) }); setShowModal(true); }} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Edit</button>
                          <button onClick={() => removeDraft(q)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Delete</button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {showModal && !readOnly && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }} onClick={() => { setShowModal(false); setEditingId(null); }}>
          <div onClick={(e)=>e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: '92%', maxWidth: 640, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>{editingId ? 'Edit Quote' : 'New Quote'}</div>
              <button onClick={() => { setShowModal(false); setEditingId(null); }} style={{ padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 12 }}>Close</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 140px 140px', gap: 8 }}>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280' }}>
                <span style={{ marginBottom: 4 }}>Client</span>
                <input value={form.client} onChange={(e)=> setForm(f=>({ ...f, client: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280' }}>
                <span style={{ marginBottom: 4 }}>Valid Until</span>
                <input type="date" value={form.validUntil} onChange={(e)=> setForm(f=>({ ...f, validUntil: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280' }}>
                <span style={{ marginBottom: 4 }}>Tax Rate %</span>
                <input type="number" step="0.01" value={form.taxRate} onChange={(e)=> setForm(f=>({ ...f, taxRate: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280' }}>
                <span style={{ marginBottom: 4 }}>Discount</span>
                <input type="number" step="0.01" value={form.discount} onChange={(e)=> setForm(f=>({ ...f, discount: e.target.value }))} />
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280' }}>
                <span style={{ marginBottom: 4 }}>Currency (ISO)</span>
                <select value={form.currency} onChange={(e)=> setForm(f=>({ ...f, currency: (e.target.value||'').toUpperCase() }))}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="MYR">MYR</option>
                  <option value="SGD">SGD</option>
                  <option value="AUD">AUD</option>
                  <option value="CAD">CAD</option>
                  <option value="JPY">JPY</option>
                  <option value="CNY">CNY</option>
                  <option value="INR">INR</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280' }}>
                <span style={{ marginBottom: 4 }}>FX Rate (USD → Currency)</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="number" step="0.0001" value={form.fxRate} onChange={(e)=> setForm(f=>({ ...f, fxRate: e.target.value }))} placeholder="1.0" />
                  <button onClick={async () => {
                    try {
                      const base = 'USD';
                      const cur = (form.currency || 'USD').toUpperCase();
                      const resp = await fetch(`https://api.exchangerate.host/latest?base=${encodeURIComponent(base)}&api_key=eb803299bef64dc80de605049727ccf4`);
                      const data = await resp.json();
                      if (data && data.rates && data.rates[cur] != null) setForm(f => ({ ...f, fxRate: Number(data.rates[cur]) }));
                    } catch {}
                  }} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Fetch Rate</button>
                </div>
              </label>
            </div>
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
                  <input value={it.description || ''} onChange={(e)=> setForm(f=>{ const items=[...(f.items||[])]; items[idx]={ ...items[idx], description: e.target.value }; return { ...f, items }; })} />
                  <input type="number" step="1" value={it.qty ?? ''} onChange={(e)=> setForm(f=>{ const items=[...(f.items||[])]; items[idx]={ ...items[idx], qty: e.target.value }; return { ...f, items }; })} />
                  <input type="number" step="0.01" value={it.unitPrice ?? ''} onChange={(e)=> setForm(f=>{ const items=[...(f.items||[])]; items[idx]={ ...items[idx], unitPrice: e.target.value }; return { ...f, items }; })} />
                  <button onClick={()=> setForm(f=>{ const items=[...(f.items||[])]; items.splice(idx,1); return { ...f, items }; })} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Remove</button>
                </div>
              ))}
              <div style={{ marginTop: 8 }}>
                <button onClick={()=> setForm(f=>({ ...f, items: [...(f.items||[]), { description: '', qty: 1, unitPrice: 0 }] }))} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>+ Add Item</button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 12, fontSize: 12, color: '#374151' }}>
              {(() => {
                // Compute in USD (base) from inputs
                const base = 'USD';
                const curRaw = (form.currency || '');
                const cur = (curRaw || 'USD').toUpperCase();
                const tax = subtotal * (Number(form.taxRate||0)/100);
                const discount = Number(form.discount||0);
                const total = subtotal + tax - discount;
                const rate = Number(form.fxRate || 1);
                const isSame = (cur === base.toUpperCase());
                const toCurrency = (n) => isSame ? Number(n||0) : Number(n||0) * (rate || 1);
                const fmt = (n,c) => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(Number(n||0)); } catch { return `${c} ${Number(n||0).toFixed(2)}`; } };
                return (
                  <>
                    <div>Subtotal: {fmt(subtotal, base)}</div>
                    <div>Tax: {fmt(tax, base)}</div>
                    <div>Discount: {fmt(discount, base)}</div>
                    <div style={{ fontWeight: 700, color: '#111827' }}>
                      Total: {fmt(total, base)}{(!curRaw || isSame) ? '' : ` (${fmt(toCurrency(total), cur)})`}
                    </div>
                  </>
                );
              })()}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button onClick={saveQuote} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


