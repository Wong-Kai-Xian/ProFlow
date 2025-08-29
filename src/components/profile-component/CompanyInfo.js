// src/components/profile-component/CompanyInfo.js
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from 'react-dom';
import Card from "./Card";
import { BUTTON_STYLES, INPUT_STYLES } from "./constants"; // Import BUTTON_STYLES and INPUT_STYLES
import { COLORS } from "./constants"; // Import COLORS
import MapPickerModal from './MapPickerModal';

export default function CompanyInfo({ data, setCompanyProfile, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState(data);
  const [companySuggestions, setCompanySuggestions] = useState([]);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showMap, setShowMap] = useState(false);
  const [industryOpen, setIndustryOpen] = useState(false);
  const debounceRef = useRef(0);
  const companyInputRef = useRef(null);
  const locationInputRef = useRef(null);
  const industryDropdownRef = useRef(null);
  const [companyMenuPos, setCompanyMenuPos] = useState({ top: 0, left: 0, width: 0 });
  const [locationMenuPos, setLocationMenuPos] = useState({ top: 0, left: 0, width: 0 });
  const companyMenuRef = useRef(null);
  const locationMenuRef = useRef(null);

  // Industry options from lead score settings
  const INDUSTRY_OPTIONS = [
    'Construction','Manufacturing','Technology','Healthcare','Retail','Real Estate','Education','Finance','Logistics','Hospitality','Energy','Consulting'
  ];

  useEffect(() => { setEditedData(data || {}); }, [data]);

  const handleEditToggle = () => {
    if (isEditing) {
      setCompanyProfile(editedData);
      if (typeof onSave === "function") {
        onSave(editedData);
      }
    }
    setIsEditing(!isEditing);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditedData(prevData => ({
      ...prevData,
      [name]: value
    }));

    if (name === 'company') {
      const q = String(value || '').trim();
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(async () => {
        if (!q) { setCompanySuggestions([]); return; }
        try {
          // Use Nominatim search to find company/place by name
          const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&addressdetails=1&limit=5&accept-language=en`;
          const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
          const json = await res.json();
          setCompanySuggestions(Array.isArray(json) ? json : []);
          try {
            const r = companyInputRef.current?.getBoundingClientRect?.();
            if (r) setCompanyMenuPos({ top: Math.round(r.bottom + 4), left: Math.round(r.left), width: Math.round(r.width) });
          } catch {}
        } catch { setCompanySuggestions([]); }
      }, 350);
    }

    if (name === 'location') {
      const q = String(value || '').trim();
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(async () => {
        if (!q) { setLocationSuggestions([]); return; }
        try {
          const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&addressdetails=1&limit=5&accept-language=en`;
          const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
          const json = await res.json();
          setLocationSuggestions(Array.isArray(json) ? json : []);
          try {
            const r = locationInputRef.current?.getBoundingClientRect?.();
            if (r) setLocationMenuPos({ top: Math.round(r.bottom + 4), left: Math.round(r.left), width: Math.round(r.width) });
          } catch {}
        } catch { setLocationSuggestions([]); }
      }, 300);
    }
  };

  const handleIndustrySelect = (industry) => {
    setEditedData(prevData => ({
      ...prevData,
      industry: industry
    }));
    setIndustryOpen(false);
  };

  useEffect(() => {
    const onScrollOrResize = () => {
      try {
        if (companySuggestions.length && companyInputRef.current) {
          const r = companyInputRef.current.getBoundingClientRect();
          setCompanyMenuPos({ top: Math.round(r.bottom + 4), left: Math.round(r.left), width: Math.round(r.width) });
        }
        if (locationSuggestions.length && locationInputRef.current) {
          const r2 = locationInputRef.current.getBoundingClientRect();
          setLocationMenuPos({ top: Math.round(r2.bottom + 4), left: Math.round(r2.left), width: Math.round(r2.width) });
        }
      } catch {}
    };
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize, true);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize, true);
    };
  }, [companySuggestions.length, locationSuggestions.length]);

  useEffect(() => {
    const onDocMouseDown = (e) => {
      const t = e.target;
      if (companyInputRef.current && companyInputRef.current.contains(t)) return;
      if (locationInputRef.current && locationInputRef.current.contains(t)) return;
      if (companyMenuRef.current && companyMenuRef.current.contains(t)) return;
      if (locationMenuRef.current && locationMenuRef.current.contains(t)) return;
      if (industryDropdownRef.current && industryDropdownRef.current.contains(t)) return;
      setCompanySuggestions([]);
      setLocationSuggestions([]);
      setIndustryOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown, true);
    return () => document.removeEventListener('mousedown', onDocMouseDown, true);
  }, []);

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <h3>Company Profile</h3>
        <button
          onClick={handleEditToggle}
          style={{
            ...BUTTON_STYLES.primary,
            background: isEditing ? COLORS.success : BUTTON_STYLES.primary.background, // Change color to green when saving
            padding: "5px 10px",
            fontSize: "12px"
          }}
        >
          {isEditing ? "Save" : "Edit"}
        </button>
      </div>
      {
        isEditing ? (
          <div>
            <p style={{ position: 'relative' }}>
              <strong>Company:</strong> <input ref={companyInputRef} type="text" name="company" value={editedData.company} onChange={handleChange} style={{ ...INPUT_STYLES.base, width: "calc(100% - 70px)" }} />
              {companySuggestions.length > 0 && createPortal(
                <div ref={companyMenuRef} style={{ position: 'fixed', top: companyMenuPos.top, left: companyMenuPos.left, width: companyMenuPos.width, zIndex: 2147483647, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, marginTop: 0, maxHeight: 240, overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.12)' }}>
                  {companySuggestions.map((s, idx) => (
                    <div key={`${s.place_id}_${idx}`} onMouseDown={(e) => { e.preventDefault();
                      setEditedData(prev => ({
                        ...prev,
                        company: prev.company || s.display_name?.split(',')[0] || '',
                        location: s.display_name || prev.location,
                        lat: s.lat,
                        lon: s.lon,
                      }));
                      setCompanySuggestions([]);
                    }} style={{ padding: 10, cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{s.display_name?.split(',')[0] || s.display_name}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{s.display_name}</div>
                    </div>
                  ))}
                </div>, document.body
              )}
            </p>
            <p style={{ position: 'relative' }}>
              <strong>Industry:</strong>
              <div ref={industryDropdownRef} style={{ display: 'inline-block', position: 'relative' }}>
                <div onClick={() => setIndustryOpen(v => !v)} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', background: '#fff', width: 'calc(100% - 70px)', display: 'inline-block' }}>
                  {editedData.industry || 'Select industry...'}
                </div>
                {industryOpen && (
                  <div style={{ position: 'absolute', zIndex: 10, top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, marginTop: 4, maxHeight: 220, overflow: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
                    {INDUSTRY_OPTIONS.map(opt => (
                      <div key={opt} onClick={() => handleIndustrySelect(opt)} style={{ padding: 8, cursor: 'pointer', borderBottom: '1px solid #f3f4f6', color: editedData.industry === opt ? '#2563eb' : '#374151' }}>
                        {opt}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </p>
            <p style={{ position: 'relative' }}>
              <strong>Location:</strong>
              <input ref={locationInputRef} type="text" name="location" value={editedData.location} onChange={handleChange} style={{ ...INPUT_STYLES.base, width: "calc(100% - 70px)" }} />
              <button onClick={(e) => { e.preventDefault(); setShowMap(true); }} style={{ ...BUTTON_STYLES.secondary, marginLeft: 8 }}>Pick on Map</button>
              {locationSuggestions.length > 0 && createPortal(
                <div ref={locationMenuRef} style={{ position: 'fixed', top: locationMenuPos.top, left: locationMenuPos.left, width: Math.max(200, locationMenuPos.width - 110), zIndex: 2147483647, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, marginTop: 0, maxHeight: 240, overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.12)' }}>
                  {locationSuggestions.map((s, idx) => (
                    <div key={`${s.place_id}_${idx}`} onMouseDown={(e) => { e.preventDefault();
                      setEditedData(prev => ({
                        ...prev,
                        location: s.display_name || prev.location,
                        lat: s.lat,
                        lon: s.lon,
                      }));
                      setLocationSuggestions([]);
                    }} style={{ padding: 10, cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{s.display_name?.split(',')[0] || s.display_name}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{s.display_name}</div>
                    </div>
                  ))}
                </div>, document.body
              )}
            </p>
          </div>
        ) : (
          <div>
            <p><strong>Company:</strong> {data.company}</p>
            <p><strong>Industry:</strong> {data.industry}</p>
            <p><strong>Location:</strong> {data.location}</p>
          </div>
        )
      }

      <MapPickerModal
        isOpen={showMap}
        onClose={() => setShowMap(false)}
        onSelect={({ lat, lon, address }) => {
          setShowMap(false);
          setEditedData(prev => ({ ...prev, lat, lon, location: address || prev.location }));
        }}
        initialLat={editedData?.lat}
        initialLon={editedData?.lon}
      />
    </Card>
  );
}
