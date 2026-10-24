
/* ================= INVESTMENTS ================= */

async function investmentRequest(url, options = {}) {
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
    throw new Error(message || `Investment request failed (${res.status})`);
  }

  if (res.status === 204) return null;
  return res.json();
}

async function fetchInvestments() {
  const data = await investmentRequest('/api/investments');
  return data.investments || [];
}

async function addInvestment(entry) {
  return investmentRequest('/api/investments', {
    method: 'POST',
    body: JSON.stringify(entry)
  });
}

async function updateInvestment(id, updatedValue) {
  return investmentRequest(
    `/api/investments/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ value: updatedValue })
    }
  );
}

async function deleteInvestment(id) {
  return investmentRequest(
    `/api/investments/${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );
}


/* ================= MONEY MARKET TOTAL ================= */

window.getMoneyMarketTotal = async function () {
  const investments = await fetchInvestments();

  return investments.reduce((sum, entry) => {
    if (
      String(entry.asset || '').trim().toLowerCase() === 'money market'
    ) {
      return sum + (Number(entry.value) || 0);
    }

    return sum;
  }, 0);
};


/* ================= RENDER ================= */

function renderInvestments(investments) {
  const table = document.getElementById('investmentTable');
  const totalLabel = document.getElementById('investmentTotal');

  if (!table) return;

  table.innerHTML = '';
  let total = 0;

  investments.forEach(entry => {
    const value = Number(entry.value) || 0;
    total += value;

    const row = document.createElement('tr');

    const platformCell = document.createElement('td');
    platformCell.textContent = entry.platform || '';

    const assetCell = document.createElement('td');
    assetCell.textContent = entry.asset || '';

    const valueCell = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '0.01';
    input.min = '0';
    input.value = value.toFixed(2);
    input.dataset.id = entry.id;
    input.className = 'editInvestmentValue';
    valueCell.appendChild(input);

    const actionCell = document.createElement('td');
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.dataset.id = entry.id;
    deleteButton.className = 'deleteInvestmentBtn';
    deleteButton.textContent = 'Delete';
    actionCell.appendChild(deleteButton);

    row.append(platformCell, assetCell, valueCell, actionCell);
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
  window.bucketTotals.investments = total;

  attachInvestmentEvents();
}

/* ================= EVENT ATTACH ================= */

function attachInvestmentEvents() {
  // Edit investment value
  document.querySelectorAll('.editInvestmentValue').forEach(input => {
    input.addEventListener('change', async e => {
      const field = e.currentTarget;
      const id = field.dataset.id;
      const newValue = Number(field.value);

      if (!Number.isFinite(newValue) || newValue < 0) {
        alert('Enter a valid amount of zero or more.');
        await updateInvestmentsUI();
        return;
      }

      field.disabled = true;

      try {
        await updateInvestment(id, newValue);
        await updateInvestmentsUI();
      } catch (error) {
        console.error('Investment update failed:', error);
        alert(error.message || 'Could not update investment.');
        await updateInvestmentsUI();
      }
    });
  });

  // Delete investment
  document.querySelectorAll('.deleteInvestmentBtn').forEach(button => {
    button.addEventListener('click', async e => {
      const btn = e.currentTarget;
      const id = btn.dataset.id;
      const row = btn.closest('tr');

      if (!confirm('Delete this investment?')) return;

      // Remove the row immediately for a responsive UI.
      const originalRow = row?.cloneNode(true);
      row?.remove();

      try {
        await deleteInvestment(id);
        await updateInvestmentsUI();
      } catch (error) {
        console.error('Investment deletion failed:', error);

        // Refresh from the server to restore the correct state.
        try {
          await updateInvestmentsUI();
        } catch (refreshError) {
          console.error('Could not refresh investments:', refreshError);

          const table = document.getElementById('investmentTable');
          if (table && originalRow) table.appendChild(originalRow);
        }

        alert(error.message || 'Could not delete investment.');
      }
    });
  });
}

/* ================= UPDATE UI ================= */

async function updateInvestmentsUI() {
  const investments = await fetchInvestments();
  renderInvestments(investments);

  if (window.updateTotalAssets) {
    await window.updateTotalAssets();
  }

  if (window.recalculateMonthsToGoal) {
    await window.recalculateMonthsToGoal();
  }
}

// Called by scripts/app.js after authentication.
window.refreshInvestments = updateInvestmentsUI;

/* ================= FORM INTERACTIONS ================= */

document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggleInvestmentBtn');
  const wrapper = document.getElementById('investmentFormWrapper');

  const form = document.getElementById('investmentForm');
  const platform = document.getElementById('platform');
  const type = document.getElementById('investmentType');
  const amount = document.getElementById('investmentAmount');
  const submit = document.getElementById('investmentSubmit');

  toggleBtn?.addEventListener('click', () => {
    wrapper?.classList.toggle('open');
  });

  if (!form || !platform || !type || !amount || !submit) return;

  function validate() {
    submit.disabled =
      !platform.value.trim() ||
      !type.value ||
      !amount.value ||
      !Number.isFinite(Number(amount.value)) ||
      Number(amount.value) <= 0;
  }

  [platform, type, amount].forEach(el => {
    el.addEventListener('input', validate);
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();

    if (submit.disabled) return;

    submit.disabled = true;

    try {
      await addInvestment({
        platform: platform.value.trim(),
        asset: type.value,
        value: Number(amount.value)
      });

      form.reset();
      validate();
      await updateInvestmentsUI();
    } catch (error) {
      console.error('Adding investment failed:', error);
      alert(error.message || 'Could not add investment.');
    } finally {
      validate();
    }
  });

  validate();

  // Do not fetch here. The authenticated app triggers the refresh.
});

/* ================= TOTAL ASSETS HOOK ================= */

window.getInvestmentsTotal = async function () {
  const investments = await fetchInvestments();

  return investments.reduce(
    (sum, entry) => sum + (Number(entry.value) || 0),
    0
  );
};

window.registerAssetBucket?.(
  'investments',
  window.getInvestmentsTotal
);
