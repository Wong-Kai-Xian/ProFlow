import React, { useRef, useEffect, useState, useCallback } from 'react';
import { COLORS, BUTTON_STYLES } from './profile-component/constants';

export default function SignaturePad({
  onSave,
  width = 300,
  height = 150,
  penColor = "#000000",
  backgroundColor = "#FFFFFF"
}) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState(null);

  const startDrawing = useCallback((e) => {
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    setIsDrawing(true);
  }, [ctx]);

  const draw = useCallback((e) => {
    if (!isDrawing || !ctx) return;
    ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    ctx.stroke();
  }, [isDrawing, ctx]);

  const endDrawing = useCallback(() => {
    if (!ctx) return;
    ctx.closePath();
    setIsDrawing(false);
  }, [ctx]);

  const clearSignature = useCallback(() => {
    if (ctx) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, [ctx]);

  const saveSignature = useCallback(() => {
    if (canvasRef.current) {
      const dataURL = canvasRef.current.toDataURL(); // Get data URL of the signature
      onSave(dataURL);
    }
  }, [onSave]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext('2d');
      if (context) {
        setCtx(context);
        context.lineWidth = 2;
        context.lineCap = 'round';
        context.strokeStyle = penColor;
        context.fillStyle = backgroundColor;
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [penColor, backgroundColor]);

  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: "5px", overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={endDrawing}
        onMouseOut={endDrawing}
        style={{ display: "block", backgroundColor: backgroundColor }}
      />
      <div style={{ display: "flex", justifyContent: "space-around", padding: "10px", background: COLORS.light }}>
        <button
          onClick={clearSignature}
          style={{ ...BUTTON_STYLES.secondary, padding: "8px 15px", fontSize: "13px" }}
        >
          Clear
        </button>
        <button
          onClick={saveSignature}
          style={{ ...BUTTON_STYLES.primary, padding: "8px 15px", fontSize: "13px" }}
        >
          Save Signature
        </button>
      </div>
    </div>
  );
}
