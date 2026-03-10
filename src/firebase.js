import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBVieauZ2HicKTq4TvzJ_RD2N9R0nQaxrM",
  authDomain: "trackblender.firebaseapp.com",
  projectId: "trackblender",
  storageBucket: "trackblender.firebasestorage.app",
  messagingSenderId: "708276885502",
  appId: "1:708276885502:web:e14265c64151ac028f12af"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const COLLECTION = 'league';

// Simple key-value storage backed by Firestore
// Each key becomes a document in the 'league' collection
export async function getData(key) {
  try {
    const snap = await getDoc(doc(db, COLLECTION, key));
    if (snap.exists()) return snap.data().value;
    return null;
  } catch (e) {
    console.error('getData failed:', e);
    return null;
  }
}

export async function setData(key, value) {
  try {
    await setDoc(doc(db, COLLECTION, key), { value, updatedAt: new Date().toISOString() });
    return true;
  } catch (e) {
    console.error('setData failed:', e);
    return false;
  }
}

// Real-time listener — calls onChange whenever the document updates
export function subscribe(key, onChange) {
  return onSnapshot(doc(db, COLLECTION, key), (snap) => {
    if (snap.exists()) {
      onChange(snap.data().value);
    }
  }, (err) => {
    console.error('subscribe error:', err);
  });
}
