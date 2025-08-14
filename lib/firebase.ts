import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
 apiKey: "AIzaSyCn9kYPkV47yXrevoda4V3ck3cfXjeqFa4",
 authDomain: "freetop-chat.firebaseapp.com",
 projectId: "freetop-chat",
 storageBucket: "freetop-chat.firebasestorage.app",
 messagingSenderId: "887959211247",
 appId: "1:887959211247:web:0ec159adf881a5d5095f1a",
 measurementId: "G-4JFYW5SDJK"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
