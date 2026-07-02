// ============================================================
// main.js — Point d'entrée : orchestration et câblage des events
// ============================================================
import { state, authReady } from './core.js';
import { initSession, attemptLogin, logout } from './auth.js';
import {
  toast, toggleTheme, applyRoleLayout, navigateTo,
  refreshAllUI, closeModal, toggleCustomSelect, selectCustomOption
} from './ui.js';
import {
  listenCourses, creerCourse, changerStatutCourse, editerCourse,
  supprimerCourse, refreshComptabilite
} from './courses.js';
import {
  listenStaff, ajouterRH, supprimerRH, ouvrirChat,
  listenAllMessages, listenForUnreadMessages, filterConversations
} from './staff-messagerie.js';

// ---------- Service Worker ----------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(reg => console.log('Service Worker enregistré', reg))
    .catch(err => console.log('Erreur SW', err));
}

// ---------- Fonctions exposées à window ----------
// Nécessaire car le HTML utilise encore des attributs onclick="..." inline
// (générés à la fois dans index.html et dans les templates JS).
function onLoginSuccess() {
  document.body.classList.add('logged-in');
  applyRoleLayout();
  refreshAllUI();
  navigateTo('dashboard');
}
function handleLogin() { attemptLogin(onLoginSuccess); }
function handleLogout() {
  logout(() => document.body.classList.remove('logged-in'));
}

Object.assign(window, {
  logout: handleLogout,
  creerCourse,
  changerStatutCourse,
  editerCourse,
  supprimerCourse,
  ajouterRH,
  supprimerRH,
  ouvrirChat,
  filterConversations,
  closeModal,
  toggleCustomSelect,
  selectCustomOption
});

// ---------- Données temps réel ----------
// On attend l'auth anonyme (core.js) avant d'ouvrir les listeners,
// pour rester compatible avec des règles Firebase du type "auth != null".
authReady.then(() => {
  listenCourses(() => { refreshAllUI(); listenForUnreadMessages(); });
  listenStaff(refreshAllUI);
  listenAllMessages();
});

// ---------- Init ----------
function init() {
  initSession();

  const themeToggleIcon = document.getElementById('themeToggleIcon');
  if (themeToggleIcon) {
    themeToggleIcon.addEventListener('click', toggleTheme);
    if (localStorage.getItem('png_theme') === 'dark') {
      document.body.classList.add('dark');
      const icon = themeToggleIcon.querySelector('i');
      const label = document.getElementById('themeLabel');
      if (icon) icon.className = 'fas fa-sun';
      if (label) label.textContent = 'Thème clair';
    } else {
      const icon = themeToggleIcon.querySelector('i');
      const label = document.getElementById('themeLabel');
      if (icon) icon.className = 'fas fa-moon';
      if (label) label.textContent = 'Thème sombre';
    }
  }

  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  document.getElementById('hamburgerBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  document.getElementById('loginBtn').addEventListener('click', handleLogin);
  document.getElementById('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });

  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(link.getAttribute('data-page'));
      if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
    });
  });
  document.querySelectorAll('.bottom-nav a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(link.getAttribute('data-page'));
    });
  });

  document.getElementById('fabCourseBtn').addEventListener('click', () => {
    navigateTo('courses');
  });

  document.querySelectorAll('#rh_role_picker .role-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#rh_role_picker .role-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  const periodeBtns = document.querySelectorAll('.periode-btn');
  const periodeDateInput = document.getElementById('periodeDate');
  periodeDateInput.value = new Date().toISOString().split('T')[0];

  periodeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      periodeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.periodeActive = btn.dataset.periode;
      refreshComptabilite();
    });
  });

  periodeDateInput.addEventListener('change', () => {
    state.dateReference = periodeDateInput.value;
    refreshComptabilite();
  });

  if (state.currentUser) {
    document.body.classList.add('logged-in');
    applyRoleLayout();
    refreshAllUI();
    navigateTo('dashboard');
  }
}

document.addEventListener('DOMContentLoaded', init);
