import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyAQgIJYRf-QOWADeIKiTyc-lGL8PzOgWvI",
  authDomain: "smeestest.firebaseapp.com",
  projectId: "smeestest",
  storageBucket: "smeestest.firebasestorage.app",
  messagingSenderId: "1086297510582",
  appId: "1:1086297510582:web:7ae94f1d7ce38d1fef8c17",
  measurementId: "G-BQ6NW6D84Z"
};

// 2. PERSONAL CONFIG
const personalConfig = {
  apiKey: "AIzaSyCILMKJfFSOdyKA9wTh6zzXsPMc0wt_Wtc",
  authDomain: "personal-data-a2bce.firebaseapp.com",
  projectId: "personal-data-a2bce",
  storageBucket: "personal-data-a2bce.firebasestorage.app",
  messagingSenderId: "680628699537",
  appId: "1:680628699537:web:2cd444a4eaea83df945a30",
  measurementId: "G-DTQH641PS3"
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
