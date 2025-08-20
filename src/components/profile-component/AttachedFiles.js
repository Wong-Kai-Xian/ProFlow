// src/components/profile-component/AttachedFiles.js
import React from "react";
import { Card } from "../../pages/CustomerProfile";

export default function AttachedFiles({ files }) {
  return (
    <Card style={{ minHeight: "300px", padding: "20px" }}>
    <h3 style={{ fontSize: "18px" }}>Attached Files</h3>
    <ul style={{ marginTop: "10px", maxHeight: "150px", overflowY: "auto", fontSize: "14px" }}>
        {files.map((file, i) => (
        <li key={i} style={{ padding: "10px", borderBottom: "1px solid #eee" }}>
            📎 {file}
        </li>
        ))}
    </ul>
    </Card>
  );
}
