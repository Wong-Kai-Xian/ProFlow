import React, { useEffect, useRef } from 'react';
import { COLORS, LAYOUT, BUTTON_STYLES } from '../profile-component/constants';

export default function StageIndicator({ currentStage, allStages, onAdvanceStage, onGoBackStage, isCurrentStageTasksComplete, onStageSelect, canAdvance, editing = false, onAddStage, onDeleteStageAt, onRenameStage, onMoveStageLeft, onMoveStageRight, isStageApprovalPending = false }) {
  const currentStageIndex = allStages.indexOf(currentStage);
  const isLastStage = currentStageIndex === allStages.length - 1;
  const rowRef = useRef(null);

  // Auto-scroll to the latest stage only when a new stage is added in edit mode
  const prevLenRef = useRef(allStages.length);
  useEffect(() => {
    const prevLen = prevLenRef.current;
    if (editing && rowRef.current && allStages.length > prevLen) {
      try { rowRef.current.scrollLeft = rowRef.current.scrollWidth; } catch {}
    }
    prevLenRef.current = allStages.length;
  }, [allStages.length, editing]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column", // Stack content vertically
      alignItems: "center", // Center horizontally
      background: COLORS.cardBackground,
      padding: LAYOUT.gap,
      borderRadius: LAYOUT.borderRadius,
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      marginBottom: 0,
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      overflowX: 'hidden',
      boxSizing: 'border-box',
      paddingBottom: 8
    }}>
      <div ref={rowRef} style={{
        display: "flex",
        justifyContent: editing ? "flex-start" : "space-between",
        alignItems: "center",
        width: "100%",
        overflowX: editing ? 'auto' : 'hidden',
        flexWrap: 'nowrap',
        minWidth: 0,
        gap: editing ? 12 : 0,
        marginBottom: LAYOUT.smallGap, // Space between indicators and button
      }}>
        {allStages.map((stage, index) => {
          const isActive = stage === currentStage;
          const isCompleted = allStages.indexOf(currentStage) > index;

          const circleStyle = {
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: isCompleted ? COLORS.success : (isActive ? COLORS.primary : COLORS.lightBorder),
            color: isCompleted || isActive ? COLORS.white : COLORS.text,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontWeight: "bold",
            fontSize: "14px",
            border: `2px solid ${isActive ? COLORS.primary : COLORS.border}`,
            transition: "all 0.3s ease-in-out",
            position: "relative",
            zIndex: 1,
            cursor: 'default',
          };

          const labelStyle = {
            marginTop: LAYOUT.smallGap,
            fontSize: "12px",
            color: isActive ? COLORS.primary : COLORS.text,
            fontWeight: isActive ? "bold" : "normal",
            textAlign: "center",
          };

          const lineStyle = editing ? {
            width: 32,
            height: 2,
            background: isCompleted ? COLORS.success : COLORS.border,
            zIndex: 0,
            flex: '0 0 auto'
          } : {
            flex: 1,
            height: 2,
            background: isCompleted ? COLORS.success : COLORS.border,
            zIndex: 0,
          };

          return (
            <React.Fragment key={index}>
              {index > 0 && <div style={lineStyle}></div>}
              <div 
                style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 220 }}
              >
                <div style={circleStyle} title={isActive ? 'Current Stage' : (isCompleted ? 'Completed' : 'Upcoming')}>
                  {index + 1}
                </div>
                {editing ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <button onClick={() => onMoveStageLeft && onMoveStageLeft(index)} disabled={index === 0} style={{ ...BUTTON_STYLES.secondary, padding: '2px 6px', fontSize: 12 }}>{'◀'}</button>
                    <input
                      value={stage}
                      onChange={(e) => onRenameStage && onRenameStage(index, e.target.value)}
                      style={{ 
                        ...labelStyle, 
                        border: '1px solid #e5e7eb', background: '#fff', textAlign: 'center', width: 120, outline: 'none', borderRadius: 4, padding: '2px 4px'
                      }}
                    />
                    <button onClick={() => onMoveStageRight && onMoveStageRight(index)} disabled={index === allStages.length - 1} style={{ ...BUTTON_STYLES.secondary, padding: '2px 6px', fontSize: 12 }}>{'▶'}</button>
                    <button onClick={() => onDeleteStageAt && onDeleteStageAt(index)} style={{ ...BUTTON_STYLES.secondary, padding: '2px 6px', fontSize: 12, color: '#b91c1c', background: '#fee2e2' }}>{'✕'}</button>
                  </div>
                ) : (
                  <div style={labelStyle}>{stage}</div>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>
      {editing && (
        <div style={{ display: 'flex', gap: LAYOUT.smallGap, width: '100%', marginBottom: LAYOUT.smallGap }}>
          {onAddStage && <button onClick={onAddStage} style={{ ...BUTTON_STYLES.secondary, flex: 1 }}>Add Stage</button>}
        </div>
      )}
      {!editing && (
        <div style={{ display: 'flex', gap: LAYOUT.smallGap, width: '100%', marginTop: LAYOUT.smallGap }}>
          {currentStageIndex > 0 && (
            <button
              onClick={onGoBackStage}
              title="Go back to previous stage"
              style={{ ...BUTTON_STYLES.secondary, padding: '6px 10px' }}
            >
              ◀
            </button>
          )}
          {currentStageIndex < allStages.length - 1 && (
            <button 
              onClick={onAdvanceStage}
              style={{
                ...BUTTON_STYLES.primary,
                flex: 1,
                opacity: canAdvance ? 1 : 0.5,
                cursor: canAdvance ? 'pointer' : 'not-allowed'
              }}
              disabled={!canAdvance}
            >
              {isStageApprovalPending ? 'Pending Approval' : 'Get Approval & Advance Stage'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
