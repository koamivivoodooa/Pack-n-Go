// ============================================================
// core.js — Configuration Firebase + état global partagé
// ============================================================
// Ce module n'a AUCUNE dépendance vers les autres modules.
// Tout le reste de l'appli importe `db` et `state` d'ici.

const firebaseConfig = {
  apiKey: "AIzaSyAtsxQHvSBIVvjjAA53BWN3pBdV58hMJEk",
  authDomain: "pack-n-go-app.firebaseapp.com",
  databaseURL: "https://pack-n-go-app-default-rtdb.firebaseio.com",
  projectId: "pack-n-go-app",
  storageBucket: "pack-n-go-app.firebasestorage.app",
  messagingSenderId: "440398074655",
  appId: "1:440398074655:web:69ed87e2566fab0d50562a"
};
firebase.initializeApp(firebaseConfig);
export const db = firebase.database();

// Auth anonyme : ne remplace pas une vraie authentification par rôle,
// mais permet aux règles Firebase d'exiger "auth != null" au lieu d'un
// accès 100% public. Bloque les scripts/bots qui tapent l'API REST
// directement sans passer par le SDK Firebase.
export const authReady = firebase.auth().signInAnonymously()
  .catch(err => console.error('Échec de l\'authentification anonyme :', err));

export const ADMIN_CODE = "0612";

// État partagé, muté par les différents modules via `state.xxx = ...`.
// On utilise un objet (et non des `let` exportés) pour que les
// réassignations faites dans un module soient bien visibles partout,
// y compris à travers les imports circulaires.
export const state = {
  currentUser: null,
  courses: [],
  staff: {},
  currentPage: 'dashboard',
  chartGainsInstance: null,
  chartStatutsInstance: null,
  unreadMessages: 0,
  lastMessages: {},
  periodeActive: 'jour',
  dateReference: new Date().toISOString().split('T')[0]
};
