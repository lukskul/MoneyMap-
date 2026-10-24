/* Money Map front end. API routes assume /api/auth/* and /api/{metals,vault,banks,investments,profile,spot-prices}. */
(() => {
  'use strict';

  const API_BASE = ''; // Same-origin recommended: serve this UI from the Express server.
  // // const RESOURCE_CONFIG = {
  // //   metals: { title: 'Metals', endpoint: '/api/metals', collection: 'holdings', addLabel: 'Add holding', example: { name: 'Gold', type: 'Gold', quantity: 1, unit: 'oz', purchasePrice: 0 }, subtitleKeys: ['type', 'quantity', 'unit', 'weight', 'purity'], amountKeys: ['value', 'currentValue', 'purchasePrice', 'totalValue', 'price'] },
  // //   vault: { title: 'Vault', endpoint: '/api/vault', collection: 'vault', addLabel: 'Add item', example: { name: 'New vault item', description: '', value: 0 }, subtitleKeys: ['description', 'category', 'location', 'quantity'], amountKeys: ['value', 'estimatedValue', 'amount'] },
  // //   banks: { title: 'Bank accounts', endpoint: '/api/banks', collection: 'accounts', addLabel: 'Add account', example: { name: 'Checking account', institution: '', balance: 0, accountType: 'Checking' }, subtitleKeys: ['institution', 'bank', 'accountType', 'type', 'lastFour'], amountKeys: ['balance', 'amount', 'value'] },
  // //   investments: { title: 'Investments', endpoint: '/api/investments', collection: 'investments', addLabel: 'Add investment', example: { name: 'New investment', ticker: '', quantity: 0, value: 0 }, subtitleKeys: ['ticker', 'type', 'quantity', 'shares', 'institution'], amountKeys: ['value', 'currentValue', 'marketValue', 'amount', 'balance'] }
  // // };

  const state = { mode: 'login', user: null, profile: {}, records: { metals: [], vault: [], banks: [], investments: [] }, editing: null, pendingDelete: null };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(value) || 0);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
    });
    const raw = await response.text();
    let data = null;
    if (raw) { try { data = JSON.parse(raw); } catch { data = { message: raw }; } }
    if (response.status === 401 && !path.startsWith('/api/auth/')) {
      showAuth();
      throw new Error('Your session has ended. Please sign in again.');
    }
    if (!response.ok) throw new Error(data?.error || data?.message || `Request failed (${response.status})`);
    return data;
  }

  function showAuth() {
    $('#dashboard-screen').classList.add('hidden');
    $('#auth-screen').classList.remove('hidden');
    $('#password').value = '';
  }
  function showDashboard() {
    $('#auth-screen').classList.add('hidden');
    $('#dashboard-screen').classList.remove('hidden');
    const username = state.user?.username || 'User';
    $('#user-name').textContent = username;
    $('#user-avatar').textContent = username.slice(0, 1).toUpperCase();
  }
  function authMode(mode) {
    state.mode = mode;
    const register = mode === 'register';
    $('#auth-eyebrow').textContent = register ? 'GET STARTED' : 'WELCOME BACK';
    $('#auth-title').textContent = register ? 'Create your account' : 'Sign in to Money Map';
    $('#auth-description').textContent = register ? 'Create a private workspace for your finances.' : 'Pick up where you left off.';
    $('#auth-submit').textContent = register ? 'Create account' : 'Sign in';
    $('#auth-switch-copy').textContent = register ? 'Already have an account?' : 'New to Money Map?';
    $('#auth-switch').textContent = register ? 'Sign in' : 'Create an account';
    $('#password').autocomplete = register ? 'new-password' : 'current-password';
    $('#password').minLength = register ? 12 : 1;
    $('#password-help').classList.toggle('hidden', !register);
    $('#auth-message').textContent = '';
  }

  $('#auth-switch').addEventListener('click', () => authMode(state.mode === 'login' ? 'register' : 'login'));
  $('#auth-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('#auth-submit');
    const message = $('#auth-message');
    button.disabled = true;
    message.textContent = '';
    try {
      const payload = { username: $('#username').value.trim(), password: $('#password').value };
      const result = await api(`/api/auth/${state.mode}`, { method: 'POST', body: JSON.stringify(payload) });
      state.user = result.user || result;
      $('#password').value = '';
      showDashboard();
      await loadAll();
      navigate('overview');
    } catch (error) {
      message.textContent = error.message || 'Could not sign in.';
    } finally { button.disabled = false; }
  });


async function checkSession() {
  try {
    const res = await fetch('/api/auth/me', {
      credentials: 'include'
    });

    if (res.status === 401) {
      console.info('Money Map: No active session. Please log in.');
      showAuth();
      return;
    }

    if (!res.ok) {
      console.error(
        `Money Map: Session check failed (${res.status}).`
      );
      showAuth();
      return;
    }

    const data = await res.json();

    state.user = data.user;
    console.info('Money Map: Existing session restored.');

    showDashboard();
    await loadAll();

  } catch (error) {
    console.error('Money Map: Unable to check session.', error);
    showAuth();
  }
}

  // $('#logout-button').addEventListener('click', async () => {
  //   try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* Still return to the sign-in screen. */ }
  //   state.user = null;
  //   state.records = { metals: [], vault: [], banks: [], investments: [] };
  //   state.profile = {};
  //   showAuth();
  // });

  // const titles = { overview: 'Overview', metals: 'Metals', vault: 'Vault', banks: 'Bank accounts', investments: 'Investments', profile: 'Goals & profile' };
  // function navigate(view) {
  //   if (!titles[view]) return;
  //   $$('.view-section').forEach(section => section.classList.add('hidden'));
  //   $(`#view-${view}`).classList.remove('hidden');
  //   $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  //   $('#page-title').textContent = titles[view];
  //   $('#page-eyebrow').textContent = view === 'overview' ? 'YOUR FINANCIAL SNAPSHOT' : 'MONEY MAP WORKSPACE';
  //   window.scrollTo({ top: 0, behavior: 'smooth' });
  // }
  // document.addEventListener('click', event => {
  //   const viewButton = event.target.closest('[data-view]');
  //   if (viewButton) navigate(viewButton.dataset.view);
  //   const addButton = event.target.closest('[data-open-editor]');
  //   if (addButton) openEditor(addButton.dataset.openEditor);
  //   const editButton = event.target.closest('[data-edit-record]');
  //   if (editButton) openEditor(editButton.dataset.editRecord, Number(editButton.dataset.index));
  //   const deleteButton = event.target.closest('[data-delete-record]');
  //   if (deleteButton) askDelete(deleteButton.dataset.deleteRecord, Number(deleteButton.dataset.index));
  // });
  // $('#refresh-button').addEventListener('click', async () => {
  //   $('#refresh-button').disabled = true;
  //   try { await loadAll(); showGlobal('Your data has been refreshed.', 'success'); }
  //   catch (error) { showGlobal(error.message, 'error'); }
  //   finally { $('#refresh-button').disabled = false; }
  // });

  function showGlobal(message, type = '') {
    const element = $('#global-message');
    element.textContent = message;
    element.className = `global-message ${type}`;
    element.classList.remove('hidden');
    if (!message) element.classList.add('hidden');
  }
  function unwrapCollection(data, key) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data[key])) return data[key];
    return [];
  }
  async function loadResource(name) {
    const config = RESOURCE_CONFIG[name];
    const data = await api(config.endpoint);
    state.records[name] = unwrapCollection(data, config.collection);
    renderRecords(name);
  }
  async function loadProfile() {
    const data = await api('/api/profile');
    state.profile = data?.profile || data || {};
    const profile = state.profile;
    ['monthlyIncome', 'monthlyExpenses', 'emergencyMonths', 'focusMode', 'savingsSubgoal', 'loanAmount', 'downPayment', 'monthsToGoal'].forEach(key => {
      const field = $(`#${key}`);
      if (field) field.value = profile[key] ?? (key === 'emergencyMonths' ? 6 : key === 'focusMode' || key === 'savingsSubgoal' ? '' : 0);
    });
    renderOverview();
  }

async function loadPrices() {
  let prices;

  try {
    prices = await api('/api/spot-prices');

    if (
      !prices ||
      typeof prices.gold !== 'number' ||
      typeof prices.silver !== 'number' ||
      typeof prices.copper !== 'number'
    ) {
      throw new Error('Invalid spot price data');
    }

    localStorage.setItem('spotCache', JSON.stringify(prices));
  } catch (error) {
    console.warn('Could not fetch spot prices:', error.message);

    try {
      prices = JSON.parse(localStorage.getItem('spotCache')) || {};
    } catch {
      prices = {};
    }
  }

  const gold = Number(prices.gold) || 0;
  const silver = Number(prices.silver) || 0;
  const copper = Number(prices.copper) || 0;

  // Overview spot-price panel
  if ($('#price-gold')) $('#price-gold').textContent = money(gold);
  if ($('#price-silver')) $('#price-silver').textContent = money(silver);
  if ($('#price-copper')) $('#price-copper').textContent = money(copper);

  // Metals page / bottom price display
  if ($('#goldSpot')) {
    $('#goldSpot').textContent = `Gold: ${money(gold)}`;
  }
  if ($('#silverSpot')) {
    $('#silverSpot').textContent = `Silver: ${money(silver)}`;
  }
  if ($('#copperSpot')) {
    $('#copperSpot').textContent = `Copper: ${money(copper)}`;
  }

  const updated = $('#prices-updated');
  if (updated) {
    updated.textContent = prices.lastUpdated
      ? `Updated ${new Date(prices.lastUpdated).toLocaleString()}`
      : 'Using cached prices';
  }
}

  function priceText(value) {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'number') return money(value);
    if (typeof value === 'object') return value.price != null ? money(value.price) : '—';
    const parsed = Number(value);
    return Number.isFinite(parsed) ? money(parsed) : String(value);
  }

async function loadAll() {
  showGlobal('');

  const results = await Promise.allSettled([
    loadResource('metals'),
    loadResource('vault'),
    loadResource('banks'),
    loadResource('investments'),
    loadProfile(),
    loadPrices()
  ]);

  const failures = results
    .filter(result => result.status === 'rejected')
    .map(result => result.reason?.message || 'Request failed');

  // Refresh the dedicated asset tables after authentication.
  if (state.user) {
const refreshers = [
  ['Focus settings', window.refreshFocusMode],
  ['Metals', window.refreshMetals],
  ['Vault', window.refreshVault],
  ['Banks', window.refreshBanks],
  ['Investments', window.refreshInvestments]
];

    for (const [name, refresh] of refreshers) {
      if (typeof refresh !== 'function') continue;

      try {
        await refresh();
      } catch (error) {
        console.error(`${name} refresh failed:`, error);
        failures.push(`${name}: ${error.message || 'Refresh failed'}`);
      }
    }

    // Run totals after the asset buckets have refreshed.
    if (window.refreshVaultAssets) {
      window.refreshVaultAssets();
    }

    if (window.updateTotalAssets) {
      await window.updateTotalAssets();
    }
  }

  renderOverview();

  if (window.updateEmergencyOverview) {
    await window.updateEmergencyOverview();
  }
}


/* ================= EMERGENCY OVERVIEW ================= */



window.updateEmergencyOverview = async function () {
  const amountEl = $('#metric-emergency');
  const subtitleEl = $('#emergency-subtitle');

  if (!amountEl) return;
  if (typeof window.calculateEmergencyFund !== 'function') return;

  try {
    const data = await window.calculateEmergencyFund();
    if (!data) return;

    const target = Math.max(Number(data.target) || 0, 0);
    const vaultTotal = Math.max(Number(data.vaultTotal) || 0, 0);

    // Only count money up to the emergency fund target.
    const emergencySaved = Math.min(target, vaultTotal);
    const targetIsZero = target === 0;

    // Calculate percentage from the actual saved amount.
    const percentFunded = targetIsZero
      ? 0
      : Math.min((emergencySaved / target) * 100, 100);

    amountEl.textContent = money(emergencySaved);

    let color = '#ef4444'; // Red: 0%

    if (!targetIsZero) {
      if (percentFunded >= 100) {
        color = '#22c55e'; // Green: 100%
      } else if (percentFunded >= 50) {
        color = '#f59e0b'; // Orange: 50–99%
      } else if (percentFunded >= 25) {
        color = '#eab308'; // Yellow: 25–49%
      } else if (percentFunded > 0) {
        color = '#fb923c'; // Light orange: 1–24%
      }
    }

    amountEl.style.color = color;

    if (subtitleEl) {
      subtitleEl.textContent = targetIsZero
        ? '0-month emergency goal'
        : `${Math.round(percentFunded)}% funded`;
    }
  } catch (error) {
    console.error('Error updating emergency overview:', error);
  }
};


function renderOverview() {
  const p = state.profile || {};
  const income = Number(p.monthlyIncome) || 0;
  const expenses = Number(p.monthlyExpenses) || 0;
  const months = Number(p.emergencyMonths) || 0;

  const setText = (selector, value) => {
    const element = $(selector);
    if (element) element.textContent = value;
  };

  setText('#metric-income', money(income));
  setText('#metric-expenses', money(expenses));
  setText('#metric-difference', money(income - expenses));

  // The emergency card is refreshed by updateEmergencyOverview().
  setText('#emergency-subtitle', `${months} months of expenses`);

  setText('#goal-focus', p.focusMode || 'Set your financial focus');
  setText('#goal-subgoal', p.savingsSubgoal || 'Add a savings goal in your profile.');
  setText('#goal-loan', money(p.loanAmount));
  setText('#goal-downpayment', money(p.downPayment));
  setText('#goal-months', Number(p.monthsToGoal) > 0 ? p.monthsToGoal : '—');
}


  function recordName(record, index) {
    return record?.name || record?.title || record?.description || record?.ticker || record?.institution || `${RESOURCE_CONFIG[state.editing?.resource]?.title || 'Record'} ${index + 1}`;
  }
  function firstValue(record, keys) {
    for (const key of keys) if (record?.[key] !== undefined && record[key] !== null && record[key] !== '') return record[key];
    return null;
  }
  function renderRecords(name) {
    const config = RESOURCE_CONFIG[name];
    const target = $(`#${name}-content`);
    const records = state.records[name] || [];
    if (!records.length) {
      target.innerHTML = `<div class="empty-state"><div class="empty-symbol">${name === 'metals' ? '◇' : name === 'vault' ? '▣' : name === 'banks' ? '▤' : '↗'}</div><h3>No ${config.title.toLowerCase()} yet</h3><p>Add your first record to start building your financial picture.</p><button class="primary-button" data-open-editor="${name}">＋ ${config.addLabel}</button></div>`;
      return;
    }
    target.innerHTML = `<div class="record-list">${records.map((record, index) => {
      const subtitle = config.subtitleKeys.map(key => record?.[key]).filter(value => value !== undefined && value !== null && value !== '').join(' · ') || `Record ${index + 1}`;
      const amount = firstValue(record, config.amountKeys);
      return `<article class="record-card"><div><h3>${safe(recordName(record, index))}</h3><p>${safe(subtitle)}</p></div><div class="record-meta">${amount !== null ? `<strong>${safe(money(amount))}</strong>` : ''}<div class="record-actions"><button data-edit-record="${name}" data-index="${index}">Edit JSON</button><button data-delete-record="${name}" data-index="${index}">Delete</button></div></div></article>`;
    }).join('')}</div>`;
  }

  const dialog = $('#record-dialog');
  function openEditor(name, index = null) {
    if (!RESOURCE_CONFIG[name]) return;
    state.editing = { resource: name, index };
    const existing = index === null ? null : state.records[name][index];
    $('#record-dialog-title').textContent = existing ? `Edit ${RESOURCE_CONFIG[name].title.toLowerCase()} record` : RESOURCE_CONFIG[name].addLabel;
    $('#record-json').value = JSON.stringify(existing || RESOURCE_CONFIG[name].example, null, 2);
    $('#record-message').textContent = '';
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', 'open');
  }
  function closeEditor() { if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open'); state.editing = null; }
  $('#dialog-close').addEventListener('click', closeEditor);
  $('#dialog-cancel').addEventListener('click', closeEditor);
  $('#record-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!state.editing) return;
    const { resource, index } = state.editing;
    const config = RESOURCE_CONFIG[resource];
    let record;
    try { record = JSON.parse($('#record-json').value); }
    catch { $('#record-message').textContent = 'That is not valid JSON. Check commas, quotes, and brackets.'; return; }
    if (!record || Array.isArray(record) || typeof record !== 'object') { $('#record-message').textContent = 'Enter one JSON object, for example {"name":"Gold","quantity":1}.'; return; }
    const button = $('button[type="submit"]', $('#record-form'));
    button.disabled = true;
    try {
      if (index === null) {
        await api(config.endpoint, { method: 'POST', body: JSON.stringify(record) });
      } else {
        const id = state.records[resource][index]?.id ?? state.records[resource][index]?._id;
        if (['banks', 'investments'].includes(resource) && id !== undefined) {
          await api(`${config.endpoint}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(record) });
        } else {
          $('#record-message').textContent = 'Your current server may not support editing this record. Save via the server’s supported update route, or add a new record.';
          return;
        }
      }
      closeEditor();
      await loadResource(resource);
      showGlobal(`${config.title} saved.`, 'success');
    } catch (error) { $('#record-message').textContent = error.message; }
    finally { button.disabled = false; }
  });


/* ================= REFRESH APP OVERVIEW ================= */

window.refreshAppOverview = async function () {
  try {
    const data = await api('/api/profile');

    state.profile = data?.profile || data || {};

    renderOverview();

    // Refresh emergency amount and color too.
    if (window.updateEmergencyOverview) {
      await window.updateEmergencyOverview();
    }
  } catch (error) {
    console.warn('Could not refresh app overview:', error);
  }
};


  // function askDelete(name, index) {
  //   state.pendingDelete = { resource: name, index };
  //   $('#confirm-dialog').classList.remove('hidden');
  // }
  function closeConfirm() { $('#confirm-dialog').classList.add('hidden'); state.pendingDelete = null; }
  $('#confirm-cancel').addEventListener('click', closeConfirm);
  $('#confirm-delete').addEventListener('click', async () => {
    if (!state.pendingDelete) return;
    const { resource, index } = state.pendingDelete;
    const config = RESOURCE_CONFIG[resource];
    const record = state.records[resource][index];
    const id = record?.id ?? record?._id;
    const button = $('#confirm-delete');
    button.disabled = true;
    try {
      if (id !== undefined) {
        await api(`${config.endpoint}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      } else {
        // Some existing routes accept an ID or index in a DELETE request body.
        await api(config.endpoint, { method: 'DELETE', body: JSON.stringify({ id: record?.id, index, record }) });
      }
      closeConfirm();
      await loadResource(resource);
      showGlobal(`${config.title} record deleted.`, 'success');
    } catch (error) { closeConfirm(); showGlobal(`Could not delete record: ${error.message}. Check the DELETE route in app.js against server.js.`, 'error'); }
    finally { button.disabled = false; }
  });

  $('#profile-form').addEventListener('submit', async event => {
    event.preventDefault();
    const message = $('#profile-message');
    const button = $('button[type="submit"]', event.currentTarget);
    const formData = new FormData(event.currentTarget);
    const profile = {};
    for (const [key, value] of formData.entries()) {
      if (['focusMode', 'savingsSubgoal'].includes(key)) profile[key] = String(value).trim();
      else profile[key] = Number(value) || 0;
    }
    button.disabled = true;
    message.textContent = '';
    try {
      await api('/api/profile', { method: 'POST', body: JSON.stringify(profile) });
      state.profile = profile;
      renderOverview();
      message.textContent = 'Profile saved.';
      message.classList.add('success');
      showGlobal('Your profile and goals have been saved.', 'success');
    } catch (error) { message.textContent = error.message; message.classList.remove('success'); }
    finally { button.disabled = false; }
  });

  checkSession();
})();
