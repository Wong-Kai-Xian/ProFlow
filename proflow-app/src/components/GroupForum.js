import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export default function GroupForum() {
  const [forums, setForums] = useState([]);

  useEffect(() => {
    async function fetchForums() {
      const querySnapshot = await getDocs(collection(db, "forums"));
      setForums(querySnapshot.docs.map(doc => doc.data()));
    }
    fetchForums();
  }, []);

  return (
    <div style={{ background: '#F8F9F9', padding: '15px', borderRadius: '10px' }}>
      <h3>Group Forum</h3>
      <ul>
        {forums.map((forum, index) => <li key={index}>{forum.title}</li>)}
      </ul>
    </div>
  );
}
