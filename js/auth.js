// ============================================================
// auth.js — Session, connexion/déconnexion, rôles, permissions
// ============================================================
import { state, ADMIN_CODE } from './core.js';
import { toast } from './ui.js';

// ⚠️ Ce hash n'est PAS un vrai SHA-256 (juste un hash maison faible).
// Fonctionnellement identique à l'original, mais à remplacer si tu
// sécurises l'auth un jour (Firebase Authentication par ex.).
export function sha256(msg) {
  let hash = 0;
  for (let i = 0; i < msg.length; i++) {
    hash = ((hash << 5) - hash) + msg.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16);
}

// ---------- Session ----------
export function initSession() {
  const saved = localStorage.getItem('png_session');
  if (saved) {
    try { state.currentUser = JSON.parse(saved); }
    catch (e) { state.currentUser = null; }
  }
}

export function saveSession() {
  if (state.currentUser) localStorage.setItem('png_session', JSON.stringify(state.currentUser));
  else localStorage.removeItem('png_session');
}

// ---------- Connexion / déconnexion ----------
// `attemptLogin` ne fait que valider et poser `state.currentUser`.
// L'orchestration UI (layout, navigation, refresh) est faite par main.js
// via le callback `onSuccess`, pour éviter que ce module dépende des
// modules "vue" (courses.js, staff-messagerie.js...).
export function attemptLogin(onSuccess) {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!username) { toast("Veuillez entrer votre nom d'utilisateur", "error"); return; }
  if (!password) { toast("Code secret requis", "error"); return; }

  let success = false;
  if (username.toLowerCase() === 'admin') {
    if (password === ADMIN_CODE) {
      // ✅ CORRECTION ICI : Ajout de la propriété `username`
      state.currentUser = { name: 'Admin Principal', username: username, role: 'admin', isAdminPrincipal: true };
      success = true;
    } else { toast("Code admin incorrect", "error"); return; }
  } else {
    const user = state.staff[username];
    if (!user) { toast("Utilisateur inconnu", "error"); return; }
    if (user.mdp === sha256(password)) {
      // ✅ CORRECTION ICI : Ajout de la propriété `username`
      state.currentUser = { name: user.nom || username, username: username, role: user.role, isAdminPrincipal: false };
      success = true;
    } else { toast("Code secret incorrect", "error"); return; }
  }

  if (success) {
    saveSession();
    toast(`Bienvenue ${state.currentUser.name}`, "success");
    if (onSuccess) onSuccess(state.currentUser);
  }
}

export function logout(onLogout) {
  state.currentUser = null;
  saveSession();
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginUser').value = '';
  toast("Déconnexion réussie", "success");
  if (onLogout) onLogout();
}

// ---------- Rôles & permissions ----------
export function isAdmin() {
  return state.currentUser && (state.currentUser.role === 'admin' || state.currentUser.role === 'gestionnaire' || state.currentUser.isAdminPrincipal);
}
export function isAdminPrincipal() {
  return state.currentUser && state.currentUser.isAdminPrincipal;
}
export function isLivreur() {
  return state.currentUser && state.currentUser.role?.startsWith('livreur');
}
export function canAccessPage(page) {
  if (!state.currentUser) return false;
  if (isAdmin()) return true;
  if (isLivreur()) return ['dashboard', 'courses', 'messagerie'].includes(page);
  return false;
}
