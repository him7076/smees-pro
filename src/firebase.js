import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAQgIJYRf-QOWADeIKiTyc-lGL8PzOgWvI",
  authDomain: "smeestest.firebaseapp.com",
  projectId: "smeestest",
  storageBucket: "smeestest.firebasestorage.app",
  messagingSenderId: "1086297510582",
  appId: "1:1086297510582:web:7ae94f1d7ce38d1fef8c17",
  measurementId: "G-BQ6NW6D84Z"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
