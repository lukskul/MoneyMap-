/* ================= BANKS FRONTEND ================= */

async function fetchBanks() {
  try {
    const res = await fetch('/api/banks');
    const data = await res.json();
    return data.accounts || [];
  } catch (err) {
    console.error('Error fetching banks:', err);
    return [];
  }
}

async function addBankAccount(account) {
  await fetch('/api/banks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account)
  });
}

async function updateBankAccount(id, amount) {
  await fetch(`/api/banks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount })
  });
}

async function deleteBankAccount(id) {
  await fetch(`/api/banks/${id}`, { method: 'DELETE' });
}

/* ================= RENDER TABLE ================= */

function renderBanks(accounts) {
  const table = document.getElementById('banksTable');
  const totalLabel = document.getElementById('banksTotal');

  table.innerHTML = '';
  let total = 0;

  accounts.forEach(acc => {
    total += Number(acc.amount);

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${acc.bank}</td>
      <td>${acc.type}</td>
      <td>
        <input 
          type="number" 
          step="0.01" 
          class="editBankAmount" 
          data-id="${acc.id}" 
          value="${Number(acc.amount).toFixed(2)}"
        />
      </td>
      <td>
        <button class="deleteBankBtn" data-id="${acc.id}">
          Delete
        </button>
      </td>
    `;
    table.appendChild(row);
  });

  totalLabel.textContent = `Total: $${total.toFixed(2)}`;

  // Update bucketTotals
  window.bucketTotals = window.bucketTotals || {};
  window.bucketTotals.banks = total;

  attachBankEvents();
}

/* ================= EVENTS ================= */

function attachBankEvents() {
  // Edit amount
  document.querySelectorAll('.editBankAmount').forEach(input => {
    input.addEventListener('change', async e => {
      const id = e.target.dataset.id;
      const newAmount = Number(e.target.value);

      if (newAmount >= 0) {
        await updateBankAccount(id, newAmount);
        await updateBanksUI();
      }
    });
  });

  // Delete account
  document.querySelectorAll('.deleteBankBtn').forEach(btn => {
    btn.addEventListener('click', async e => {
      const id = btn.dataset.id;

      if (confirm('Delete this bank account?')) {
        await deleteBankAccount(id);
        await updateBanksUI();
      }
    });
  });
}

/* ================= UPDATE UI ================= */

async function updateBanksUI() {
  const accounts = await fetchBanks();
  renderBanks(accounts);

  if (window.updateTotalAssets) await window.updateTotalAssets();
}

/* ================= FORM ================= */

document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggleBankBtn');
  const wrapper = document.getElementById('bankFormWrapper');

  const form = document.getElementById('bankForm');
  const bank = document.getElementById('bankName');
  const type = document.getElementById('accountType');
  const amount = document.getElementById('amount');
  const submit = document.getElementById('bankSubmit');

  // Toggle form
  toggleBtn.addEventListener('click', () => wrapper.classList.toggle('open'));

  // Validation
  function validate() {
    submit.disabled =
      !bank.value.trim() || !type.value || !amount.value || Number(amount.value) <= 0;
  }

  [bank, type, amount].forEach(el => el.addEventListener('input', validate));

  // Submit
  form.addEventListener('submit', async e => {
    e.preventDefault();
    await addBankAccount({
      id: Date.now().toString(),
      bank: bank.value.trim(),
      type: type.value,
      amount: Number(amount.value)
    });

    form.reset();
    validate();
    await updateBanksUI();
  });

  validate();
  updateBanksUI();
});

/* ================= TOTAL ASSETS HOOK ================= */

window.getBanksTotal = async function () {
  const accounts = await fetchBanks();
  return accounts.reduce((sum, a) => sum + Number(a.amount), 0);
};

if (window.registerAssetBucket) {
  window.registerAssetBucket('banks', window.getBanksTotal);
}