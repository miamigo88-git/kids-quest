(function () {
  const API = '/api';
  const SESSION_KEY = 'kq_session';

  const state = {
    session: null,
    kids: [],
    selectedKidId: null,
    period: 'week'
  };

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  function loadSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
  }

  async function api(path, opts) {
    opts = opts || {};
    const headers = { 'Content-Type': 'application/json' };
    if (state.session) headers.Authorization = 'Bearer ' + state.session.token;
    const res = await fetch(API + path, { ...opts, headers });
    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) {
      const err = new Error((data && data.error) || ('HTTP ' + res.status));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add('hidden'), 2200);
  }

  function shortDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'short' });
  }

  function fullDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  }

  async function loadKids() {
    if (state.session.user.role === 'kid') {
      state.kids = [{
        id: state.session.user.id,
        name: state.session.user.name,
        avatar: state.session.user.avatar,
        color: state.session.user.color
      }];
      state.selectedKidId = state.session.user.id;
      $('#kid-pills').style.display = 'none';
    } else {
      state.kids = await api('/kids');
      if (state.kids.length === 0) {
        $('#kid-pills').innerHTML = '<div style="color:var(--text-muted);padding:8px;">No kids yet.</div>';
        return;
      }
      if (!state.selectedKidId) state.selectedKidId = state.kids[0].id;
      renderKidPills();
    }
  }

  function renderKidPills() {
    $('#kid-pills').innerHTML = state.kids.map(k => `
      <button class="kid-pill ${k.id === state.selectedKidId ? 'active' : ''}" data-id="${k.id}">
        <span class="kp-avatar" style="background:${k.color}33">${k.avatar}</span>
        ${escapeHtml(k.name)}
      </button>
    `).join('');
    $$('.kid-pill').forEach(b => b.addEventListener('click', () => {
      state.selectedKidId = b.dataset.id;
      renderKidPills();
      loadScores();
    }));
  }

  async function loadScores() {
    if (!state.selectedKidId) return;
    try {
      const data = await api('/scores/kid/' + state.selectedKidId + '?period=' + state.period);
      renderScores(data);
      loadLeaderboard();
    } catch (e) {
      if (e.status === 401) { window.location.href = '/'; return; }
      toast(e.message);
    }
  }

  function renderScores(data) {
    const { series, totals, streak, bestDay, period } = data;
    $('#sub-period').textContent = period === 'week' ? 'Last 7 days' : period === 'month' ? 'Last 30 days' : 'Last 365 days';
    $('#sum-points').textContent = totals.points;
    $('#sum-completed').textContent = totals.completed;
    $('#sum-total').textContent = totals.tasks;
    $('#sum-rate').textContent = Math.round((totals.avgRate || 0) * 100);
    $('#sum-streak').textContent = streak;

    const maxPoints = Math.max(1, ...series.map(s => s.total_points));
    const recentSeries = period === 'week' ? series : series.slice(-14);

    $('#bar-chart').innerHTML = recentSeries.map(s => {
      const h = Math.max(4, Math.round((s.total_points / maxPoints) * 130));
      const perfect = s.total_tasks > 0 && s.completion_rate >= 1;
      return `
        <div class="bar-col">
          <div class="bar-value">${s.total_points || ''}</div>
          <div class="bar ${perfect ? 'perfect' : ''}" style="height:${h}px;" title="${fullDate(s.date)}: ${s.total_points} pts"></div>
          <div class="bar-label">${shortDate(s.date).slice(0, 3)}</div>
        </div>
      `;
    }).join('');

    if (bestDay && bestDay.total_points > 0) {
      $('#best-day-content').innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="font-size:40px;">🌟</div>
          <div>
            <div style="font-weight:800;font-size:16px;">${fullDate(bestDay.date)}</div>
            <div style="color:var(--text-muted);font-size:13px;">${bestDay.total_points} pts · ${bestDay.completed_tasks}/${bestDay.total_tasks} tasks · ${Math.round(bestDay.completion_rate*100)}% complete</div>
          </div>
        </div>
      `;
    } else {
      $('#best-day-content').textContent = 'Complete some tasks to see your best day!';
    }
  }

  async function loadLeaderboard() {
    try {
      const data = await api('/scores/leaderboard?period=' + state.period);
      renderLeaderboard(data.leaderboard);
    } catch (e) {
      // noop
    }
  }

  function renderLeaderboard(rows) {
    if (rows.length === 0) {
      $('#leaderboard').innerHTML = '<div style="color:var(--text-muted);padding:12px;text-align:center;">No kids yet.</div>';
      return;
    }
    $('#leaderboard').innerHTML = rows.map((r, i) => `
      <div class="lb-item rank-${i+1}">
        <div class="lb-rank">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</div>
        <div class="lb-avatar" style="background:${r.color}33">${r.avatar}</div>
        <div class="lb-body">
          <div class="lb-name">${escapeHtml(r.name)}</div>
          <div class="lb-stats">${r.completed}/${r.tasks} tasks</div>
        </div>
        <div class="lb-points">${r.points}</div>
      </div>
    `).join('');
  }

  function wireEvents() {
    $('#back-btn').addEventListener('click', () => { window.location.href = '/'; });
    $$('.period-tab').forEach(b => b.addEventListener('click', () => {
      state.period = b.dataset.period;
      $$('.period-tab').forEach(x => x.classList.toggle('active', x === b));
      loadScores();
    }));
  }

  async function boot() {
    state.session = loadSession();
    if (!state.session) { window.location.href = '/'; return; }
    wireEvents();
    try {
      await loadKids();
      loadScores();
    } catch (e) {
      if (e.status === 401) window.location.href = '/';
      else toast(e.message);
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
