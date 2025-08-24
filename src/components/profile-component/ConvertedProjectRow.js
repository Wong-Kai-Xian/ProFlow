import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../firebase';
import { doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { DESIGN_SYSTEM } from '../../styles/designSystem';

export default function ConvertedProjectRow({ projectId, customerId, onDeleted }) {
  const [project, setProject] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ref = doc(db, 'projects', projectId);
        const snap = await getDoc(ref);
        if (!mounted) return;
        if (snap.exists()) {
          const data = snap.data();
          setProject({ id: snap.id, name: data.name || 'Untitled Project', stage: data.stage || 'N/A', description: data.description || '' });
        } else {
          setProject({ id: projectId, name: 'Project not found', stage: 'N/A' });
        }
      } catch (e) {
        if (!mounted) return;
        setError('Failed to load project');
      }
    })();
    return () => { mounted = false; };
  }, [projectId]);

  if (error) {
    return <div style={{ color: DESIGN_SYSTEM.colors.error }}>{error}</div>;
  }

  if (!project) {
    return <div style={{ color: DESIGN_SYSTEM.colors.text.secondary }}>Loading…</div>;
  }

  const handleDelete = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!customerId) return;
    try {
      await updateDoc(doc(db, 'customerProfiles', customerId), { projects: arrayRemove(projectId) });
      onDeleted && onDeleted(projectId);
    } catch (err) {
      console.error('Failed to remove project from customer', err);
      alert('Failed to remove project link');
    }
  };

  return (
    <Link to={`/project/${project.id}`} style={{ textDecoration: 'none' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        border: `1px solid ${DESIGN_SYSTEM.colors.border}`,
        borderRadius: 8,
        background: '#fff',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease'
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = DESIGN_SYSTEM.shadows.sm; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontWeight: 700, color: DESIGN_SYSTEM.colors.text.primary }}>{project.name}</div>
          <div style={{ fontSize: 12, color: DESIGN_SYSTEM.colors.text.secondary }}>Stage: {project.stage}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 12, color: DESIGN_SYSTEM.colors.primary[600], fontWeight: 700 }}>View →</div>
          {customerId && (
            <button
              onClick={handleDelete}
              style={{
                border: `1px solid ${DESIGN_SYSTEM.colors.border}`,
                background: '#fee2e2',
                color: '#b91c1c',
                padding: '2px 6px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12
              }}
              title="Remove from Converted Projects"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}


