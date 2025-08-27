// src/components/profile-component/MapPickerModal.js
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BUTTON_STYLES } from './constants';

function ensureLeafletLoaded() {
  return new Promise((resolve, reject) => {
    try {
      if (window.L) return resolve();
      // CSS
      if (!document.querySelector('link[data-leaflet]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.setAttribute('data-leaflet', '1');
        document.head.appendChild(link);
      }
      // JS
      const existing = document.querySelector('script[data-leaflet]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.defer = true;
      script.setAttribute('data-leaflet', '1');
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Leaflet'));
      document.body.appendChild(script);
    } catch (e) { reject(e); }
  });
}

export default function MapPickerModal({ isOpen, onClose, onSelect, initialLat, initialLon }) {
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markerRef = useRef(null);
  const [picked, setPicked] = useState({ lat: initialLat, lon: initialLon, address: '' });
  const [loadingAddr, setLoadingAddr] = useState(false);

  useEffect(() => { setPicked({ lat: initialLat, lon: initialLon, address: '' }); }, [initialLat, initialLon]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      await ensureLeafletLoaded();
      if (cancelled) return;
      const L = window.L;
      if (leafletMapRef.current) {
        try { leafletMapRef.current.remove(); } catch {}
        leafletMapRef.current = null;
      }
      const center = (initialLat && initialLon) ? [Number(initialLat), Number(initialLon)] : [3.139, 101.6869]; // Default KL
      const map = L.map(mapRef.current).setView(center, 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      const mk = L.marker(center, { draggable: true }).addTo(map);
      markerRef.current = mk;
      leafletMapRef.current = map;

      const updatePicked = async (latlng) => {
        const { lat, lng } = latlng;
        setPicked(p => ({ ...p, lat, lon: lng }));
        try {
          setLoadingAddr(true);
          const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
          const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
          const json = await res.json();
          setPicked(p => ({ ...p, address: json?.display_name || '' }));
        } catch { } finally { setLoadingAddr(false); }
      };

      mk.on('dragend', () => {
        const ll = mk.getLatLng();
        updatePicked(ll);
      });
      map.on('click', (e) => {
        const ll = e.latlng;
        mk.setLatLng(ll);
        updatePicked(ll);
      });

      // Initial reverse if coords present
      if (initialLat && initialLon) {
        updatePicked({ lat: Number(initialLat), lng: Number(initialLon) });
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, initialLat, initialLon]);

  if (!isOpen) return null;
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100000000 }}>
      <div style={{ width: '92%', maxWidth: 900, background: '#fff', borderRadius: 12, boxShadow: '0 20px 40px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontWeight: 700 }}>Pick Location</div>
          <button onClick={onClose} style={{ ...BUTTON_STYLES.secondary }}>Close</button>
        </div>
        <div style={{ height: 480 }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        </div>
        <div style={{ padding: 12, borderTop: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ color: '#374151', fontSize: 13 }}>
            <div><strong>Lat/Lon:</strong> {picked.lat ? `${picked.lat.toFixed?.(6)}` : '-'}, {picked.lon ? `${picked.lon.toFixed?.(6)}` : '-'}</div>
            <div style={{ marginTop: 4 }}><strong>Address:</strong> {loadingAddr ? 'Resolving…' : (picked.address || '-')}</div>
          </div>
          <button
            onClick={() => onSelect && onSelect({ lat: picked.lat, lon: picked.lon, address: picked.address })}
            style={{ ...BUTTON_STYLES.primary }}
            disabled={!picked.lat || !picked.lon}
          >Use this location</button>
        </div>
      </div>
    </div>,
    document.body
  );
}


