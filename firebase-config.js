// Paste your Firebase web config. Enable: Authentication > Anonymous, and Firestore.
// IMPORTANT: priv/{uid} holds hidden loyalty points. Lock it in Firestore rules so only that uid can read it.
// Rain verdict penalties write to another user's priv doc from the client: move resolve() to a Cloud Function before going public.
export const cfg = {
  apiKey: "AIzaSyA8QSQqBQeJi4wjXGTWeMk6UxsSacKAxWY",
  authDomain: "gossipgirl-6a235.firebaseapp.com",
  projectId: "gossipgirl-6a235",
  appId: "1:354408066440:web:ca20bb6af3a1ab8b5f1e3d",
};
export const VAPID =
  "BCcV5LE76yU1SWuuaFVaQGvD68eVTtCnk8F92MmTAEDKmBdlEEOIWETpWHWSnmQkicEqAkmefG5_UnJeieSgGjM";
