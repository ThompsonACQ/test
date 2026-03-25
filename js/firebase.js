import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCs7_YN0HPh7XE1iyHiSVHTdT9oYTgClB4",
  authDomain: "goes-dd3e3.firebaseapp.com",
  projectId: "goes-dd3e3",
  storageBucket: "goes-dd3e3.firebasestorage.app",
  messagingSenderId: "856551069308",
  appId: "1:856551069308:web:c644afa41cf1e3a8449bf9",
  measurementId: "G-7TY9P05TBP"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;