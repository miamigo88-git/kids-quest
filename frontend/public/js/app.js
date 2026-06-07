(function () {
  const API = '/api';
  const SESSION_KEY = 'kq_session';
  const EMOJI_AVATARS = ['🐱','🐶','🦊','🐻','🐼','🐨','🦁','🐯','🐸','🐵','🦄','🐰','🐹','🐭','🐮','🐷','🦉','🐧','🐤','🦋','🐙','🦖','🐳','🦓','🦒','🐢','🐠','🦕','🐲','🌈','⭐','🎀'];
  const COLORS = ['#FFB6C1','#FFD180','#FFF59D','#A5D6A7','#80DEEA','#B39DDB','#F48FB1','#90CAF9','#FFAB91','#CE93D8'];
  const TASK_ICONS = ['⭐','🪥','🛏️','📚','✏️','🧸','🥦','💧','⚽','🧹','💖','🎨','🎵','🧘','🚿','🍎','🎯','🏃','🐕','🌱','🧮','✨','🎲','🚲','🏊','🎭','💪','🎮','🧩','📝'];

  const state = {
    profiles: [],
    session: null,
    currentKidTasks: null,
    selectedAvatar: '🐱',
    selectedColor: '#FFB6C1',
    selectedTaskIcon: '⭐',
    pinTarget: null,
    pinValue: '',
    parentActiveTab: 'kids',
    parentKids: [],
    parentSelectedKidId: null
  };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function loadSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch { return null; }
  }
  function saveSession(s) { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
  function clearSession() { localStorage.removeItem(SESSION_KEY); }

  async function api(path, opts) {
    opts = opts || {};
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (state.session && state.session.token) headers.Authorization = 'Bearer ' + state.session.token;
    const res = await fetch(API + path, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) {
      const err = new Error((data && data.error) || ('HTTP ' + res.status));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function showScreen(name) {
    $$('.screen').forEach(s => s.classList.remove('active'));
    $('#screen-' + name).classList.add('active');
  }

  function toast(msg, ms) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add('hidden'), ms || 2200);
  }

  function todayDate() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  function prettyDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }

  // ============ Profile / Login ============
  async function loadProfiles() {
    try {
      state.profiles = await api('/auth/profiles');
      renderProfiles();
    } catch (e) {
      $('#profile-grid').innerHTML = `<div class="empty-profiles">Couldn't load profiles. ${e.message}</div>`;
    }
  }

  function renderProfiles() {
    const grid = $('#profile-grid');
    const kids = state.profiles.filter(p => p.role === 'kid');
    if (kids.length === 0) {
      grid.innerHTML = `<div class="empty-profiles">
        <div style="font-size:48px;margin-bottom:8px;">👋</div>
        <div style="font-weight:700;margin-bottom:4px;">No kids yet!</div>
        <div style="font-size:14px;">Log in as parent below to add your first kid.</div>
      </div>`;
      return;
    }
    grid.innerHTML = kids.map(p => `
      <button class="profile-card kid-profile" data-username="${p.username}" data-pin="${p.pin_required}">
        <div class="pf-avatar" style="background:${p.color}33">${p.avatar}</div>
        <div class="pf-name">${escapeHtml(p.name)}</div>
        <div class="pf-role">${p.pin_required ? '🔒 PIN' : 'Tap to play'}</div>
      </button>
    `).join('');

    $$('.kid-profile').forEach(b => b.addEventListener('click', () => onProfileSelect(b.dataset.username, b.dataset.pin === '1')));
  }

  function onProfileSelect(username, pinRequired) {
    const profile = state.profiles.find(p => p.username === username);
    if (!profile) return;
    if (pinRequired) {
      showPinPad(profile);
    } else {
      doLogin(username, null);
    }
  }

  function showPinPad(profile) {
    state.pinTarget = profile;
    state.pinValue = '';
    $('#profile-grid').classList.add('hidden');
    $('#pin-pad').classList.remove('hidden');
    $('#pin-target-avatar').textContent = profile.avatar;
    $('#pin-target-name').textContent = profile.name;
    $('#pin-error').textContent = '';
    updatePinDisplay();
  }

  function hidePinPad() {
    $('#profile-grid').classList.remove('hidden');
    $('#pin-pad').classList.add('hidden');
    state.pinTarget = null;
    state.pinValue = '';
  }

  function updatePinDisplay() {
    const dots = $$('.pin-dot');
    dots.forEach((d, i) => d.classList.toggle('filled', i < state.pinValue.length));
  }

  async function doLogin(username, pin) {
    try {
      const res = await api('/auth/login', { method: 'POST', body: { username, pin } });
      state.session = res;
      saveSession(res);
      enterAfterLogin();
    } catch (e) {
      $('#pin-error').textContent = e.message;
      state.pinValue = '';
      updatePinDisplay();
    }
  }

  function enterAfterLogin() {
    if (state.session.user.role === 'parent') {
      showScreen('parent');
      loadParentScreen();
    } else {
      showScreen('kid');
      loadKidDashboard(state.session.user.id);
    }
  }

  function showParentLoginPrompt() {
    const parent = state.profiles.find(p => p.role === 'parent');
    if (!parent) return toast('No parent account found');
    showPinPad(parent);
  }

  // ============ Kid dashboard ============
  async function loadKidDashboard(kidId) {
    try {
      const data = await api('/tasks/kid/' + kidId + '?date=' + todayDate());
      state.currentKidTasks = data;
      renderKidDashboard(data);
    } catch (e) {
      if (e.status === 401) { logout(); return; }
      toast(e.message);
    }
  }

  function renderKidDashboard(data) {
    const { kid, tasks, score, date } = data;
    $('#kid-name').textContent = `Hi, ${kid.name}!`;
    $('#kid-avatar').textContent = kid.avatar;
    $('#kid-avatar').style.background = kid.color + '33';
    $('#today-date').textContent = prettyDate(date);

    $('#stat-points').textContent = score.total_points;
    $('#stat-done').textContent = score.completed_tasks;
    $('#stat-total').textContent = score.total_tasks;
    const pct = score.total_tasks > 0 ? Math.round(score.completion_rate * 100) : 0;
    $('#stat-percent').textContent = pct;
    $('#progress-fill').style.width = pct + '%';

    const mood = window.CatMascot.moodFor(score.completion_rate, score.total_tasks);
    window.CatMascot.render($('#cat-container'), mood);
    $('#cat-bubble').textContent = window.CatMascot.messageFor(mood, score.completed_tasks, score.total_tasks);

    const list = $('#tasks-list');
    if (tasks.length === 0) {
      list.innerHTML = `<div class="empty-tasks">
        <div class="empty-emoji">🎈</div>
        <div style="font-weight:700;margin-bottom:4px;">No quests yet!</div>
        <div>Ask a parent to add some tasks for you.</div>
      </div>`;
      return;
    }

    list.innerHTML = tasks.map(t => `
      <div class="task-card ${t.completion_id ? 'done' : ''}" data-id="${t.id}" data-done="${t.completion_id ? '1' : '0'}">
        <div class="task-icon">${t.icon || '⭐'}</div>
        <div class="task-body">
          <div class="task-title">${escapeHtml(t.title)}</div>
          ${t.description ? `<div class="task-desc">${escapeHtml(t.description)}</div>` : ''}
          <div class="task-meta">
            <span class="task-points">${t.points} pts</span>
            <span class="task-cat">${escapeHtml(t.category)}</span>
            ${!t.is_default ? '<span class="task-badge-extra">⭐ Today only</span>' : ''}
          </div>
        </div>
        <div class="task-check">✓</div>
      </div>
    `).join('');

    $$('.task-card', list).forEach(card => card.addEventListener('click', () => toggleTask(card)));
  }

  async function toggleTask(card) {
    const id = card.dataset.id;
    const done = card.dataset.done === '1';
    try {
      const endpoint = done ? '/uncomplete' : '/complete';
      const res = await api('/tasks/' + id + endpoint, {
        method: 'POST',
        body: { date: state.currentKidTasks.date }
      });
      card.dataset.done = done ? '0' : '1';
      card.classList.toggle('done', !done);

      const oldRate = state.currentKidTasks.score.completion_rate;
      Object.assign(state.currentKidTasks.score, res.score);
      const task = state.currentKidTasks.tasks.find(t => t.id === id);
      if (task) task.completion_id = done ? null : 'temp';

      const pct = res.score.total_tasks > 0 ? Math.round(res.score.completion_rate * 100) : 0;
      $('#stat-points').textContent = res.score.total_points;
      $('#stat-done').textContent = res.score.completed_tasks;
      $('#stat-total').textContent = res.score.total_tasks;
      $('#stat-percent').textContent = pct;
      $('#progress-fill').style.width = pct + '%';

      const mood = window.CatMascot.moodFor(res.score.completion_rate, res.score.total_tasks);
      window.CatMascot.render($('#cat-container'), mood);
      $('#cat-bubble').textContent = window.CatMascot.messageFor(mood, res.score.completed_tasks, res.score.total_tasks);

      if (!done) {
        window.CatMascot.celebrate($('#cat-container'));
        if (res.score.completion_rate >= 1 && oldRate < 1) {
          launchConfetti();
          toast('🎉 ALL DONE! Amazing!');
        }
      }
    } catch (e) {
      toast(e.message);
    }
  }

  // ============ Parent screen ============
  async function loadParentScreen() {
    try {
      state.parentKids = await api('/kids');
      renderParentKids();
      renderTaskKidSelector();
      if (state.parentKids.length > 0) {
        if (!state.parentSelectedKidId || !state.parentKids.find(k => k.id === state.parentSelectedKidId)) {
          state.parentSelectedKidId = state.parentKids[0].id;
        }
        $('#task-kid-select').value = state.parentSelectedKidId;
        loadParentTasks();
      } else {
        $('#parent-tasks-list').innerHTML = '<div class="empty-tasks"><div class="empty-emoji">🐣</div>Add a kid first!</div>';
      }
    } catch (e) {
      if (e.status === 401) { logout(); return; }
      toast(e.message);
    }
  }

  function renderParentKids() {
    const list = $('#parent-kids-list');
    if (state.parentKids.length === 0) {
      list.innerHTML = '<div class="empty-tasks"><div class="empty-emoji">👶</div>No kids yet. Tap + Add Kid above!</div>';
      return;
    }
    list.innerHTML = state.parentKids.map(k => `
      <div class="parent-item" data-id="${k.id}">
        <div class="item-avatar" style="background:${k.color}33">${k.avatar}</div>
        <div class="item-body">
          <div class="item-title">${escapeHtml(k.name)}</div>
          <div class="item-sub">${k.pin_required ? '🔒 PIN protected' : 'No PIN'} · username: ${escapeHtml(k.username)}</div>
        </div>
        <div class="item-actions">
          <button class="mini-btn" data-action="edit-kid" data-id="${k.id}">✏️</button>
          <button class="mini-btn danger" data-action="delete-kid" data-id="${k.id}">🗑️</button>
        </div>
      </div>
    `).join('');

    $$('[data-action="edit-kid"]', list).forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      openKidModal(state.parentKids.find(k => k.id === b.dataset.id));
    }));
    $$('[data-action="delete-kid"]', list).forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      confirmDeleteKid(b.dataset.id);
    }));
  }

  function renderTaskKidSelector() {
    const sel = $('#task-kid-select');
    sel.innerHTML = state.parentKids.map(k => `<option value="${k.id}">${k.avatar} ${escapeHtml(k.name)}</option>`).join('');
  }

  async function loadParentTasks() {
    if (!state.parentSelectedKidId) return;
    try {
      const data = await api('/tasks/kid/' + state.parentSelectedKidId + '?date=' + todayDate());
      renderParentTasks(data.tasks);
    } catch (e) {
      toast(e.message);
    }
  }

  function renderParentTasks(tasks) {
    const list = $('#parent-tasks-list');
    if (tasks.length === 0) {
      list.innerHTML = '<div class="empty-tasks"><div class="empty-emoji">📝</div>No tasks yet for this kid.<br/>Use the buttons above to add some.</div>';
      return;
    }
    list.innerHTML = tasks.map(t => `
      <div class="parent-item" data-id="${t.id}">
        <div class="item-avatar">${t.icon || '⭐'}</div>
        <div class="item-body">
          <div class="item-title">${escapeHtml(t.title)} <span class="task-points" style="font-size:11px;">${t.points}p</span></div>
          <div class="item-sub">${t.is_default ? '🔁 Daily' : '⭐ One-time'} · ${escapeHtml(t.category)}${t.description ? ' · ' + escapeHtml(t.description) : ''}</div>
        </div>
        <div class="item-actions">
          <button class="mini-btn" data-action="edit-task" data-id="${t.id}">✏️</button>
          <button class="mini-btn danger" data-action="delete-task" data-id="${t.id}">🗑️</button>
        </div>
      </div>
    `).join('');

    $$('[data-action="edit-task"]', list).forEach(b => b.addEventListener('click', () => openTaskModal(tasks.find(t => t.id === b.dataset.id))));
    $$('[data-action="delete-task"]', list).forEach(b => b.addEventListener('click', () => confirmDeleteTask(b.dataset.id)));
  }

  // ============ Modals ============
  function openModal(html) {
    $('#modal-content').innerHTML = html;
    $('#modal-root').classList.remove('hidden');
    $('.modal-backdrop').onclick = closeModal;
  }
  function closeModal() {
    $('#modal-root').classList.add('hidden');
    $('#modal-content').innerHTML = '';
  }

  function emojiPicker(selected, onSelect) {
    return `<div class="emoji-grid">
      ${EMOJI_AVATARS.map(e => `<button type="button" class="emoji-pick ${e === selected ? 'selected' : ''}" data-e="${e}">${e}</button>`).join('')}
    </div>`;
  }

  function colorPicker(selected) {
    return `<div class="color-grid">
      ${COLORS.map(c => `<button type="button" class="color-pick ${c === selected ? 'selected' : ''}" style="background:${c}" data-c="${c}"></button>`).join('')}
    </div>`;
  }

  function openKidModal(kid) {
    state.selectedAvatar = (kid && kid.avatar) || '🐱';
    state.selectedColor = (kid && kid.color) || '#FFB6C1';
    const isEdit = !!kid;
    openModal(`
      <div class="modal-body">
        <h3>${isEdit ? 'Edit Kid' : 'Add New Kid'}</h3>
        <div class="form-row">
          <label>Name</label>
          <input id="kid-name-input" placeholder="e.g. Mia" value="${kid ? escapeAttr(kid.name) : ''}" maxlength="40"/>
        </div>
        <div class="form-row">
          <label>Avatar</label>
          ${emojiPicker(state.selectedAvatar)}
        </div>
        <div class="form-row">
          <label>Theme Color</label>
          ${colorPicker(state.selectedColor)}
        </div>
        <div class="form-row">
          <label>PIN (optional, 3-6 digits — leave blank for no PIN)</label>
          <input id="kid-pin-input" type="tel" inputmode="numeric" placeholder="${isEdit ? 'Leave blank to keep current' : 'Optional'}" maxlength="6"/>
        </div>
        <div class="actions">
          <button class="secondary-btn" id="kid-cancel">Cancel</button>
          <button class="primary-btn" id="kid-save">${isEdit ? 'Save' : 'Add Kid'}</button>
        </div>
      </div>
    `);

    $$('.emoji-pick').forEach(b => b.addEventListener('click', () => {
      state.selectedAvatar = b.dataset.e;
      $$('.emoji-pick').forEach(x => x.classList.toggle('selected', x.dataset.e === state.selectedAvatar));
    }));
    $$('.color-pick').forEach(b => b.addEventListener('click', () => {
      state.selectedColor = b.dataset.c;
      $$('.color-pick').forEach(x => x.classList.toggle('selected', x.dataset.c === state.selectedColor));
    }));
    $('#kid-cancel').addEventListener('click', closeModal);
    $('#kid-save').addEventListener('click', async () => {
      const name = $('#kid-name-input').value.trim();
      const pin = $('#kid-pin-input').value.trim();
      if (!name) return toast('Name is required');
      try {
        const body = { name, avatar: state.selectedAvatar, color: state.selectedColor };
        if (isEdit) {
          if (pin) body.pin = pin;
          await api('/kids/' + kid.id, { method: 'PUT', body });
          toast('Saved!');
        } else {
          if (pin) body.pin = pin;
          await api('/kids', { method: 'POST', body });
          toast('Kid added! 🎉');
        }
        closeModal();
        loadParentScreen();
      } catch (e) { toast(e.message); }
    });
  }

  function confirmDeleteKid(id) {
    const kid = state.parentKids.find(k => k.id === id);
    if (!kid) return;
    openModal(`
      <div class="modal-body">
        <h3>Delete ${escapeHtml(kid.name)}?</h3>
        <p style="margin-bottom:16px;color:var(--text-muted);">This will permanently remove this kid and all their tasks, completions and scores. Cannot be undone.</p>
        <div class="actions">
          <button class="secondary-btn" id="del-cancel">Keep</button>
          <button class="danger-btn" id="del-confirm" style="flex:1;">Delete</button>
        </div>
      </div>
    `);
    $('#del-cancel').addEventListener('click', closeModal);
    $('#del-confirm').addEventListener('click', async () => {
      try {
        await api('/kids/' + id, { method: 'DELETE' });
        toast('Kid removed');
        closeModal();
        if (state.parentSelectedKidId === id) state.parentSelectedKidId = null;
        loadParentScreen();
      } catch (e) { toast(e.message); }
    });
  }

  function openTaskModal(task) {
    state.selectedTaskIcon = (task && task.icon) || '⭐';
    const isEdit = !!task;
    const kidOpts = state.parentKids.map(k => `<option value="${k.id}" ${state.parentSelectedKidId === k.id ? 'selected' : ''}>${k.avatar} ${escapeHtml(k.name)}</option>`).join('');
    openModal(`
      <div class="modal-body">
        <h3>${isEdit ? 'Edit Task' : 'Add Task'}</h3>
        <div class="form-row">
          <label>Title</label>
          <input id="task-title" placeholder="e.g. Brush Teeth" value="${task ? escapeAttr(task.title) : ''}" maxlength="60"/>
        </div>
        <div class="form-row">
          <label>Description (optional)</label>
          <input id="task-desc" placeholder="Short note for the kid" value="${task ? escapeAttr(task.description || '') : ''}" maxlength="120"/>
        </div>
        <div class="form-row">
          <label>Icon</label>
          <div class="emoji-grid">
            ${TASK_ICONS.map(e => `<button type="button" class="emoji-pick ${e === state.selectedTaskIcon ? 'selected' : ''}" data-e="${e}">${e}</button>`).join('')}
          </div>
        </div>
        <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <label>Category</label>
            <select id="task-cat">
              <option value="daily">Daily</option>
              <option value="hygiene">Hygiene</option>
              <option value="chores">Chores</option>
              <option value="learning">Learning</option>
              <option value="health">Health</option>
              <option value="behavior">Behavior</option>
              <option value="fun">Fun</option>
            </select>
          </div>
          <div>
            <label>Points</label>
            <input id="task-points" type="number" min="1" max="100" value="${task ? task.points : 10}"/>
          </div>
        </div>
        ${!isEdit ? `
          <div class="form-row">
            <label>Assign to</label>
            <select id="task-assignee">${kidOpts}</select>
          </div>
          <div class="form-row">
            <label>Type</label>
            <select id="task-type">
              <option value="default">🔁 Daily (recurring every day)</option>
              <option value="once">⭐ One-time (specific day only)</option>
            </select>
          </div>
          <div class="form-row hidden" id="task-date-row">
            <label>Date</label>
            <input id="task-date" type="date" value="${todayDate()}"/>
          </div>
        ` : ''}
        <div class="actions">
          <button class="secondary-btn" id="task-cancel">Cancel</button>
          <button class="primary-btn" id="task-save">${isEdit ? 'Save' : 'Add Task'}</button>
        </div>
      </div>
    `);
    if (task) $('#task-cat').value = task.category;

    $$('.emoji-pick').forEach(b => b.addEventListener('click', () => {
      state.selectedTaskIcon = b.dataset.e;
      $$('.emoji-pick').forEach(x => x.classList.toggle('selected', x.dataset.e === state.selectedTaskIcon));
    }));

    if (!isEdit) {
      $('#task-type').addEventListener('change', e => {
        $('#task-date-row').classList.toggle('hidden', e.target.value !== 'once');
      });
    }

    $('#task-cancel').addEventListener('click', closeModal);
    $('#task-save').addEventListener('click', async () => {
      const title = $('#task-title').value.trim();
      const description = $('#task-desc').value.trim();
      const category = $('#task-cat').value;
      const points = parseInt($('#task-points').value, 10) || 10;
      if (!title) return toast('Title required');
      try {
        if (isEdit) {
          await api('/tasks/' + task.id, { method: 'PUT', body: { title, description, icon: state.selectedTaskIcon, category, points } });
          toast('Task updated');
        } else {
          const assigned_to = $('#task-assignee').value;
          const type = $('#task-type').value;
          const body = {
            title, description, icon: state.selectedTaskIcon, category, points, assigned_to,
            is_default: type === 'default',
            specific_date: type === 'once' ? $('#task-date').value : null
          };
          await api('/tasks', { method: 'POST', body });
          toast('Task added! 🎯');
        }
        closeModal();
        loadParentTasks();
      } catch (e) { toast(e.message); }
    });
  }

  function confirmDeleteTask(id) {
    openModal(`
      <div class="modal-body">
        <h3>Delete this task?</h3>
        <p style="margin-bottom:16px;color:var(--text-muted);">It will be removed for all dates.</p>
        <div class="actions">
          <button class="secondary-btn" id="del-cancel">Keep</button>
          <button class="danger-btn" id="del-confirm" style="flex:1;">Delete</button>
        </div>
      </div>
    `);
    $('#del-cancel').addEventListener('click', closeModal);
    $('#del-confirm').addEventListener('click', async () => {
      try {
        await api('/tasks/' + id, { method: 'DELETE' });
        toast('Task deleted');
        closeModal();
        loadParentTasks();
      } catch (e) { toast(e.message); }
    });
  }

  function openSettingsModal() {
    openModal(`
      <div class="modal-body">
        <h3>Parent Settings</h3>
        <div class="form-row">
          <label>Change PIN</label>
          <input id="cur-pin" type="tel" inputmode="numeric" placeholder="Current PIN" maxlength="6"/>
          <input id="new-pin" type="tel" inputmode="numeric" placeholder="New PIN (3-6 digits)" maxlength="6" style="margin-top:8px;"/>
        </div>
        <div class="actions">
          <button class="secondary-btn" id="set-cancel">Close</button>
          <button class="primary-btn" id="set-save">Update PIN</button>
        </div>
      </div>
    `);
    $('#set-cancel').addEventListener('click', closeModal);
    $('#set-save').addEventListener('click', async () => {
      const cur = $('#cur-pin').value.trim();
      const newPin = $('#new-pin').value.trim();
      if (!newPin || newPin.length < 3) return toast('New PIN must be 3+ digits');
      try {
        await api('/auth/change-pin', { method: 'POST', body: { currentPin: cur, newPin } });
        toast('PIN changed!');
        closeModal();
      } catch (e) { toast(e.message); }
    });
  }

  // ============ Confetti ============
  function launchConfetti() {
    const c = $('#confetti');
    const colors = ['#7C3AED','#EC4899','#F59E0B','#10B981','#3B82F6','#F472B6'];
    for (let i = 0; i < 80; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.left = Math.random() * 100 + '%';
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      p.style.animationDelay = Math.random() * 0.5 + 's';
      p.style.animationDuration = (2 + Math.random() * 2) + 's';
      if (Math.random() > 0.5) p.style.borderRadius = '50%';
      c.appendChild(p);
      setTimeout(() => p.remove(), 4000);
    }
  }

  // ============ Util ============
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  function logout() {
    if (state.session) {
      api('/auth/logout', { method: 'POST' }).catch(() => {});
    }
    clearSession();
    state.session = null;
    state.currentKidTasks = null;
    showScreen('login');
    hidePinPad();
    loadProfiles();
  }

  // ============ Event wiring ============
  function wireEvents() {
    $('#pin-back').addEventListener('click', hidePinPad);
    $('#show-parent-login').addEventListener('click', showParentLoginPrompt);
    $$('.pin-key[data-key]').forEach(b => b.addEventListener('click', () => {
      if (state.pinValue.length < 6) {
        state.pinValue += b.dataset.key;
        updatePinDisplay();
        $('#pin-error').textContent = '';
        if (state.pinValue.length >= 4) {
          // auto-attempt at 4 digits, but only if no longer length entry
        }
      }
    }));
    $('#pin-clear').addEventListener('click', () => {
      state.pinValue = state.pinValue.slice(0, -1);
      updatePinDisplay();
    });
    $('#pin-ok').addEventListener('click', () => {
      if (state.pinTarget && state.pinValue.length >= 3) {
        doLogin(state.pinTarget.username, state.pinValue);
      } else {
        $('#pin-error').textContent = 'Enter at least 3 digits';
      }
    });

    $('#kid-logout').addEventListener('click', logout);
    $('#kid-scores').addEventListener('click', () => {
      window.location.href = '/scores.html';
    });

    $('#parent-logout').addEventListener('click', logout);
    $('#parent-scores').addEventListener('click', () => { window.location.href = '/scores.html'; });
    $('#parent-settings').addEventListener('click', openSettingsModal);

    $$('.tab-btn').forEach(b => b.addEventListener('click', () => {
      const tab = b.dataset.tab;
      state.parentActiveTab = tab;
      $$('.tab-btn').forEach(x => x.classList.toggle('active', x.dataset.tab === tab));
      $$('.tab-pane').forEach(x => x.classList.toggle('active', x.id === 'tab-' + tab));
    }));

    $('#add-kid-btn').addEventListener('click', () => openKidModal(null));
    $('#add-task-btn').addEventListener('click', () => {
      if (state.parentKids.length === 0) return toast('Add a kid first!');
      openTaskModal(null);
    });
    $('#seed-defaults-btn').addEventListener('click', async () => {
      if (!state.parentSelectedKidId) return toast('Select a kid first');
      try {
        const res = await api('/tasks/seed-defaults/' + state.parentSelectedKidId, { method: 'POST' });
        toast(`Added ${res.count} starter tasks!`);
        loadParentTasks();
      } catch (e) { toast(e.message); }
    });
    $('#task-kid-select').addEventListener('change', e => {
      state.parentSelectedKidId = e.target.value;
      loadParentTasks();
    });
  }

  // ============ Boot ============
  async function boot() {
    wireEvents();
    state.session = loadSession();
    if (state.session && state.session.token) {
      try {
        await api('/auth/me');
        enterAfterLogin();
        return;
      } catch (e) {
        clearSession();
        state.session = null;
      }
    }
    showScreen('login');
    loadProfiles();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
