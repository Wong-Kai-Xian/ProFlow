// src/components/profile-component/CompanyReputation.js
import React from "react";
import { Card } from "../../pages/CustomerProfile";

export default function CompanyReputation({ data }) {
  return (
    <Card style={{ background: "#e8f0fe" }}>
      <h3>Company Reputation (AI-generated)</h3>
      <p>{"⭐".repeat(data.rating)}☆</p>
      <p>{data.summary}</p>
    </Card>
  );
}
