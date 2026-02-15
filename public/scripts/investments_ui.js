/* ================= INVESTMENTS ================= */

// Fetch investments from server
async function fetchInvestments() {
  const res = await fetch('/api/investments');
  const data = await res.json();
  return data.investments || [];
}

// Add a new investment via API
async function addInvestment(entry) {
  await fetch('/api/investments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry)
  });
}

// Render investments table
function renderInvestments(investments) {
  const table = document.getElementById('investmentTable');
  table.innerHTML = '';

  let total = 0;

  investments.forEach(entry => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${entry.platform}</td>
      <td>${entry.asset}</td>
      <td>$${Number(entry.value).toFixed(2)}</td>
    `;
    table.appendChild(row);

    total += Number(entry.value);
  });

  document.getElementById('investmentTotal').textContent = `(Total: $${total.toFixed(2)})`;

  // Expose for total-assets calculation
  window.bucketTotals = window.bucketTotals || {};
  window.bucketTotals.investments = total;
}

// Update UI
async function updateInvestmentsUI() {
  const investments = await fetchInvestments();
  renderInvestments(investments);
  window.updateTotalAssets && window.updateTotalAssets();
}

/* ================= FORM INTERACTIONS ================= */
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggleInvestmentBtn');
  const wrapper = document.getElementById('investmentFormWrapper');

  const form = document.getElementById('investmentForm');
  const platform = document.getElementById('platform');
  const type = document.getElementById('investmentType');
  const amount = document.getElementById('investmentAmount');
  const submit = document.getElementById('investmentSubmit');

  // Toggle form visibility
  toggleBtn.addEventListener('click', () => {
    wrapper.classList.toggle('open');
  });

  // Form validation
  function validate() {
    submit.disabled =
      !platform.value.trim() ||
      !type.value ||
      !amount.value ||
      amount.value <= 0;
  }

  [platform, type, amount].forEach(el => el.addEventListener('input', validate));

  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const entry = {
      platform: platform.value.trim(),
      asset: type.value,
      value: Number(amount.value)
    };

    await addInvestment(entry);
    form.reset();
    validate();
    updateInvestmentsUI();
  });

  validate();
  updateInvestmentsUI();
});

/* ================= TOTAL ASSETS HOOK ================= */

// Return investments total for total-assets.js
window.getInvestmentsTotal = async function () {
  const investments = await fetchInvestments();
  return investments.reduce((sum, entry) => sum + Number(entry.value), 0);
};

// Register bucket for total-assets.js
window.registerAssetBucket && window.registerAssetBucket('investments', window.getInvestmentsTotal);
