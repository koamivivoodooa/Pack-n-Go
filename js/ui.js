// ============================================================
// ui.js — Mécanique d'interface générique (indépendante du métier)
// ============================================================
import { state } from './core.js';
import { isAdmin, isLivreur, canAccessPage } from './auth.js';
import { refreshDashboard, refreshCourses, refreshComptabilite } from './courses.js';
import { refreshConversations, refreshStaffLists } from './staff-messagerie.js';

// ---------- Toast ----------
export function toast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${msg}`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3500);
}

// ---------- Custom Select ----------
export function toggleCustomSelect(id) {
  const el = document.getElementById(id);
  if (!el) return;
  document.querySelectorAll('.custom-select.open').forEach(s => { if (s.id !== id) s.classList.remove('open'); });
  el.classList.toggle('open');
}
export function selectCustomOption(selectId, label, value) {
  const selectEl = document.getElementById(selectId);
  selectEl.querySelector('.custom-select-trigger span').textContent = label;
  selectEl.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
  const opt = selectEl.querySelector(`.custom-select-option[data-value="${value}"]`);
  if (opt) opt.classList.add('selected');
  let hidden = document.getElementById(selectId + '_value');
  if (!hidden) {
    hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.id = selectId + '_value';
    selectEl.appendChild(hidden);
  }
  hidden.value = value;
  selectEl.classList.remove('open');
}
export function populateSelect(selectId, options, defaultVal, defaultLabel) {
  const selectEl = document.getElementById(selectId);
  const container = selectEl.querySelector('.custom-select-options');
  container.innerHTML = '';
  options.forEach(o => {
    const div = document.createElement('div');
    div.className = 'custom-select-option';
    div.setAttribute('data-value', o.value);
    div.textContent = o.label;
    div.addEventListener('click', () => selectCustomOption(selectId, o.label, o.value));
    if (o.value === defaultVal) div.classList.add('selected');
    container.appendChild(div);
  });
  const trigger = selectEl.querySelector('.custom-select-trigger span');
  const found = options.find(o => o.value === defaultVal) || options[0];
  if (found) trigger.textContent = found.label;
  let hidden = document.getElementById(selectId + '_value');
  if (!hidden) {
    hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.id = selectId + '_value';
    selectEl.appendChild(hidden);
  }
  hidden.value = defaultVal || (options[0]?.value || '');
}
document.addEventListener('click', e => {
  if (!e.target.closest('.custom-select')) {
    document.querySelectorAll('.custom-select.open').forEach(s => s.classList.remove('open'));
  }
});

// ---------- Modal ----------
export function openModal(title, msg, cb, withInput = false) {
  const overlay = document.getElementById('modalOverlay');
  document.getElementById('modalTitle').innerHTML = `<i class="fas fa-question-circle"></i> ${title}`;
  document.getElementById('modalMessage').textContent = msg || '';
  document.getElementById('modalInput').style.display = withInput ? 'block' : 'none';
  document.getElementById('modalInput').value = '';
  overlay.classList.add('show');
  const btn = document.getElementById('modalConfirmBtn');
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener('click', () => {
    const val = withInput ? document.getElementById('modalInput').value : true;
    closeModal();
    if (cb) cb(val);
  });
  document.getElementById('modalInput').onkeydown = e => { if (e.key === 'Enter') newBtn.click(); };
}
export function closeModal() { document.getElementById('modalOverlay').classList.remove('show'); }

// ---------- Thème ----------
export function toggleTheme() {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('png_theme', isDark ? 'dark' : 'light');

  const themeBtn = document.getElementById('themeToggleIcon');
  const icon = themeBtn?.querySelector('i');
  const label = document.getElementById('themeLabel');

  if (icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
  if (label) label.textContent = isDark ? 'Thème clair' : 'Thème sombre';
}

// ---------- Layout par rôle ----------
export function applyRoleLayout() {
  const sidebar = document.getElementById('sidebar');
  const bottomNav = document.getElementById('bottomNav');
  const main = document.getElementById('mainContent');
  const hamburger = document.getElementById('hamburgerBtn');
  const topBar = document.getElementById('livreurTopBar');
  const fab = document.getElementById('fabCourseBtn');

  if (isLivreur()) {
    sidebar.classList.add('hidden');
    bottomNav.style.display = 'flex';
    main.classList.add('no-sidebar');
    hamburger.style.display = 'none';
    topBar.style.display = 'flex';
    fab.classList.add('hidden');
  } else {
    sidebar.classList.remove('hidden');
    bottomNav.style.display = 'none';
    main.classList.remove('no-sidebar');
    hamburger.style.display = '';
    topBar.style.display = 'none';
    if (isAdmin()) fab.classList.remove('hidden');
    else fab.classList.add('hidden');
  }
  document.getElementById('newCourseCard').style.display = isAdmin() ? '' : 'none';
  document.getElementById('chartsGrid').style.display = isAdmin() ? '' : 'none';
  document.getElementById('dernieresCoursesCard').style.display = isAdmin() ? '' : 'none';
  document.getElementById('livreurCoursesList').style.display = isLivreur() ? '' : 'none';
}

export function updateSidebar() {
  document.getElementById('sidebarName').textContent = state.currentUser?.name || '';
  document.getElementById('sidebarRole').textContent = state.currentUser?.isAdminPrincipal ? 'Admin Principal' : state.currentUser?.role || '';
  document.getElementById('sidebarAvatar').textContent = state.currentUser?.name?.charAt(0).toUpperCase() || '?';
}

// ---------- Navigation ----------
export function navigateTo(page) {
  if (!canAccessPage(page)) { toast("Accès non autorisé", "error"); return; }
  state.currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');

  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
  const sideLink = document.querySelector(`.sidebar-nav a[data-page="${page}"]`);
  if (sideLink) sideLink.classList.add('active');

  document.querySelectorAll('.bottom-nav a').forEach(a => a.classList.remove('active'));
  const bottomLink = document.querySelector(`.bottom-nav a[data-page="${page}"]`);
  if (bottomLink) bottomLink.classList.add('active');

  if (page === 'dashboard') refreshDashboard();
  else if (page === 'courses') refreshCourses();
  else if (page === 'comptabilite') refreshComptabilite();
  else if (page === 'messagerie') refreshConversations();
}

// ---------- Rafraîchissement global ----------
export function refreshAllUI() {
  if (!state.currentUser) return;
  updateSidebar();
  refreshStaffLists();
  if (state.currentPage === 'dashboard') refreshDashboard();
  else if (state.currentPage === 'courses') refreshCourses();
  else if (state.currentPage === 'comptabilite') refreshComptabilite();
  else if (state.currentPage === 'messagerie') refreshConversations();
}
