import React, { useState } from 'react';
import { COLORS, BUTTON_STYLES, INPUT_STYLES, LAYOUT } from '../profile-component/constants';

export default function AdvanceStageChoiceModal({ isOpen, onClose, onChoose }) {
  const [requireApproval, setRequireApproval] = useState(true);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        background: '#fff', borderRadius: '10px', padding: '20px', width: '90%', maxWidth: '480px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)'
      }}>
        <h3 style={{ margin: 0, color: COLORS.dark }}>Advance Stage</h3>
        <p style={{ color: COLORS.lightText, fontSize: '14px', marginTop: '8px' }}>Choose whether this stage transition requires approval.</p>

        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input id="requireApproval" type="checkbox" checked={requireApproval} onChange={(e) => setRequireApproval(e.target.checked)} />
          <label htmlFor="requireApproval" style={{ color: COLORS.text, fontSize: '14px' }}>Require approval from team members</label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <button onClick={onClose} style={{ ...BUTTON_STYLES.secondary }}>Cancel</button>
          <button onClick={() => onChoose(requireApproval)} style={{ ...BUTTON_STYLES.primary }}>Continue</button>
        </div>
      </div>
    </div>
  );
}


