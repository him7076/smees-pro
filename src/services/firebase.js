import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// --- FIREBASE CONFIGURATION (reads from .env, falls back to defaults) ---
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyAQgIJYRf-QOWADeIKiTyc-lGL8PzOgWvI",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "smeestest.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "smeestest",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "smeestest.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "1086297510582",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:1086297510582:web:7ae94f1d7ce38d1fef8c17",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-BQ6NW6D84Z"
};

// 2. PERSONAL CONFIG
const personalConfig = {
  apiKey: process.env.REACT_APP_PERSONAL_API_KEY || "AIzaSyCILMKJfFSOdyKA9wTh6zzXsPMc0wt_Wtc",
  authDomain: process.env.REACT_APP_PERSONAL_AUTH_DOMAIN || "personal-data-a2bce.firebaseapp.com",
  projectId: process.env.REACT_APP_PERSONAL_PROJECT_ID || "personal-data-a2bce",
  storageBucket: process.env.REACT_APP_PERSONAL_STORAGE_BUCKET || "personal-data-a2bce.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_PERSONAL_MESSAGING_SENDER_ID || "680628699537",
  appId: process.env.REACT_APP_PERSONAL_APP_ID || "1:680628699537:web:2cd444a4eaea83df945a30",
  measurementId: process.env.REACT_APP_PERSONAL_MEASUREMENT_ID || "G-DTQH641PS3"
};

// Initialize BOTH Apps
export const app = initializeApp(firebaseConfig, "business"); // Business App
export const personalApp = initializeApp(personalConfig, "personal"); // Personal App
export const analytics = getAnalytics(app);

// Business Services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Personal Services
export const personalDb = getFirestore(personalApp);
