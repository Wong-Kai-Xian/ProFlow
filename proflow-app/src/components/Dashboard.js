import React, { useEffect, useState } from "react";

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    // Call your online API here
    fetch("https://api.example.com/dashboard")
      .then(res => res.json())
      .then(data => setData(data));
  }, []);

  return (
    <div style={{ background: '#ECF0F1', padding: '20px', borderRadius: '10px', height: '100%' }}>
      <h2>Company Dashboard</h2>
      {data ? <pre>{JSON.stringify(data, null, 2)}</pre> : <p>Loading...</p>}
    </div>
  );
}
