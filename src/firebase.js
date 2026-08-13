import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDuwDjqfmm0OufcYdnOFP26aewn-cGZTEE",
  authDomain: "pena4copas.firebaseapp.com",
  projectId: "pena4copas",
  storageBucket: "pena4copas.firebasestorage.app",
  messagingSenderId: "612262435479",
  appId: "1:612262435479:web:62b27a563e34ed34fe67d2",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
