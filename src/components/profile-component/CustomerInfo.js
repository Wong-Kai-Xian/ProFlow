// src/components/profile-component/CustomerInfo.js
import React from "react";
import { Card } from "../../pages/CustomerProfile";

export default function CustomerInfo({ data }) {
  return (
    <Card>
      <h3>Customer Profile</h3>
      <p><strong>Name:</strong> {data.name}</p>
      <p><strong>Email:</strong> {data.email}</p>
      <p><strong>Phone:</strong> {data.phone}</p>
    </Card>
  );
}
