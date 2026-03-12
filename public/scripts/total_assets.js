/* ================= TOTAL ASSETS ================= */

// Central registry of bucket total functions
window.assetBuckets = window.assetBuckets || {};

// helper for buckets to register themselves
window.registerAssetBucket = function (name, fn) {
  window.assetBuckets[name] = fn;
};

// master aggregator
let totalAssetsAnimationFrame;
let currentTotalAssetsDisplay = 0;

function animateTotalAssets(targetValue) {
  const el = document.getElementById("totalAssets");
  if (!el) return;

  if (totalAssetsAnimationFrame) {
    cancelAnimationFrame(totalAssetsAnimationFrame);
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

    el.textContent = `Total Assets: $${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;

    if (progress < 1) {
      totalAssetsAnimationFrame = requestAnimationFrame(frame);
    } else {
      currentTotalAssetsDisplay = targetValue;
    }
  }

  totalAssetsAnimationFrame = requestAnimationFrame(frame);
}

window.updateTotalAssets = async function () {
  let grandTotal = 0;

  for (const [name, getTotal] of Object.entries(window.assetBuckets)) {
    try {
      const value = await getTotal();
      grandTotal += Number(value) || 0;
    } catch (err) {
      console.warn(`⚠️ Failed to calculate ${name}`, err);
    }
  }

  animateTotalAssets(grandTotal);

  window.checkPortfolioBalance && window.checkPortfolioBalance();
  window.updateEmergency && window.updateEmergency();
};

/* ================= EMERGENCY FUND ================= */

window.calculateEmergencyFund = async function () {

  try {
    const res = await fetch('/api/profile');
    if (!res.ok) return null;

    const settings = await res.json();

    const monthlyExpenses = Number(settings.monthlyExpenses || 0);
    const emergencyMonths = Number(settings.emergencyMonths || 0);

    const target = monthlyExpenses * emergencyMonths;

    const vaultTotal = window.assetBuckets.vault
      ? await window.assetBuckets.vault()
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
    console.warn("Emergency fund calculation failed", err);
    return null;
  } 

};

/* ================= EMERGENCY UI ================= */

window.updateEmergency = async function () {

  const data = await window.calculateEmergencyFund();
  if (!data) return;

  const statusEl = document.getElementById("emergencyStatus");
  if (!statusEl) return;

  const {
    emergencyMonths,
    target,
    vaultTotal,
    monthsCovered,
    percentFunded,
    monthlyExpenses
  } = data;

  const money = v => `$${Number(v || 0).toLocaleString()}`;

  let message = "";
  let color = "lightgray";

  if (target === 0) {
    message =
      `Save at least ${money(monthlyExpenses)} (1 month expenses) for an emergency fund.`;
  }

  else if (percentFunded >= 100) {

    message =
      `Emergency Fund: ${money(target)} saved. ${emergencyMonths} months covered.`;

    color = "lightgreen";
  }

  else if (vaultTotal === 0) {

    message =
      `Emergency Fund: $0 saved. Goal ${money(target)} (${emergencyMonths} months).`;

    color = "lightblue";
  }

  else {

    message =
      `Emergency Fund: ${money(vaultTotal)} saved. ${monthsCovered} month covered. ${percentFunded.toFixed(0)}% of ${money(target)} goal.`;

    color = "orange";
  }

  statusEl.textContent = message;
  statusEl.style.color = color;

  /* ---------- UPDATE VAULT DISPLAY ---------- */

  const allocatedEmergency = Math.min(vaultTotal, target);
  const displayVault = vaultTotal - allocatedEmergency;

  animateVaultDisplay(displayVault);
};
