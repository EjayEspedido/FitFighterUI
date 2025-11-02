// src/apis/addSession.tsx
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

/* --------------------------------------------------------
   SONG MANAGEMENT
   -------------------------------------------------------- */

/**
 * Add a new rhythm song to Firestore.
 * Each song should have a unique numeric songID.
 */
export async function addSong(data: {
  songID: number;
  title: string;
  difficulty?: string;
  artist?: string;
  bpm?: number;
}) {
  if (!data.songID || !data.title)
    throw new Error("songID (number) and title are required");

  const ref = await addDoc(collection(db, "songs"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  console.log("✅ Song added:", ref.id);
  return ref;
}

/* --------------------------------------------------------
   COMBO MODE SESSION
   -------------------------------------------------------- */

export async function addComboSession(data: {
  userID: string;
  displayName: string;
  age: number;
  level: string;
  score: number;
  maxHR?: number;
  avgHR?: number;
  durationGame?: number;
  maxCombo?: number;
  longestCombo?: number;
  punchSpeed?: number;
  reactionTime?: number;
  gameMode?: string;
  sessionID?: string;
}) {
  if (!data.userID || !data.score) throw new Error("userID and score required");

  const ref = await addDoc(collection(db, "comboSessions"), {
    ...data,
    sessionDate: serverTimestamp(),
  });
  console.log("✅ Combo session added:", ref.id);
  return ref;
}

/* --------------------------------------------------------
   FRIEND OR FOE SESSION
   -------------------------------------------------------- */

export async function addFriendFoeSession(data: {
  userID: string;
  displayName: string;
  age: number;
  level: string;
  score: number;
  maxHR?: number;
  avgHR?: number;
  durationGame?: number;
  maxCombo?: number;
  longestCombo?: number;
  foesHit?: number;
  friendsHit?: number;
  punchSpeed?: number;
  reactionTime?: number;
  gameMode?: string;
  sessionID?: string;
}) {
  if (!data.userID || !data.score) throw new Error("userID and score required");

  const ref = await addDoc(collection(db, "friendfoeSessions"), {
    ...data,
    sessionDate: serverTimestamp(),
  });
  console.log("✅ Friend/Foe session added:", ref.id);
  return ref;
}

/* --------------------------------------------------------
   RHYTHM MODE SESSION
   -------------------------------------------------------- */

export async function addRhythmSession(data: {
  userID: string;
  displayName: string;
  age: number;
  level: string;
  score: number;
  songID: number; // numeric ID matching songs collection
  perfectHit?: number;
  greatHit?: number;
  goodHit?: number;
  missed?: number;
  maxCombo?: number;
  maxHR?: number;
  avgHR?: number;
  durationGame?: number;
  punchSpeed?: number;
  reactionTime?: number;
  gameMode?: string;
  sessionID?: string;
}) {
  if (!data.userID || !data.score || !data.songID)
    throw new Error("userID, score, and songID are required");

  const ref = await addDoc(collection(db, "rhythmSessions"), {
    ...data,
    sessionDate: serverTimestamp(),
  });
  console.log("✅ Rhythm session added:", ref.id);
  return ref;
}

/* --------------------------------------------------------
   OPTIONAL: expose to window for quick console testing
   (remove these lines for production)
   -------------------------------------------------------- */
// @ts-ignore
if (import.meta.env.DEV) {
  // @ts-ignore
  window.addSong = addSong;
  // @ts-ignore
  window.addComboSession = addComboSession;
  // @ts-ignore
  window.addFriendFoeSession = addFriendFoeSession;
  // @ts-ignore
  window.addRhythmSession = addRhythmSession;
}
