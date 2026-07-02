// ============================================================
// staff-messagerie.js — Ressources humaines + messagerie
// (deux petites features regroupées, chacune trop courte
//  pour mériter son propre fichier)
// ============================================================
import { db, state } from './core.js';
import { isAdminPrincipal, sha256 } from './auth.js';
import { toast, openModal, populateSelect } from './ui.js';

// ---------- Suivi de lecture des conversations ----------
// Stocké en local (par appareil) plutôt que dans Firebase : suffisant
// pour distinguer "lu / non lu" sans changer le schéma de données.
function getLastRead(courseId) {
  return parseInt(localStorage.getItem(`png_read_${courseId}`) || '0', 10);
}
function markRead(courseId, ts) {
  localStorage.setItem(`png_read_${courseId}`, String(ts || Date.now()));
}

// ---------- Écoute Firebase ----------
export function listenStaff(onUpdate) {
  db.ref('staff').on('value', snap => {
    state.staff = snap.val() || {};
    if (onUpdate) onUpdate();
  }, error => {
    console.error('Erreur de lecture du staff :', error);
    toast("Impossible de charger l'équipe : " + error.message, "error");
  });
}

// ---------- Ressources Humaines ----------
export function refreshStaffLists() {
  const livreurOpts = [{ label: 'NON ASSIGNÉ', value: '' }];
  for (let u in state.staff) {
    if (state.staff[u].role?.startsWith('livreur')) {
      const displayName = state.staff[u].nom || u;
      livreurOpts.push({ label: displayName, value: u });
    }
  }
  populateSelect('c_livreur_select', livreurOpts, '', 'NON ASSIGNÉ');

  let html = '<div class="team-grid">';
  for (let u in state.staff) {
    const nom = state.staff[u].nom || u;
    const role = state.staff[u].role || 'inconnu';
    const roleMap = {
      admin: { label: '🔑 Admin', cls: 'role-admin' },
      gestionnaire: { label: '📋 Gestionnaire', cls: 'role-gestionnaire' },
      livreur_packngo: { label: '🚀 Interne', cls: 'role-interne' },
      livreur_externe: { label: '🏍️ Externe', cls: 'role-externe' }
    };
    const r = roleMap[role] || { label: role, cls: 'role-externe' };
    html += `
      <div class="team-card">
        <div class="team-card-top">
          <div class="team-card-avatar">${nom.charAt(0).toUpperCase()}</div>
          <div>
            <div class="team-card-name">${nom}</div>
            <div class="team-card-user">@${u}</div>
          </div>
        </div>
        <div class="team-card-footer">
          <span class="role-pill ${r.cls}">${r.label}</span>
          ${isAdminPrincipal() ? `<button class="btn btn-danger btn-sm" onclick="supprimerRH('${u}')"><i class="fas fa-trash"></i></button>` : ''}
        </div>
      </div>`;
  }
  html += '</div>';
  document.getElementById('listeRH').innerHTML = html === '<div class="team-grid"></div>' ? '<p style="color:var(--text-secondary);">Aucun membre.</p>' : html;
}

export function ajouterRH() {
  if (!isAdminPrincipal()) { toast("Seul l'admin principal peut ajouter des membres", "error"); return; }
  const nom = document.getElementById('rh_nom_complet').value.trim();
  const username = document.getElementById('rh_username').value.trim().toLowerCase();
  const code = document.getElementById('rh_code').value.trim();
  const selectedRole = document.querySelector('#rh_role_picker .role-option.selected');
  const role = selectedRole ? selectedRole.dataset.role : 'livreur_packngo';
  if (!nom || !username || !code) { toast("Tous les champs sont requis", "error"); return; }
  if (state.staff[username]) { toast("Ce nom d'utilisateur existe déjà", "error"); return; }
  if (username === 'admin') { toast("Nom d'utilisateur réservé", "error"); return; }

  db.ref('staff/' + username).set({
    nom: nom,
    mdp: sha256(code),
    role: role
  }).then(() => {
    toast(`${nom} ajouté`, "success");
    document.getElementById('rh_nom_complet').value = '';
    document.getElementById('rh_username').value = '';
    document.getElementById('rh_code').value = '';
  });
}

export function supprimerRH(username) {
  if (!isAdminPrincipal()) return;
  openModal('Supprimer', `Supprimer ${state.staff[username]?.nom || username} ?`, (confirmed) => {
    if (confirmed) db.ref('staff/' + username).remove().then(() => toast("Supprimé", "success"));
  });
}

// ---------- Messagerie ----------
export function ouvrirChat(courseId) {
  const course = state.courses.find(c => c.id === courseId);
  if (!course) return;

  const overlay = document.createElement('div');
  overlay.className = 'chat-overlay';
  overlay.innerHTML = `
    <div class="chat-panel">
      <div class="chat-panel-header">
        <div class="conv-avatar">${(course.client || '?').charAt(0).toUpperCase()}</div>
        <div class="chat-header-info">
          <div class="chat-header-name">${course.client}</div>
          <div class="chat-header-sub">${course.dest || course.livreur || 'Course'}</div>
        </div>
        <button class="chat-close-btn" id="chatCloseBtn"><i class="fas fa-times"></i></button>
      </div>
      <div class="chat-panel-body" id="chatMessages"></div>
      <div class="chat-panel-input">
        <input type="text" id="chatInput" placeholder="Écrire un message..." autocomplete="off">
        <button class="chat-send-btn" id="sendChatBtn"><i class="fas fa-paper-plane"></i></button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  markRead(courseId, Date.now());
  refreshConversations();
  listenForUnreadMessages();

  const messagesDiv = overlay.querySelector('#chatMessages');
  const chatRef = db.ref(`messages/${courseId}`);

  chatRef.once('value').then(snap => {
    if (!snap.exists()) {
      messagesDiv.innerHTML = '<div class="empty-state"><i class="fas fa-comment-dots"></i><span>Aucun message. Écrivez le premier !</span></div>';
    }
  });

  let lastSender = null;
  let lastDateLabel = null;

  const formatDateSep = (ts) => {
    const d = new Date(ts);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    if (isToday) return "Aujourd'hui";
    if (isYesterday) return "Hier";
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  };

  chatRef.on('child_added', snap => {
    const emptyState = messagesDiv.querySelector('.empty-state');
    if (emptyState) messagesDiv.innerHTML = '';

    const msg = snap.val();
    const isOwn = (msg.sender === state.currentUser.name);

    const dateLabel = formatDateSep(msg.timestamp);
    if (dateLabel !== lastDateLabel) {
      const sep = document.createElement('div');
      sep.className = 'chat-date-sep';
      sep.textContent = dateLabel;
      messagesDiv.appendChild(sep);
      lastDateLabel = dateLabel;
      lastSender = null;
    }

    const grouped = !isOwn && msg.sender === lastSender;
    const div = document.createElement('div');
    div.className = 'chat-msg' + (isOwn ? ' own' : '') + (grouped ? ' grouped' : '');
    div.innerHTML = `
      <span class="sender">${msg.sender}</span>
      <div class="msg-bubble">
        <div class="text">${msg.text}</div>
        <div class="msg-time">${new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    `;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    lastSender = msg.sender;
  });

  const sendMsg = () => {
    const input = overlay.querySelector('#chatInput');
    const text = input.value.trim();
    if (!text) return;
    chatRef.push({ sender: state.currentUser.name, text, timestamp: firebase.database.ServerValue.TIMESTAMP });
    input.value = '';
    input.focus();
  };
  const closeChat = () => {
    chatRef.off();
    markRead(courseId, Date.now());
    overlay.remove();
    refreshConversations();
    listenForUnreadMessages();
  };

  overlay.querySelector('#sendChatBtn').addEventListener('click', sendMsg);
  overlay.querySelector('#chatInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(); });
  overlay.querySelector('#chatCloseBtn').addEventListener('click', closeChat);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeChat(); });
  overlay.querySelector('#chatInput').focus();
}

export function refreshConversations() {
  const searchQuery = (document.getElementById('searchConv')?.value || '').toLowerCase();
  const courseIds = [...new Set(state.courses.map(c => c.id))];
  const div = document.getElementById('listeConversations');
  if (courseIds.length === 0) {
    div.innerHTML = '<div class="empty-state"><i class="fas fa-comments"></i><span>Aucune conversation pour le moment.</span></div>';
    return;
  }

  let html = '<div class="conv-list">';
  let matchCount = 0;
  courseIds.forEach(id => {
    const course = state.courses.find(c => c.id === id);
    if (!course) return;
    const clientName = course.client || 'Client inconnu';
    const dest = course.dest || '';
    if (searchQuery && !clientName.toLowerCase().includes(searchQuery) && !dest.toLowerCase().includes(searchQuery)) return;
    matchCount++;

    const lastMsg = state.lastMessages[id];
    const isOwnLast = lastMsg && lastMsg.sender === state.currentUser.name;
    const preview = lastMsg ? `${isOwnLast ? 'Vous' : lastMsg.sender}: ${lastMsg.text.substring(0, 34)}` : 'Aucun message pour le moment';
    const time = lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
    const unread = !!(lastMsg && !isOwnLast && lastMsg.timestamp > getLastRead(id));

    html += `
      <div class="conv-item${unread ? ' unread' : ''}" onclick="ouvrirChat('${id}')">
        <div class="conv-avatar">${clientName.charAt(0).toUpperCase()}</div>
        <div class="conv-main">
          <div class="conv-top-row">
            <span class="conv-name">${clientName}</span>
            <span class="conv-time">${time}</span>
          </div>
          <div class="conv-bottom-row">
            <span class="conv-preview">${preview}</span>
            ${unread ? '<span class="conv-unread-indicator"></span>' : ''}
          </div>
        </div>
      </div>`;
  });
  html += '</div>';

  div.innerHTML = matchCount > 0 ? html : '<div class="empty-state"><i class="fas fa-search"></i><span>Aucune conversation trouvée.</span></div>';
}

export function filterConversations() {
  refreshConversations();
}

// ---------- Badges non-lus ----------
export function updateBadges() {
  const sideBadge = document.getElementById('msgBadgeSidebar');
  const bottomBadge = document.getElementById('msgBadgeBottom');
  if (state.unreadMessages > 0) {
    sideBadge.style.display = 'flex';
    sideBadge.textContent = state.unreadMessages;
    bottomBadge.style.display = 'flex';
    bottomBadge.textContent = state.unreadMessages;
  } else {
    sideBadge.style.display = 'none';
    bottomBadge.style.display = 'none';
  }
}

export function listenForUnreadMessages() {
  let count = 0;
  state.courses.forEach(c => {
    const lastMsg = state.lastMessages[c.id];
    if (lastMsg && lastMsg.sender !== state.currentUser?.name && lastMsg.timestamp > getLastRead(c.id)) count++;
  });
  state.unreadMessages = count;
  updateBadges();
}

export function listenAllMessages() {
  db.ref('messages').on('child_added', snap => {
    const courseId = snap.key;
    snap.forEach(msgSnap => {
      const msg = msgSnap.val();
      state.lastMessages[courseId] = { text: msg.text, sender: msg.sender, timestamp: msg.timestamp };
    });
    listenForUnreadMessages();
    if (state.currentPage === 'messagerie') refreshConversations();
  });
  db.ref('messages').on('child_changed', snap => {
    const courseId = snap.key;
    snap.forEach(msgSnap => {
      const msg = msgSnap.val();
      state.lastMessages[courseId] = { text: msg.text, sender: msg.sender, timestamp: msg.timestamp };
    });
    listenForUnreadMessages();
    if (state.currentPage === 'messagerie') refreshConversations();
  });
}
