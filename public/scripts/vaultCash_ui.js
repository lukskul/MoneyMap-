/* ================= VAULT DATA ================= */

async function fetchVault() {
  const res = await fetch('/api/vault');
  const data = await res.json();
  return data.vault || [];
}

async function addVaultEntry(entry) {
  await fetch('/api/vault', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry)
  });
}

/* ================= TOTAL CALC ================= */
window.getVaultTotal = async function() {
  const vault = await fetch('/api/vault').then(r => r.json());
  return vault.vault?.reduce((sum, e) => sum + e.denomination * e.quantity, 0) || 0;
};

// Expose for global aggregator
window.getVaultTotal = getVaultTotal;

/* ================= RENDER ================= */

async function renderVault() {
  const vault = await fetchVault();
  const table = document.getElementById('vaultTable');
  table.innerHTML = '';

  let totalValue = 0;

  vault.forEach(entry => {
    const rowTotal = entry.denomination * entry.quantity;
    totalValue += rowTotal;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>$${entry.denomination}</td>
      <td>${entry.year || 'Assorted'}</td>
      <td>${entry.quantity}</td>
      <td>$${rowTotal.toFixed(2)}</td>
    `;
    table.appendChild(row);
  });

// Update per-bucket total display
const vaultTotalEl = document.getElementById('vaultTotal');

if (vaultTotalEl) {
  vaultTotalEl.textContent = `$${totalValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
  vaultTotalEl.dataset.total = totalValue; // store live value
}

  // Update bucketTotals for total-assets
  window.bucketTotals = window.bucketTotals || {};
  window.bucketTotals.vault = totalValue;
}

/* ================= UI UPDATE ================= */

async function updateVaultUI() {
  await renderVault();

  if (window.updateEmergency)
    await window.updateEmergency();

  if (window.updateTotalAssets)
    await window.updateTotalAssets();
}

/* ================= FORM & EVENTS ================= */

document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggleVaultBtn');
  const wrapper = document.getElementById('vaultFormWrapper');

  const form = document.getElementById('vaultForm');
  const bill = document.getElementById('bill');
  const year = document.getElementById('year');
  const quantity = document.getElementById('cashQuantity');
  const submit = document.getElementById('vaultSubmit');

  // Toggle form visibility
  toggleBtn?.addEventListener('click', () => wrapper.classList.toggle('open'));

  // Form validation
  function validate() {
    submit.disabled = !bill.value || !quantity.value || quantity.value <= 0;
  }

  [bill, year, quantity].forEach(el => el.addEventListener('input', validate));

  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const entry = {
      denomination: Number(bill.value),
      quantity: Number(quantity.value),
      year: year.value ? Number(year.value) : null
    };

    await addVaultEntry(entry);
    form.reset();
    validate();
    await updateVaultUI();
  });

  validate();
  updateVaultUI();
});

/* ================= TOTAL ASSETS HOOK ================= */

// Expose vault total for total-assets.js
window.registerAssetBucket && window.registerAssetBucket('vault', window.getVaultTotal);



