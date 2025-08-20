// src/components/profile-component/AttachedFiles.js
import React from "react";
import Card from "./Card";

export default function AttachedFiles({ files }) {
  return (
    <Card style={{ minHeight: "180px" }}>
      <h3>Attached Files</h3>
      <ul style={{ 
        marginTop: "10px", 
        maxHeight: "120px", 
        overflowY: "auto",
        listStyle: "none",
        padding: 0
      }}>
        {files.map((file, i) => (
          <li key={i} style={{ 
            padding: "8px", 
            borderBottom: "1px solid #eee", 
            fontSize: "14px" 
          }}>
            📎 {file}
          </li>
        ))}
      </ul>
    </Card>
  );
}
