import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // Import getStorage

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
  appId: "1:278194395988:web:560cf31ebb0f83f5f686c1",
  measurementId: "G-RVY0MN3GWN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);
export const storage = getStorage(app); // Initialize and export Firebase Storage
export { app }; // Export the app instance