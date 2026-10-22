
/* ================= TOTAL ASSETS ================= */

// Central registry of bucket total functions.
window.assetBuckets = window.assetBuckets || {};

// Register or replace a bucket total function.
window.registerAssetBucket = function (name, fn) {
  window.assetBuckets[name] = fn;
};

let totalAssetsAnimationFrame = null;
let currentTotalAssetsDisplay = 0;
let totalAssetsUpdateId = 0;

/* ================= TOTAL ASSETS ANIMATION ================= */

function animateTotalAssets(targetValue) {
  const el = document.getElementById('totalAssets');
  if (!el) return;

  if (totalAssetsAnimationFrame !== null) {
    cancelAnimationFrame(totalAssetsAnimationFrame);
    totalAssetsAnimationFrame = null;
  }

  const startValue = currentTotalAssetsDisplay;
  const duration = 900;
  const startTime = performance.now();

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function frame(time) {
    const progress = Math.min((time - startTime) / duration, 1);
    const eased = easeOutCubic(progress);

    const value = startValue + (targetValue - startValue) * eased;

    // Keep the current value updated, even if another animation starts.
    currentTotalAssetsDisplay = value;

    el.textContent = `Total Assets: $${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;

    if (progress < 1) {
      totalAssetsAnimationFrame = requestAnimationFrame(frame);
    } else {
      currentTotalAssetsDisplay = targetValue;
      totalAssetsAnimationFrame = null;
    }
  }

  totalAssetsAnimationFrame = requestAnimationFrame(frame);
}

/* ================= MASTER AGGREGATOR ================= */

window.updateTotalAssets = async function () {
  const updateId = ++totalAssetsUpdateId;
  let grandTotal = 0;

  // Snapshot the registry so registration changes do not affect this pass.
  const buckets = Object.entries(window.assetBuckets);

  for (const [name, getTotal] of buckets) {
    try {
      const value = await getTotal();

      // Ignore an older calculation if a newer one has started.
      if (updateId !== totalAssetsUpdateId) return;

      const numericValue = Number(value);

      if (Number.isFinite(numericValue)) {
        grandTotal += numericValue;
      } else {
        console.warn(`Invalid total returned for ${name}:`, value);
      }
    } catch (err) {
      console.warn(`Failed to calculate ${name}:`, err);
    }
  }

  if (updateId !== totalAssetsUpdateId) return;

  animateTotalAssets(grandTotal);

  if (typeof window.checkPortfolioBalance === 'function') {
    window.checkPortfolioBalance();
  }

  if (typeof window.updateEmergency === 'function') {
    await window.updateEmergency();
  }
};

/* ================= EMERGENCY FUND ================= */

window.calculateEmergencyFund = async function () {
  try {
    const res = await fetch('/api/profile', {
      credentials: 'include'
    });

    if (res.status === 401) {
      throw new Error('Not authenticated');
    }

    if (!res.ok) {
      throw new Error(`Profile request failed (${res.status})`);
    }

    const settings = await res.json();

    const monthlyExpenses = Number(settings.monthlyExpenses) || 0;
    const emergencyMonths = Number(settings.emergencyMonths) || 0;
    const target = monthlyExpenses * emergencyMonths;

    // Preserve the current behavior: emergency savings count vault cash only.
    const vaultTotal = window.assetBuckets.vault
      ? Number(await window.assetBuckets.vault()) || 0
      : 0;

    const monthsCovered =
      monthlyExpenses > 0 ? vaultTotal / monthlyExpenses : 0;

    const percentFunded =
      target > 0 ? (vaultTotal / target) * 100 : 0;

    return {
      monthlyExpenses,
      emergencyMonths,
      target,
      vaultTotal,
      monthsCovered,
      percentFunded: Math.min(percentFunded, 100)
    };
  } catch (err) {
    console.warn('Emergency fund calculation failed:', err);
    return null;
  }
};

/* ================= EMERGENCY UI ================= */

window.updateEmergency = async function () {
  const data = await window.calculateEmergencyFund();
  if (!data) return;

  const statusEl = document.getElementById('emergencyStatus');
  if (!statusEl) return;

  const {
    emergencyMonths,
    target,
    vaultTotal,
    monthsCovered,
    percentFunded,
    monthlyExpenses
  } = data;

  const money = value =>
    `$${Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;

  let message = '';
  let color = 'lightgray';

  if (target === 0) {
    message =
      `Save at least ${money(monthlyExpenses)} (1 month expenses) for an emergency fund.`;
  } else if (percentFunded >= 100) {
    message =
      `Emergency Fund: ${money(target)} saved. ${emergencyMonths} months covered.`;
    color = 'lightgreen';
  } else if (vaultTotal === 0) {
    message =
      `Emergency Fund: $0 saved. Goal ${money(target)} (${emergencyMonths} months).`;
    color = 'lightblue';
  } else {
    message =
      `Emergency Fund: ${money(vaultTotal)} saved. ` +
      `${monthsCovered.toFixed(1)} months covered. ` +
      `${percentFunded.toFixed(0)}% of ${money(target)} goal.`;
    color = 'orange';
  }

  statusEl.textContent = message;
  statusEl.style.color = color;

  /* ---------- UPDATE VAULT DISPLAY ---------- */

  // Show vault cash remaining after the emergency-fund allocation.
  const allocatedEmergency = Math.min(vaultTotal, target);
  const displayVault = vaultTotal - allocatedEmergency;

  if (typeof window.animateVaultDisplay === 'function') {
    window.animateVaultDisplay(displayVault);
  }
};
