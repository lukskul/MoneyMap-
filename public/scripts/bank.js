
/* ================= BANKS FRONTEND ================= */

async function bankRequest(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });

  if (res.status === 401) {
    throw new Error('Your session has expired. Please log in again.');
  }

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `Bank request failed (${res.status})`);
  }

  if (res.status === 204) return null;
  return res.json();
}

async function fetchBanks() {
  const data = await bankRequest('/api/banks');
  return data.accounts || [];
}

async function addBankAccount(account) {
  return bankRequest('/api/banks', {
    method: 'POST',
    body: JSON.stringify(account)
  });
}

async function updateBankAccount(id, amount) {
  return bankRequest(`/api/banks/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ amount })
  });
}

async function deleteBankAccount(id) {
  return bankRequest(`/api/banks/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}

/* ================= RENDER TABLE ================= */

function renderBanks(accounts) {
  const table = document.getElementById('banksTable');
  const totalLabel = document.getElementById('banksTotal');

  if (!table) return;

  table.innerHTML = '';
  let total = 0;

  accounts.forEach(acc => {
    const amount = Number(acc.amount) || 0;
    total += amount;

    const row = document.createElement('tr');

    // Use textContent for user-provided text.
    const bankCell = document.createElement('td');
    bankCell.textContent = acc.bank || '';

    const typeCell = document.createElement('td');
    typeCell.textContent = acc.type || '';

    const amountCell = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '0.01';
    input.min = '0';
    input.className = 'editBankAmount';
    input.dataset.id = acc.id;
    input.value = amount.toFixed(2);
    amountCell.appendChild(input);

    const actionCell = document.createElement('td');
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'deleteBankBtn';
    deleteButton.dataset.id = acc.id;
    deleteButton.textContent = 'Delete';
    actionCell.appendChild(deleteButton);

    row.append(bankCell, typeCell, amountCell, actionCell);
    table.appendChild(row);
  });

  if (totalLabel) {
    totalLabel.textContent =
      `Total: $${total.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
    totalLabel.dataset.total = total;
  }

  window.bucketTotals = window.bucketTotals || {};
  window.bucketTotals.banks = total;

  attachBankEvents();
}

/* ================= EVENTS ================= */

function attachBankEvents() {
  document.querySelectorAll('.editBankAmount').forEach(input => {
    input.addEventListener('change', async e => {
      const id = e.target.dataset.id;
      const newAmount = Number(e.target.value);

      if (!Number.isFinite(newAmount) || newAmount < 0) {
        alert('Enter a valid amount of zero or more.');
        await updateBanksUI();
        return;
      }

      try {
        await updateBankAccount(id, newAmount);
        await updateBanksUI();
      } catch (err) {
        console.error('Error updating bank account:', err);
        alert(err.message || 'Could not update bank account.');
      }
    });
  });

  document.querySelectorAll('.deleteBankBtn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;

      if (!confirm('Delete this bank account?')) return;

      try {
        await deleteBankAccount(id);
        await updateBanksUI();
      } catch (err) {
        console.error('Error deleting bank account:', err);
        alert(err.message || 'Could not delete bank account.');
      }
    });
  });
}

/* ================= UPDATE UI ================= */

async function updateBanksUI() {
  const accounts = await fetchBanks();
  renderBanks(accounts);

  if (window.updateTotalAssets) {
    await window.updateTotalAssets();
  }

  if (window.recalculateMonthsToGoal) {
    await window.recalculateMonthsToGoal();
  }
}

// Called by scripts/app.js after the user is authenticated.
window.refreshBanks = updateBanksUI;

/* ================= FORM ================= */

document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggleBankBtn');
  const wrapper = document.getElementById('bankFormWrapper');
  const form = document.getElementById('bankForm');
  const bank = document.getElementById('bankName');
  const type = document.getElementById('accountType');
  const amount = document.getElementById('amount');
  const submit = document.getElementById('bankSubmit');

  toggleBtn?.addEventListener('click', () => {
    wrapper?.classList.toggle('open');
  });

  if (!form || !bank || !type || !amount || !submit) return;

  function validate() {
    submit.disabled =
      !bank.value.trim() ||
      !type.value ||
      !amount.value ||
      !Number.isFinite(Number(amount.value)) ||
      Number(amount.value) <= 0;
  }

  [bank, type, amount].forEach(el => {
    el.addEventListener('input', validate);
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();

    if (submit.disabled) return;

    submit.disabled = true;

    try {
      await addBankAccount({
        id: Date.now().toString(),
        bank: bank.value.trim(),
        type: type.value,
        amount: Number(amount.value)
      });

      form.reset();
      validate();
      await updateBanksUI();
    } catch (err) {
      console.error('Error adding bank account:', err);
      alert(err.message || 'Could not add bank account.');
    } finally {
      validate();
    }
  });

  validate();

  // Intentionally do not call updateBanksUI() here.
  // scripts/app.js refreshes banks after authentication.
});

/* ================= TOTAL ASSETS HOOK ================= */

window.getBanksTotal = async function () {
  const accounts = await fetchBanks();

  return accounts.reduce(
    (sum, account) => sum + (Number(account.amount) || 0),
    0
  );
};

window.registerAssetBucket?.('banks', window.getBanksTotal);
