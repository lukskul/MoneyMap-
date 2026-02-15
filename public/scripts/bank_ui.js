/* ================= BANKS ================= */

async function fetchBanks() {
  const res = await fetch('/api/banks');
  const data = await res.json();
  return data.accounts || [];
}

async function addBankAccount(account) {
  await fetch('/api/banks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account)
  });
}

function renderBanks(accounts) {
  const table = document.getElementById('banksTable');
  table.innerHTML = '';

  let total = 0;

  accounts.forEach(acc => {
    total += Number(acc.amount);

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${acc.bank}</td>
      <td>${acc.type}</td>
      <td>$${Number(acc.amount).toFixed(2)}</td>
    `;
    table.appendChild(row);
  });

  document.getElementById('banksTotal').textContent =
    `(Total: $${total.toFixed(2)})`;

  // Update bucket total for total-assets
  window.bucketTotals = window.bucketTotals || {};
  window.bucketTotals.banks = total;
}

async function updateBanksUI() {
  const accounts = await fetchBanks();
  renderBanks(accounts);
  if (window.updateTotalAssets) 
    await window.updateTotalAssets();
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

  // Toggle form visibility
  toggleBtn.addEventListener('click', () => {
    wrapper.classList.toggle('open');
  });

  // Form validation
  function validate() {
    submit.disabled =
      !bank.value.trim() ||
      !type.value ||
      !amount.value ||
      amount.value <= 0;
  }

  [bank, type, amount].forEach(el =>
    el.addEventListener('input', validate)
  );

  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    await addBankAccount({
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

window.getBanksTotal = async function() {
  const banks = await fetch('/api/banks').then(r => r.json());
  return banks.accounts?.reduce((sum, a) => sum + a.amount, 0) || 0;
};

// Register bucket for total-assets.js
window.registerAssetBucket && window.registerAssetBucket('banks', window.getBanksTotal);
