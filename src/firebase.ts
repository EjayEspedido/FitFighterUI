import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB_O6E1yzeNr4M7_1TpbiQO0djMTAvaSb8",
  authDomain: "fitfighter-cbc4a.firebaseapp.com",
  projectId: "fitfighter-cbc4a",
  storageBucket: "fitfighter-cbc4a.appspot.com",
  messagingSenderId: "442420156691",
  appId: "1:442420156691:web:62737646b12dff9112a2e6",
  measurementId: "G-B9R0K7F046",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
