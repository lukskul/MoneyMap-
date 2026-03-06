/* ================= INVESTMENTS ================= */

async function fetchInvestments() {
  const res = await fetch('/api/investments');
  const data = await res.json();
  return data.investments || [];
}

async function addInvestment(entry) {
  await fetch('/api/investments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry)
  });
}

async function updateInvestment(id, updatedValue) {
  await fetch(`/api/investments/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: updatedValue })
  });
}

async function deleteInvestment(id) {
  await fetch(`/api/investments/${id}`, {
    method: 'DELETE'
  });
}

/* ================= RENDER ================= */

function renderInvestments(investments) {
  const table = document.getElementById('investmentTable');
  table.innerHTML = '';

  let total = 0;

  investments.forEach(entry => {
    const value = Number(entry.value);
    total += value;

    const row = document.createElement('tr');

    row.innerHTML = `
      <td>${entry.platform}</td>
      <td>${entry.asset}</td>
      <td>
        <input 
          type="number" 
          value="${value}" 
          min="0" 
          data-id="${entry.id}" 
          class="editInvestmentValue"
        />
      </td>
      <td>
        <button data-id="${entry.id}" class="deleteInvestmentBtn">
          Delete
        </button>
      </td>
    `;

    table.appendChild(row);
  });

  document.getElementById('investmentTotal').textContent =
    `(Total: $${total.toFixed(2)})`;

  // Update bucketTotals for total-assets
  window.bucketTotals = window.bucketTotals || {};
  window.bucketTotals.investments = total;

  attachInvestmentEvents();
}

/* ================= EVENT ATTACH ================= */

function attachInvestmentEvents() {

  // Edit value
  document.querySelectorAll('.editInvestmentValue').forEach(input => {
    input.addEventListener('change', async (e) => {
      const id = e.target.dataset.id;
      const newValue = Number(e.target.value);

      if (newValue >= 0) {
        await updateInvestment(id, newValue);
        await updateInvestmentsUI();
      }
    });
  });

  // Delete row
  document.querySelectorAll('.deleteInvestmentBtn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.dataset.id;

      if (confirm('Delete this investment?')) {
        await deleteInvestment(id);
        await updateInvestmentsUI();
      }
    });
  });
}

/* ================= UPDATE UI ================= */

async function updateInvestmentsUI() {
  const investments = await fetchInvestments();
  renderInvestments(investments);

  if (window.updateTotalAssets)
    await window.updateTotalAssets();
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
  toggleBtn?.addEventListener('click', () => {
    wrapper?.classList.toggle('open');
  });

  // Validation
  function validate() {
    submit.disabled =
      !platform.value.trim() ||
      !type.value ||
      !amount.value ||
      Number(amount.value) <= 0;
  }

  [platform, type, amount].forEach(el =>
    el.addEventListener('input', validate)
  );

  // Submit
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const entry = {
      platform: platform.value.trim(),
      asset: type.value,
      value: Number(amount.value)
    };

    await addInvestment(entry);

    form.reset();
    validate();
    await updateInvestmentsUI();
  });

  validate();
  updateInvestmentsUI();
});

/* ================= TOTAL ASSETS HOOK ================= */

window.getInvestmentsTotal = async function () {
  const investments = await fetchInvestments();
  return investments.reduce(
    (sum, entry) => sum + Number(entry.value),
    0
  );
};

window.registerAssetBucket &&
  window.registerAssetBucket('investments', window.getInvestmentsTotal);