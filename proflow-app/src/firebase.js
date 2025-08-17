// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCsYuQCsYXXvRUnFySseC8UNzArjCdJGSo",
  authDomain: "proflow-30144.firebaseapp.com",
  projectId: "proflow-30144",
  storageBucket: "proflow-30144.firebasestorage.app",
  messagingSenderId: "278194395988",
  appId: "1:278194395988:web:89b5325302c8ea5bf686c1",
  measurementId: "G-FG9GK9SZDE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
