// ============================================================
// courses.js — Courses, dashboard et comptabilité
// (regroupés car ce sont 3 angles sur la même donnée `state.courses`)
// ============================================================
import { db, state } from './core.js';
import { isAdmin, isLivreur } from './auth.js';
import { toast, openModal } from './ui.js';

const STATUS_MAP = {
  'Attente': { cls: 'status-attente', badge: 'badge-attente', icon: 'fa-hourglass-half' },
  'En cours': { cls: 'status-cours', badge: 'badge-cours', icon: 'fa-route' },
  'Livré': { cls: 'status-livre', badge: 'badge-livre', icon: 'fa-check-circle' },
  'Annulé': { cls: 'status-annule', badge: 'badge-annule', icon: 'fa-ban' }
};

function courseItemHtml(c, { showEditDelete = false, allowQuickStatus = false } = {}) {
  const s = STATUS_MAP[c.statut] || STATUS_MAP['Attente'];
  return `
    <div class="course-item ${s.cls}">
      <div class="course-icon"><i class="fas ${s.icon}"></i></div>
      <div class="course-main">
        <span class="course-client">${c.client}</span><span class="course-dest">${c.dest || ''}</span>
        <div class="course-meta">${c.livreur || 'Non assigné'} • ${(c.tarif || 0).toLocaleString()} F</div>
      </div>
      <div class="course-actions">
        <span class="badge ${s.badge}">${c.statut}</span>
        ${showEditDelete ? `<button class="btn btn-warning btn-sm" onclick="editerCourse('${c.id}')"><i class="fas fa-edit"></i></button>
          <button class="btn btn-danger btn-sm" onclick="supprimerCourse('${c.id}')"><i class="fas fa-trash"></i></button>` : ''}
        <button class="btn btn-outline btn-sm" onclick="ouvrirChat('${c.id}')"><i class="fas fa-comment-dots"></i></button>
        ${allowQuickStatus && c.statut !== 'Livré' && c.statut !== 'Annulé' ? `<button class="btn btn-success btn-sm" onclick="changerStatutCourse('${c.id}','${c.statut === 'Attente' ? 'En cours' : 'Livré'}')"><i class="fas fa-check"></i></button>` : ''}
      </div>
    </div>`;
}
// `onUpdate` est fourni par main.js (= refreshAllUI) pour éviter que ce
// module dépende de ui.js pour ça.
export function listenCourses(onUpdate) {
  db.ref('courses').on('value', snap => {
    state.courses = [];
    snap.forEach(child => state.courses.unshift({ id: child.key, ...child.val() }));
    if (onUpdate) onUpdate();
  }, error => {
    console.error('Erreur de lecture des courses :', error);
    toast("Impossible de charger les courses : " + error.message, "error");
  });
}

// ---------- Dashboard ----------
export function refreshDashboard() {
  if (!state.currentUser) return;
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  if (isLivreur()) {
    const myCourses = state.courses.filter(c => c.livreur === state.currentUser.name && c.date === today);
    const totalLivrees = myCourses.filter(c => c.statut === 'Livré').reduce((s, c) => s + (c.tarif || 0), 0);
    const role = state.staff[state.currentUser.name]?.role || 'livreur_externe';
    const partPack = role === 'livreur_packngo' ? Math.round(totalLivrees * 0.7) : Math.round(totalLivrees * 0.3);
    const gainLivreur = totalLivrees - partPack;
    const nbCoursesJour = myCourses.length;
    const nbLivrees = myCourses.filter(c => c.statut === 'Livré').length;

    document.getElementById('kpiGrid').innerHTML = `
      <div class="kpi-card"><div class="kpi-icon green"><i class="fas fa-wallet"></i></div><div><div class="kpi-value">${gainLivreur.toLocaleString()} F</div><div class="kpi-label">Mes gains du jour</div></div></div>
      <div class="kpi-card"><div class="kpi-icon blue"><i class="fas fa-box"></i></div><div><div class="kpi-value">${nbLivrees} / ${nbCoursesJour}</div><div class="kpi-label">Courses livrées / total</div></div></div>
    `;

    let coursesHtml = '';
    if (myCourses.length > 0) {
      coursesHtml = '<div class="card"><div class="card-header"><h3><i class="fas fa-list"></i> Mes courses du jour</h3></div><div class="course-list">';
      myCourses.forEach(c => { coursesHtml += courseItemHtml(c, { allowQuickStatus: true }); });
      coursesHtml += '</div></div>';
    } else {
      coursesHtml = '<div class="card"><p style="color:var(--text-secondary);">Aucune course assignée aujourd’hui.</p></div>';
    }
    document.getElementById('livreurCoursesList').innerHTML = coursesHtml;
  } else if (isAdmin()) {
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now); monday.setDate(now.getDate() - diffToMonday);
    const mondayStr = monday.toISOString().split('T')[0];
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    let totalJour = 0, totalSemaine = 0, totalMois = 0, totalAttente = 0, totalCours = 0, totalLivre = 0, totalAnnule = 0;
    const last7days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      last7days.push({ date: d.toISOString().split('T')[0], total: 0 });
    }
    state.courses.forEach(c => {
      const t = c.tarif || 0;
      if (c.date === today) totalJour += t;
      if (c.date >= mondayStr && c.date <= today) totalSemaine += t;
      if (c.date >= firstDay && c.date <= today) totalMois += t;
      if (c.statut === 'Attente') totalAttente++;
      else if (c.statut === 'En cours') totalCours++;
      else if (c.statut === 'Livré') totalLivre++;
      else if (c.statut === 'Annulé') totalAnnule++;
      const dayEntry = last7days.find(d => d.date === c.date);
      if (dayEntry) dayEntry.total += t;
    });

    document.getElementById('kpiGrid').innerHTML = `
      <div class="kpi-card"><div class="kpi-icon blue"><i class="fas fa-calendar-day"></i></div><div><div class="kpi-value">${totalJour.toLocaleString()} F</div><div class="kpi-label">Gains du jour</div></div></div>
      <div class="kpi-card"><div class="kpi-icon green"><i class="fas fa-calendar-week"></i></div><div><div class="kpi-value">${totalSemaine.toLocaleString()} F</div><div class="kpi-label">Cette semaine</div></div></div>
      <div class="kpi-card"><div class="kpi-icon orange"><i class="fas fa-calendar-alt"></i></div><div><div class="kpi-value">${totalMois.toLocaleString()} F</div><div class="kpi-label">Ce mois</div></div></div>
      <div class="kpi-card"><div class="kpi-icon red"><i class="fas fa-boxes"></i></div><div><div class="kpi-value">${state.courses.length}</div><div class="kpi-label">Total courses</div></div></div>
    `;

    const ctx1 = document.getElementById('chartGains')?.getContext('2d');
    if (ctx1) {
      if (state.chartGainsInstance) state.chartGainsInstance.destroy();
      state.chartGainsInstance = new Chart(ctx1, {
        type: 'line',
        data: {
          labels: last7days.map(d => new Date(d.date).toLocaleDateString('fr', { weekday: 'short', day: 'numeric' })),
          datasets: [{ label: 'Gains', data: last7days.map(d => d.total), borderColor: '#e94560', backgroundColor: 'rgba(233,69,96,0.1)', fill: true, tension: 0.4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
    }
    const ctx2 = document.getElementById('chartStatuts')?.getContext('2d');
    if (ctx2) {
      if (state.chartStatutsInstance) state.chartStatutsInstance.destroy();
      state.chartStatutsInstance = new Chart(ctx2, {
        type: 'doughnut',
        data: { labels: ['Attente', 'En cours', 'Livré', 'Annulé'], datasets: [{ data: [totalAttente, totalCours, totalLivre, totalAnnule], backgroundColor: ['#94a3b8', '#f59e0b', '#10b981', '#ef4444'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
      });
    }

    const dernieres = state.courses.slice(0, 8);
    let html = '<div class="table-responsive"><table><thead><tr><th>Client</th><th>Livreur</th><th>Tarif</th><th>Statut</th><th>Date</th></tr></thead><tbody>';
    dernieres.forEach(c => {
      const badge = c.statut === 'Livré' ? 'badge-livre' : (c.statut === 'En cours' ? 'badge-cours' : (c.statut === 'Annulé' ? 'badge-annule' : 'badge-attente'));
      html += `<tr><td>${c.client}</td><td>${c.livreur || '—'}</td><td>${c.tarif || 0} F</td><td><span class="badge ${badge}">${c.statut}</span></td><td>${c.date}</td></tr>`;
    });
    html += '</tbody></table></div>';
    document.getElementById('dernieresCourses').innerHTML = html || '<p style="color:var(--text-secondary);">Aucune course.</p>';
  }
}

// ---------- Courses ----------
export function refreshCourses() {
  if (!state.currentUser) return;
  let coursesToShow = isLivreur() ? state.courses.filter(c => c.livreur === state.currentUser.name) : state.courses;
  let html = '<div class="course-list">';
  coursesToShow.forEach(c => {
    html += courseItemHtml(c, { showEditDelete: isAdmin(), allowQuickStatus: isLivreur() });
  });
  html += '</div>';
  document.getElementById('suiviCourses').innerHTML = coursesToShow.length ? html : '<p style="color:var(--text-secondary);">Aucune course.</p>';
}

export function creerCourse() {
  if (!isAdmin()) { toast("Accès réservé", "error"); return; }

  const client = document.getElementById('c_client').value.trim();
  const tarif = parseFloat(document.getElementById('c_tarif').value.trim());
  if (!client || isNaN(tarif) || tarif <= 0) { toast("Client et tarif valides requis", "error"); return; }

  let livreur = '';
  const hiddenInput = document.getElementById('c_livreur_select_value');
  if (hiddenInput) livreur = hiddenInput.value || '';

  if (!livreur) {
    const triggerSpan = document.querySelector('#c_livreur_select .custom-select-trigger span');
    if (triggerSpan) {
      const text = triggerSpan.textContent;
      if (text && text !== 'NON ASSIGNÉ' && text !== 'Choisir livreur') {
        for (let u in state.staff) {
          if (state.staff[u].nom === text) { livreur = u; break; }
        }
      }
    }
  }

  const dest = document.getElementById('c_dest').value.trim();
  const tel = document.getElementById('c_tel').value.trim();

  db.ref('courses').push({
    date: new Date().toISOString().split('T')[0],
    client: client,
    tarif: tarif,
    dest: dest,
    tel: tel,
    livreur: livreur,
    statut: 'Attente',
    createdBy: state.currentUser.name
  })
    .then(() => {
      toast("Course créée avec succès", "success");
      ['c_client', 'c_dest', 'c_tel', 'c_tarif'].forEach(id => { document.getElementById(id).value = ''; });
      const triggerSpan = document.querySelector('#c_livreur_select .custom-select-trigger span');
      if (triggerSpan) triggerSpan.textContent = 'NON ASSIGNÉ';
      const hidden = document.getElementById('c_livreur_select_value');
      if (hidden) hidden.value = '';
    })
    .catch((error) => {
      console.error("Erreur Firebase :", error);
      toast("Erreur lors de la création : " + error.message, "error");
    });
}

export function changerStatutCourse(id, nouveauStatut) {
  openModal('Confirmation', `Passer en "${nouveauStatut}" ?`, (confirmed) => {
    if (confirmed) {
      db.ref('courses/' + id).update({ statut: nouveauStatut })
        .then(() => toast(`Statut: ${nouveauStatut}`, "success"))
        .catch(() => toast("Erreur", "error"));
    }
  });
}

export function editerCourse(id) {
  const c = state.courses.find(x => x.id === id);
  if (!c || !isAdmin()) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.innerHTML = `
    <div class="modal-box">
      <h3><i class="fas fa-edit"></i> Modifier la course</h3>
      <input type="text" id="edit_client" value="${c.client || ''}" placeholder="Client">
      <input type="text" id="edit_dest" value="${c.dest || ''}" placeholder="Destination">
      <input type="tel" id="edit_tel" value="${c.tel || ''}" placeholder="Téléphone">
      <input type="number" id="edit_tarif" value="${c.tarif || 0}" placeholder="Tarif">
      <div class="custom-select" id="edit_livreur_select">
        <div class="custom-select-trigger" onclick="this.parentElement.classList.toggle('open')">
          <span>${c.livreur || 'NON ASSIGNÉ'}</span>
          <i class="fas fa-chevron-down"></i>
        </div>
        <div class="custom-select-options" id="edit_livreur_options"></div>
      </div>
      <div class="custom-select" id="edit_statut_select">
        <div class="custom-select-trigger" onclick="this.parentElement.classList.toggle('open')">
          <span>${c.statut}</span>
          <i class="fas fa-chevron-down"></i>
        </div>
        <div class="custom-select-options">
          ${['Attente', 'En cours', 'Livré', 'Annulé'].map(s => `<div class="custom-select-option" data-value="${s}" onclick="this.closest('.custom-select').querySelector('.custom-select-trigger span').textContent='${s}'; this.parentElement.parentElement.classList.remove('open');">${s}</div>`).join('')}
        </div>
      </div>
      <div style="display:flex; gap:10px; margin-top:16px;">
        <button class="btn btn-primary" id="editSaveBtn"><i class="fas fa-save"></i> Enregistrer</button>
        <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const optsContainer = overlay.querySelector('#edit_livreur_options');
  optsContainer.innerHTML = '<div class="custom-select-option" data-value="" onclick="this.closest(\'.custom-select\').querySelector(\'.custom-select-trigger span\').textContent=\'NON ASSIGNÉ\'">NON ASSIGNÉ</div>';
  for (let u in state.staff) {
    if (state.staff[u].role?.startsWith('livreur')) {
      const div = document.createElement('div');
      div.className = 'custom-select-option';
      div.setAttribute('data-value', u);
      div.textContent = state.staff[u].nom || u;
      div.onclick = function () {
        overlay.querySelector('#edit_livreur_select .custom-select-trigger span').textContent = state.staff[u].nom || u;
        overlay.querySelector('#edit_livreur_select').classList.remove('open');
      };
      optsContainer.appendChild(div);
    }
  }
  overlay.querySelector('#editSaveBtn').addEventListener('click', () => {
    const newClient = overlay.querySelector('#edit_client').value.trim();
    const newTarif = parseFloat(overlay.querySelector('#edit_tarif').value.trim());
    if (!newClient || isNaN(newTarif) || newTarif <= 0) { toast("Données invalides", "error"); return; }
    const selectedLivreur = overlay.querySelector('#edit_livreur_select .custom-select-trigger span').textContent;
    const livreurValue = selectedLivreur === 'NON ASSIGNÉ' ? '' : (Object.keys(state.staff).find(k => (state.staff[k].nom || k) === selectedLivreur) || selectedLivreur);
    db.ref('courses/' + id).update({
      client: newClient,
      dest: overlay.querySelector('#edit_dest').value.trim(),
      tel: overlay.querySelector('#edit_tel').value.trim(),
      tarif: newTarif,
      livreur: livreurValue,
      statut: overlay.querySelector('#edit_statut_select .custom-select-trigger span').textContent
    }).then(() => { toast("Course mise à jour", "success"); overlay.remove(); });
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

export function supprimerCourse(id) {
  if (!isAdmin()) return;
  openModal('Supprimer', 'Supprimer définitivement cette course ?', (confirmed) => {
    if (confirmed) db.ref('courses/' + id).remove().then(() => toast("Supprimée", "success"));
  });
}

// ---------- Comptabilité ----------
export function getPeriodeDates(periode, dateRef) {
  const d = new Date(dateRef + 'T00:00:00');
  let debut, fin;
  if (periode === 'jour') {
    debut = dateRef;
    fin = dateRef;
  } else if (periode === 'semaine') {
    const day = d.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const lundi = new Date(d);
    lundi.setDate(d.getDate() - diffToMonday);
    const dimanche = new Date(lundi);
    dimanche.setDate(lundi.getDate() + 6);
    debut = lundi.toISOString().split('T')[0];
    fin = dimanche.toISOString().split('T')[0];
  } else if (periode === 'mois') {
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    debut = firstDay.toISOString().split('T')[0];
    fin = lastDay.toISOString().split('T')[0];
  }
  return { debut, fin };
}

export function refreshComptabilite() {
  if (!isAdmin()) return;
  const { debut, fin } = getPeriodeDates(state.periodeActive, state.dateReference);

  let filtered = state.courses.filter(c => c.date >= debut && c.date <= fin);

  let totalPeriod = 0;
  filtered.forEach(c => totalPeriod += (c.tarif || 0));
  const panierMoyen = filtered.length > 0 ? Math.round(totalPeriod / filtered.length) : 0;
  document.getElementById('bilanKpi').innerHTML = `
    <div class="kpi-card"><div class="kpi-icon blue"><i class="fas fa-calendar-day"></i></div><div><div class="kpi-value">${totalPeriod.toLocaleString()} F</div><div class="kpi-label">Total période</div></div></div>
    <div class="kpi-card"><div class="kpi-icon green"><i class="fas fa-box"></i></div><div><div class="kpi-value">${filtered.length}</div><div class="kpi-label">Courses</div></div></div>
    <div class="kpi-card"><div class="kpi-icon orange"><i class="fas fa-receipt"></i></div><div><div class="kpi-value">${panierMoyen.toLocaleString()} F</div><div class="kpi-label">Panier moyen</div></div></div>
  `;

  const livreursSet = new Set(filtered.map(c => c.livreur).filter(Boolean));
  let bilanHtml = '';
  if (livreursSet.size > 0) {
    const roleLabels = { livreur_packngo: 'role-interne', livreur_externe: 'role-externe' };
    const rows = [];
    let grandTotal = 0, grandGains = 0, grandPack = 0;
    for (let liv of livreursSet) {
      const coursesLiv = filtered.filter(c => c.livreur === liv);
      const totalLiv = coursesLiv.reduce((s, c) => s + (c.tarif || 0), 0);
      const role = state.staff[liv]?.role || 'livreur_externe';
      const partPack = role === 'livreur_packngo' ? Math.round(totalLiv * 0.7) : Math.round(totalLiv * 0.3);
      const gainLivreur = totalLiv - partPack;
      grandTotal += totalLiv;
      grandGains += gainLivreur;
      grandPack += partPack;
      rows.push({ liv, nomAffichage: state.staff[liv]?.nom || liv, totalLiv, gainLivreur, partPack, roleCls: roleLabels[role] || 'role-externe' });
    }
    rows.sort((a, b) => b.totalLiv - a.totalLiv);

    let rowsHtml = '';
    rows.forEach(r => {
      const pct = grandTotal > 0 ? Math.round((r.totalLiv / grandTotal) * 100) : 0;
      rowsHtml += `
        <tr>
          <td>
            <div class="bilan-livreur">
              <span class="bilan-livreur-avatar">${r.nomAffichage.charAt(0).toUpperCase()}</span>
              <div>
                <div class="bilan-livreur-name">${r.nomAffichage}</div>
                <span class="role-pill ${r.roleCls}" style="margin-top:2px;">${r.roleCls === 'role-interne' ? '🚀 Interne' : '🏍️ Externe'}</span>
              </div>
            </div>
          </td>
          <td>
            ${r.totalLiv.toLocaleString()} F
            <div class="bilan-bar-track"><div class="bilan-bar-fill" style="width:${pct}%"></div></div>
          </td>
          <td>${r.gainLivreur.toLocaleString()} F</td>
          <td>${r.partPack.toLocaleString()} F</td>
        </tr>`;
    });
    rowsHtml += `
      <tr class="row-total">
        <td><strong>TOTAL</strong></td>
        <td><strong>${grandTotal.toLocaleString()} F</strong></td>
        <td><strong>${grandGains.toLocaleString()} F</strong></td>
        <td><strong>${grandPack.toLocaleString()} F</strong></td>
      </tr>`;
    const dateFormatee = new Date(state.dateReference).toLocaleDateString('fr-FR');
    bilanHtml = `
      <div class="bilan-card">
        <div class="bilan-title">📊 BILAN FINANCIER GLOBAL</div>
        <div class="bilan-date">
          <span>Période : ${state.periodeActive} (${debut} → ${fin})</span>
          <span>${dateFormatee}</span>
        </div>
        <table class="bilan-table">
          <thead>
            <tr>
              <th>LIVREUR</th>
              <th>TOTAL</th>
              <th>GAINS</th>
              <th>Pack'n Go</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <div class="bilan-footer">Généré le ${new Date().toLocaleDateString('fr-FR')}</div>
      </div>`;
  } else {
    bilanHtml = '<div class="bilan-card"><p style="color:var(--text-secondary); text-align:center;">Aucun livreur avec des courses pour cette période.</p></div>';
  }
  document.getElementById('bilanFinancier').innerHTML = bilanHtml;

  let total = 0;
  let html = '<div class="table-responsive"><table class="data-table"><thead><tr><th>Client</th><th>Livreur</th><th>Tarif</th><th>Statut</th><th>Date</th></tr></thead><tbody>';
  filtered.forEach(c => {
    total += c.tarif || 0;
    const badge = c.statut === 'Livré' ? 'badge-livre' : (c.statut === 'En cours' ? 'badge-cours' : (c.statut === 'Annulé' ? 'badge-annule' : 'badge-attente'));
    html += `<tr><td>${c.client}</td><td>${c.livreur || '—'}</td><td>${(c.tarif || 0).toLocaleString()} F</td><td><span class="badge ${badge}">${c.statut}</span></td><td>${c.date}</td></tr>`;
  });
  html += `</tbody><tfoot><tr><td colspan="2">Total</td><td>${total.toLocaleString()} F</td><td colspan="2"></td></tr></tfoot></table></div>`;
  document.getElementById('tableCompta').innerHTML = html;
}
