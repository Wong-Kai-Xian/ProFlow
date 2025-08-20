// src/components/profile-component/CompanyInfo.js
import React from "react";
import Card from "./Card";

export default function CompanyInfo({ data }) {
  return (
    <Card>
      <h3>Company Profile</h3>
      <p><strong>Company:</strong> {data.company}</p>
      <p><strong>Industry:</strong> {data.industry}</p>
      <p><strong>Location:</strong> {data.location}</p>
    </Card>
  );
}
