// src/components/profile-component/CompanyInfo.js
import React, { useState } from "react";
import Card from "./Card";
import { BUTTON_STYLES, INPUT_STYLES } from "./constants"; // Import BUTTON_STYLES and INPUT_STYLES
import { COLORS } from "./constants"; // Import COLORS

export default function CompanyInfo({ data, setCompanyProfile }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState(data);

  const handleEditToggle = () => {
    if (isEditing) {
      setCompanyProfile(editedData);
    }
    setIsEditing(!isEditing);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditedData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

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
            <p><strong>Company:</strong> <input type="text" name="company" value={editedData.company} onChange={handleChange} style={{ ...INPUT_STYLES.base, width: "calc(100% - 70px)" }} /></p>
            <p><strong>Industry:</strong> <input type="text" name="industry" value={editedData.industry} onChange={handleChange} style={{ ...INPUT_STYLES.base, width: "calc(100% - 70px)" }} /></p>
            <p><strong>Location:</strong> <input type="text" name="location" value={editedData.location} onChange={handleChange} style={{ ...INPUT_STYLES.base, width: "calc(100% - 70px)" }} /></p>
          </div>
        ) : (
          <div>
            <p><strong>Company:</strong> {data.company}</p>
            <p><strong>Industry:</strong> {data.industry}</p>
            <p><strong>Location:</strong> {data.location}</p>
          </div>
        )
      }
    </Card>
  );
}
