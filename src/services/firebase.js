import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

// --- FIREBASE CONFIGURATION (reads from .env, falls back to defaults) ---
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyBBbKSZw-bHdTuii3n0R4mFGvnOAUm70rI",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "smees-pro-new.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "smees-pro-new",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "smees-pro-new.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "631967329315",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:631967329315:web:e383a9fc3464432116d596",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-2QXNKEQJD5"
};

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
export const app = initializeApp(firebaseConfig, "business");
export const personalApp = initializeApp(personalConfig, "personal");
export const analytics = getAnalytics(app);

// Business Services with Persistence
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
export const auth = getAuth(app);
export const storage = getStorage(app);

// Personal Services with Persistence
export const personalDb = initializeFirestore(personalApp, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
