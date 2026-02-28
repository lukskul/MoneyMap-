/* ================= TOTAL ASSETS ================= */

// Central registry of bucket total functions
window.assetBuckets = window.assetBuckets || {};

// helper for buckets to register themselves
window.registerAssetBucket = function (name, fn) {
  window.assetBuckets[name] = fn;
};

// master aggregator
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

  const el = document.getElementById('totalAssets');
  if (el) el.textContent = `Total Assets: $${grandTotal.toFixed(2)}`;

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

  const statusEl = document.getElementById('emergencyStatus');
  if (!statusEl) return;

  const {
    emergencyMonths,
    target,
    vaultTotal,
    monthsCovered,
    percentFunded
  } = data;

  if (target === 0) {
    statusEl.textContent = "Set aside at least 1 month expenses! Settings - Emergency Fund.  ";
    statusEl.style.color = "lightgray";
    return;
  }

  if (percentFunded >= 100) {
    statusEl.textContent =
      `Emergency Funds: ${emergencyMonths} months covered`;
    statusEl.style.color = "lightgreen";
  } 
  else if (vaultTotal === 0) {
    statusEl.textContent = "Save at least 1 month expenses for an Emergency.";
    statusEl.style.color = "lightblue";
  } 
  else {
    statusEl.textContent =
      `Emergency Funds: ${monthsCovered} month covered. Goal: ${percentFunded.toFixed(0)}% Funded`;
    statusEl.style.color = "orange";
  }
};

