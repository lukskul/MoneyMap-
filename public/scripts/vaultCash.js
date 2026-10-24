
/* ================= VAULT DATA ================= */

async function fetchVault() {
  const res = await fetch('/api/vault', {
    credentials: 'include'
  });

  if (!res.ok) {
    throw new Error(`Could not load vault data (${res.status}).`);
  }

  const data = await res.json();
  return data.vault || [];
}

async function addVaultEntry(entry) {
  const res = await fetch('/api/vault', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry)
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `Could not save vault entry (${res.status}).`);
  }
}

/* ================= TOTAL CALC ================= */

window.getvaultCashTotal = async function () {
  const vault = await fetchVault();

  return vault.reduce(
    (sum, entry) => sum + Number(entry.denomination) * Number(entry.quantity),
    0
  );
};

window.getVaultCashTotal = window.getvaultCashTotal;
window.getVaultTotal = window.getvaultCashTotal;




/* ================= RENDER ================= */

async function renderVault() {
  const vault = await fetchVault();
  const table = document.getElementById('vaultTable');

  if (!table) return;

  table.innerHTML = '';

  // Group entries for display without changing the saved JSON.
  const groupedVault = new Map();

  vault.forEach(entry => {
    const denomination = Number(entry.denomination);
    const year =
      entry.year == null || entry.year === ''
        ? 'Assorted'
        : String(entry.year);

    const key = `${denomination}|${year}`;

    if (!groupedVault.has(key)) {
      groupedVault.set(key, {
        denomination,
        year,
        quantity: 0
      });
    }

    groupedVault.get(key).quantity += Number(entry.quantity) || 0;
  });

  let totalValue = 0;

  // Render the grouped entries.
  groupedVault.forEach(entry => {
    const rowTotal = entry.denomination * entry.quantity;
    totalValue += rowTotal;

    const row = document.createElement('tr');

    const denominationCell = document.createElement('td');
    denominationCell.textContent = `$${entry.denomination}`;

    const yearCell = document.createElement('td');
    yearCell.textContent = entry.year;

    const quantityCell = document.createElement('td');
    quantityCell.textContent = entry.quantity;

    const totalCell = document.createElement('td');
    totalCell.textContent = `$${rowTotal.toFixed(2)}`;

    // Quantity to remove.
    const actionCell = document.createElement('td');

    const amountInput = document.createElement('input');
    amountInput.type = 'number';
    amountInput.min = '1';
    amountInput.step = '1';
    amountInput.max = String(entry.quantity);
    amountInput.value = '1';
    amountInput.className = 'removeCashAmount';
    amountInput.style.width = '70px';

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'deleteCashBtn';
    deleteButton.textContent = 'Remove';

    deleteButton.dataset.denomination = String(entry.denomination);
    deleteButton.dataset.year = entry.year;
    deleteButton.dataset.quantity = String(entry.quantity);

    actionCell.append(amountInput, deleteButton);

    row.append(
      denominationCell,
      yearCell,
      quantityCell,
      totalCell,
      actionCell
    );

    table.appendChild(row);
  });

  // Update total display.
  const vaultCashTotalEl = document.getElementById('vaultCashTotal');

  if (vaultCashTotalEl) {
    vaultCashTotalEl.dataset.total = totalValue;
    animateVaultDisplay(totalValue);
  }

  window.bucketTotals = window.bucketTotals || {};
  window.bucketTotals.vault = totalValue;

  // Attach the click handler once; it continues working after rerenders.
  if (!table.dataset.removeHandlerAttached) {
    table.addEventListener('click', async event => {
      const button = event.target.closest('.deleteCashBtn');
      if (!button) return;

      const row = button.closest('tr');
      const amountInput = row.querySelector('.removeCashAmount');

      const denomination = Number(button.dataset.denomination);
      const year = button.dataset.year;
      const quantity = Number(amountInput.value);

      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > Number(button.dataset.quantity)
      ) {
        alert('Enter a valid whole number of bills to remove.');
        return;
      }

      if (!confirm(`Remove ${quantity} $${denomination} bill(s) from ${year}?`)) {
        return;
      }

      try {
        const response = await fetch('/api/vault/remove-quantity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ denomination, year, quantity })
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || 'Failed to remove bills.');
        }

        await renderVault();
      } catch (error) {
        console.error('Failed to remove vault cash:', error);
        alert(error.message || 'Failed to remove bills.');
      }
    });

    table.dataset.removeHandlerAttached = 'true';
  }
}



/*============ Delete quantity ===============*/

async function removeMetalQuantity(id, quantity) {
  const response = await fetch(
    `/api/metals/${encodeURIComponent(id)}/remove-quantity`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: Number(quantity) })
    }
  );

  if (!response.ok) {
    throw new Error(await response.text() || 'Could not remove metal quantity.');
  }
}

async function removeCashAmount(id, amount) {
  const response = await fetch(
    `/api/cash/${encodeURIComponent(id)}/remove-amount`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(amount) })
    }
  );

  if (!response.ok) {
    throw new Error(await response.text() || 'Could not remove cash amount.');
  }
}


/* ================= UI UPDATE ================= */

async function updateVaultUI() {
  await renderVault();

  if (window.updateEmergency)
    await window.updateEmergency();

  // Refresh the emergency overview in app.js.
  if (window.updateEmergencyOverview)
    await window.updateEmergencyOverview();

  if (window.updateTotalAssets)
    await window.updateTotalAssets();

  if (window.recalculateMonthsToGoal)
    await window.recalculateMonthsToGoal();
}



let vaultAnimationFrame = null;
let currentVaultDisplay = 0;

function animateVaultDisplay(targetValue) {
  const vaultCashTotal = document.getElementById('vaultCashTotal');
  if (!vaultCashTotal) return;

  if (vaultAnimationFrame !== null) {
    cancelAnimationFrame(vaultAnimationFrame);
  }

  const startValue = currentVaultDisplay;
  const duration = 900;
  const startTime = performance.now();

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function frame(time) {
    const progress = Math.min(
      (time - startTime) / duration,
      1
    );

    const eased = easeOutCubic(progress);

    const value = Math.round(
      startValue + (targetValue - startValue) * eased
    );

    vaultCashTotal.textContent = `$${value.toLocaleString(
      undefined,
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    )}`;

    if (progress < 1) {
      vaultAnimationFrame = requestAnimationFrame(frame);
    } else {
      currentVaultDisplay = targetValue;
      vaultAnimationFrame = null;
    }
  }

  vaultAnimationFrame = requestAnimationFrame(frame);
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
});

document.querySelectorAll('.deleteCashBtn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const id = btn.dataset.id;

    if (!confirm('Delete this cash account?')) return;

    try {
      await deleteCashAccount(id);
      await updateCashUI();
    } catch (err) {
      console.error('Error deleting cash account:', err);
      alert(err.message || 'Could not delete cash account.');
    }
  });
});



/* ================= TOTAL ASSETS HOOK ================= */

// Expose vault total for total-assets.js
window.registerAssetBucket && window.registerAssetBucket('vault', window.getvaultCashTotal);

window.refreshVault = async function () {
  await updateVaultUI();
};

window.animateVaultDisplay = animateVaultDisplay;