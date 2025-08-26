import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { DESIGN_SYSTEM, getCardStyle, getButtonStyle } from '../../styles/designSystem';

export default function ProjectQuotesPanel({ projectId, hideConvert = false }) {
  const [quotes, setQuotes] = useState([]);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    if (!projectId) { setQuotes([]); return; }
    const col = collection(db, 'projects', projectId, 'quotes');
    const unsub = onSnapshot(col, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
      setQuotes(list);
    });
    return () => unsub();
  }, [projectId]);

  const printQuote = (q) => {
    try {
      const items = Array.isArray(q.items) ? q.items : [];
      const subtotal = items.reduce((a,it)=> a + (Number(it.qty||0) * Number(it.unitPrice||0)), 0);
      const taxRate = Number(q.taxRate || 0);
      const discount = Number(q.discount || 0);
      const taxAmount = subtotal * (taxRate / 100);
      const total = Number((q.total ?? (subtotal + taxAmount - discount)) || 0);
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
            <div class="muted">Project Quote</div>
          </div>
          <div class="muted">
            <div>Client: ${q.client || ''}</div>
            <div>Valid Until: ${q.validUntil || '-'}</div>
            <div>Tax Rate: ${taxRate.toFixed(2)}%</div>
            <div>Discount: ${discount.toFixed(2)}</div>
          </div>
        </div>
        <table>
          <thead><tr><th>Description</th><th style="width:120px">Qty</th><th style="width:140px">Unit Price</th><th style="width:140px">Amount</th></tr></thead>
          <tbody>
            ${items.map(it => `<tr><td>${(it.description||'').replace(/</g,'&lt;')}</td><td>${Number(it.qty||0)}</td><td>${Number(it.unitPrice||0).toFixed(2)}</td><td>${(Number(it.qty||0)*Number(it.unitPrice||0)).toFixed(2)}</td></tr>`).join('')}
            <tr><td colspan="3" class="total">Subtotal</td><td class="total">${subtotal.toFixed(2)}</td></tr>
            <tr><td colspan="3" class="total">Tax (${taxRate.toFixed(2)}%)</td><td class="total">${taxAmount.toFixed(2)}</td></tr>
            <tr><td colspan="3" class="total">Discount</td><td class="total">${discount.toFixed(2)}</td></tr>
            <tr><td colspan="3" class="total">Total</td><td class="total">${total.toFixed(2)}</td></tr>
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

  const convertToInvoice = async (q) => {
    try {
      const items = Array.isArray(q.items) ? q.items.map(it => ({
        description: it.description || '',
        qty: Number(it.qty || 0),
        unitPrice: Number(it.unitPrice || 0)
      })) : [];
      const subtotal = items.reduce((a, it) => a + (it.qty * it.unitPrice), 0);
      const taxRate = Number(q.taxRate || 0);
      const taxAmount = subtotal * (taxRate / 100);
      const discount = Number(q.discount || 0);
      const total = subtotal + taxAmount - discount;

      const invRef = await addDoc(collection(db, 'projects', projectId, 'invoices'), {
        client: q.client || '',
        dueDate: q.validUntil || '',
        items,
        subtotal,
        taxRate,
        taxAmount,
        discount,
        total: Number((q.total ?? total) || 0),
        status: 'unpaid',
        notes: 'Created from quote',
        createdAt: serverTimestamp()
      });
      try { await updateDoc(doc(db, 'projects', projectId, 'quotes', q.id), { status: 'converted', convertedAt: serverTimestamp(), convertedToInvoiceId: invRef.id }); } catch {}
      // Pop-out toast notification
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { id, message: 'Invoice created from quote.', tone: 'success' }]);
      setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)); }, 3000);
    } catch {
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { id, message: 'Failed to convert to invoice.', tone: 'error' }]);
      setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)); }, 3500);
    }
  };

  return (
    <div style={getCardStyle('projects')}> 
      <div style={{
        background: DESIGN_SYSTEM.pageThemes.projects.gradient,
        color: DESIGN_SYSTEM.colors.text.inverse,
        padding: DESIGN_SYSTEM.spacing.base,
        borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`
      }}>
        <h3 style={{ margin: 0, fontSize: DESIGN_SYSTEM.typography.fontSize.lg, fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold }}>
          Quotes
        </h3>
      </div>
      <div style={{ padding: DESIGN_SYSTEM.spacing.base }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 80px 100px 100px 220px', gap: 8, fontSize: 12, color: DESIGN_SYSTEM.colors.text.secondary, fontWeight: 600 }}>
          <div>Client</div>
          <div>Valid Until</div>
          <div>Tax %</div>
          <div>Discount</div>
          <div>Total</div>
          <div>Actions</div>
        </div>
        <div style={{ marginTop: 6 }}>
          {quotes.length === 0 ? (
            <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontStyle: 'italic' }}>No quotes yet</div>
          ) : (
            quotes.map((q) => (
              <div key={q.id} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 80px 100px 100px 220px', gap: 8, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.client || 'Client'}</div>
                <div>{q.validUntil || '-'}</div>
                <div>{Number(q.taxRate || 0).toFixed(2)}</div>
                <div>{Number(q.discount || 0).toFixed(2)}</div>
                <div>{Number(q.total||0).toFixed(2)}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button onClick={() => printQuote(q)} style={{ ...getButtonStyle('secondary', 'projects'), padding: '6px 10px', fontSize: 12 }}>Print</button>
                  {!hideConvert && (
                    <button disabled={q.status === 'converted'} onClick={() => convertToInvoice(q)} style={{ ...getButtonStyle('primary', 'projects'), padding: '6px 10px', fontSize: 12, opacity: q.status === 'converted' ? 0.6 : 1, cursor: q.status === 'converted' ? 'not-allowed' : 'pointer' }}>{q.status === 'converted' ? 'Converted' : 'Convert to Invoice'}</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {/* Toasts */}
      {toasts.length > 0 && (
        <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 3500, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {toasts.map(t => (
            <div key={t.id} style={{
              minWidth: 220,
              maxWidth: 360,
              padding: '10px 12px',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              background: t.tone === 'success' ? '#ECFDF5' : '#FEF2F2',
              color: t.tone === 'success' ? '#065F46' : '#991B1B',
              border: `1px solid ${t.tone === 'success' ? '#A7F3D0' : '#FECACA'}`,
              fontSize: 13
            }}>
              {t.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

