import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, getDocs, setDoc, collection, onSnapshot, query, deleteDoc, addDoc, orderBy } from 'firebase/firestore';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut as fbSignOut, onAuthStateChanged } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

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
const auth = getAuth(app);
const functions = getFunctions(app, "us-central1");
const provider = new GoogleAuthProvider();

const LEAGUE = 'default'; // namespace for multi-tenant later
const leagueRef = () => doc(db, 'leagues', LEAGUE);
const configRef = () => doc(leagueRef(), 'data', 'config');
const tracksRef = () => doc(leagueRef(), 'data', 'tracks');
const scheduleRef = () => doc(leagueRef(), 'data', 'schedule');
const memberRef = (uid) => doc(leagueRef(), 'members', uid);
const membersCol = () => collection(leagueRef(), 'members');
const racesCol = () => collection(leagueRef(), 'races');
const raceRef = (id) => doc(leagueRef(), 'races', id);
const eloRatingsRef = () => doc(leagueRef(), 'data', 'eloRatings');

// ─── Auth ───
export function onAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function signIn() {
  return signInWithPopup(auth, provider);
}

export async function signOut() {
  return fbSignOut(auth);
}

// ─── League Config ───
export async function getConfig() {
  const snap = await getDoc(configRef());
  return snap.exists() ? snap.data() : null;
}

export async function setConfig(data) {
  await setDoc(configRef(), { ...data, updatedAt: new Date().toISOString() }, { merge: true });
}

export function subscribeConfig(callback) {
  return onSnapshot(configRef(), snap => {
    callback(snap.exists() ? snap.data() : null);
  });
}

// ─── Tracks ───
export async function getTracks() {
  const snap = await getDoc(tracksRef());
  return snap.exists() ? snap.data().list : null;
}

export async function setTracks(list) {
  await setDoc(tracksRef(), { list, updatedAt: new Date().toISOString() });
}

export function subscribeTracks(callback) {
  return onSnapshot(tracksRef(), snap => {
    callback(snap.exists() ? snap.data().list : null);
  });
}

// ─── Schedule ───
export async function getSchedule() {
  const snap = await getDoc(scheduleRef());
  return snap.exists() ? snap.data().rounds : [];
}

export async function setSchedule(rounds) {
  await setDoc(scheduleRef(), { rounds, updatedAt: new Date().toISOString() });
}

export function subscribeSchedule(callback) {
  return onSnapshot(scheduleRef(), snap => {
    callback(snap.exists() ? snap.data().rounds : []);
  });
}

// ─── Members ───
// Each member doc: { displayName, ownership: {trackName: status}, joinedAt }
export async function getMember(uid) {
  const snap = await getDoc(memberRef(uid));
  return snap.exists() ? snap.data() : null;
}

export async function setMember(uid, data) {
  await setDoc(memberRef(uid), { ...data, updatedAt: new Date().toISOString() }, { merge: true });
}

export async function deleteMember(uid) {
  await deleteDoc(memberRef(uid));
}

// Subscribe to ALL members (real-time)
export function subscribeMembers(callback) {
  return onSnapshot(query(membersCol()), snap => {
    const members = {};
    snap.forEach(doc => { members[doc.id] = doc.data(); });
    callback(members);
  });
}

// ─── First-run detection ───
export async function leagueExists() {
  const snap = await getDoc(configRef());
  return snap.exists();
}

export async function createLeague(name, adminUid) {
  await setDoc(configRef(), {
    name,
    adminUids: [adminUid],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

// ─── Races ───
export async function getRaces() {
  const snap = await getDocs(query(racesCol(), orderBy('date'), orderBy('raceNumber')));
  const races = {};
  snap.forEach(d => { races[d.id] = d.data(); });
  return races;
}

export async function addRace(data) {
  const ref = await addDoc(racesCol(), { ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  return ref.id;
}

export async function setRace(id, data) {
  await setDoc(raceRef(id), { ...data, updatedAt: new Date().toISOString() }, { merge: true });
}

export async function deleteRace(id) {
  await deleteDoc(raceRef(id));
}

export function subscribeRaces(callback) {
  return onSnapshot(query(racesCol(), orderBy('date'), orderBy('raceNumber')), snap => {
    const races = {};
    snap.forEach(d => { races[d.id] = d.data(); });
    callback(races);
  });
}

// ─── ELO Ratings ───
export async function getEloRatings() {
  const snap = await getDoc(eloRatingsRef());
  return snap.exists() ? snap.data() : null;
}

export async function setEloRatings(data) {
  await setDoc(eloRatingsRef(), { ...data, updatedAt: new Date().toISOString() });
}

export function subscribeEloRatings(callback) {
  return onSnapshot(eloRatingsRef(), snap => {
    callback(snap.exists() ? snap.data() : null);
  });
}

// ─── iRacing API (via Cloud Function proxy) ───
const iracingProxyFn = httpsCallable(functions, "iracingProxy");

export async function fetchLeagueSeasons() {
  const result = await iracingProxyFn({ action: "leagueSeasons" });
  return result.data;
}

export async function fetchSeasonSessions(seasonId) {
  const result = await iracingProxyFn({ action: "seasonSessions", seasonId });
  return result.data;
}

export async function fetchRaceResult(subsessionId) {
  const result = await iracingProxyFn({ action: "raceResult", subsessionId });
  return result.data;
}
