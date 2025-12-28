import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA0GkAFhV6GfFsszHPJG-aPfGNiVRdBPNg",
  authDomain: "smees-33e6c.firebaseapp.com",
  projectId: "smees-33e6c",
  storageBucket: "smees-33e6c.firebasestorage.app",
  messagingSenderId: "723248995098",
  appId: "1:723248995098:web:a61b659e31f42332656aa3",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
