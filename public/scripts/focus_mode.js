/* ================= FOCUS MODE ================= */

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadFocusMode(); 
  console.log("Money Map script loaded");

  /* ================= DOM ELEMENTS ================= */

  const focusDropdown = document.getElementById('focusModeDropdown');
  const savingsSection = document.getElementById('savingsSection');
  const savingsSubgoal = document.getElementById('savingsSubgoalDropdown');
  const affordabilitySection = document.getElementById('affordabilitySection');

  const incomeInput = document.getElementById('monthlyIncome');
  const expensesInput = document.getElementById('monthlyExpenses');
  const emergencyInput = document.getElementById('emergencyMonths');
  const saveBtn = document.getElementById('saveSettingsBtn');

  const settingsToggleBtn = document.getElementById('settingsToggleBtn');
  const settingsOverlay = document.getElementById('settingsOverlay');

  /* ================= FOCUS PROFILES ================= */

  const focusProfiles = {
    growth: { vault: 10, banks: 15, metals: 15, investments: 60 },
    savings: { vault: 50, banks: 25, metals: 10, investments: 15 },
    protection: { vault: 30, banks: 15, metals: 40, investments: 15 }
  };

  /* ================= SETTINGS TOGGLE ================= */

  if (settingsToggleBtn && settingsOverlay) {
    settingsToggleBtn.addEventListener('click', () => {
      settingsOverlay.classList.toggle('open');
    });

    settingsOverlay.addEventListener('click', (e) => {
      if (e.target.id === 'settingsOverlay') {
        settingsOverlay.classList.remove('open');
      }
    });
  }

  /* ================= SETTINGS SAVE ================= */

  async function saveSettings() {
    const payload = {
      monthlyIncome: Number(incomeInput?.value || 0),
      monthlyExpenses: Number(expensesInput?.value || 0),
      emergencyMonths: Number(emergencyInput?.value || 6)
    };

    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.error("Failed to save settings");
      return;
    }

    alert("Settings saved!");
    settingsOverlay?.classList.remove('open');
  }

  saveBtn?.addEventListener('click', saveSettings);

  /* ================= Load Settings ================= */
  
  async function loadSettings() {
  try {
    const res = await fetch("/api/settings");
    const settings = await res.json();

    document.getElementById("monthlyIncome").value =
      settings.monthlyIncome || "";

    document.getElementById("monthlyExpenses").value =
      settings.monthlyExpenses || "";

    document.getElementById("emergencyMonths").value =
      settings.emergencyMonths || 6;

  } catch (err) {
    console.error("Failed to load settings:", err);
  }
}

/* ================= APPLY FOCUS MODE ================= */

function applyFocusMode(mode) {
  const profile = focusProfiles[mode];
  if (!profile) return;

  document.getElementById('vaultPercent').textContent = `${profile.vault}%`;
  document.getElementById('banksPercent').textContent = `${profile.banks}%`;
  document.getElementById('metalsPercent').textContent = `${profile.metals}%`;
  document.getElementById('investmentPercent').textContent = `${profile.investments}%`;

  // Handle visibility
  if (mode === 'savings') {
    savingsSection.style.display = 'block';
  } else {
    savingsSection.style.display = 'none';
    affordabilitySection.style.display = 'none';
  }
}

/* ================= SAVE FOCUS MODE ================= */

async function saveFocusMode() {
  await fetch('/api/focus-mode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      focusMode: focusDropdown?.value || '',
      savingsSubgoal: savingsSubgoal?.value || ''
    })
  });
}

/* ================= FOCUS DROPDOWN ================= */

if (focusDropdown) {
  focusDropdown.addEventListener('change', async () => {
    applyFocusMode(focusDropdown.value);
    await saveFocusMode();
  });
}

/* ================= SUBGOAL DROPDOWN ================= */

if (savingsSubgoal) {
  savingsSubgoal.addEventListener('change', async () => {

    if (!savingsSubgoal.value) {
      affordabilitySection.style.display = 'none';
      await saveFocusMode();
      return;
    }

    affordabilitySection.style.display = 'block';

    await saveFocusMode();

    // Trigger affordability calculation if needed
    savingsSubgoal.dispatchEvent(new Event('calculateAffordability'));
  });
}

/* ================= LOAD FOCUS MODE ================= */

async function loadFocusMode() {
  try {
    const res = await fetch('/api/focus-mode');
    if (!res.ok) return;

    const data = await res.json();
    if (!data) return;

    // 1️⃣ Restore focus mode first
    if (data.focusMode && focusDropdown) {
      focusDropdown.value = data.focusMode;
      applyFocusMode(data.focusMode);
    }

    // 2️⃣ Restore subgoal AFTER focus applied
    if (data.savingsSubgoal && savingsSubgoal) {
      savingsSubgoal.value = data.savingsSubgoal;

      if (data.focusMode === 'savings') {
        affordabilitySection.style.display = 'block';
        savingsSubgoal.dispatchEvent(new Event('change'));
      }
    }

  } catch (err) {
    console.log("No saved focus mode yet.");
  }
}

  /* ================= SAVINGS SUBGOAL ================= */

  if (savingsSubgoal) {
    savingsSubgoal.addEventListener('change', async () => {
      if (!savingsSubgoal.value) {
        affordabilitySection.style.display = 'none';
        return;
      }

      affordabilitySection.style.display = 'block';

      const res = await fetch('/api/settings');
      const settings = await res.json();

      const income = Number(settings.monthlyIncome || 0);
      const expenses = Number(settings.monthlyExpenses || 0);
      const emergencyMonths = Number(settings.emergencyMonths || 0);

      const affordablePrice = income * 36;
      const downPaymentTarget = savingsSubgoal.value === 'car'
        ? affordablePrice * 0.10
        : affordablePrice * 0.20;

      document.getElementById('affordablePrice').textContent =
        `$${affordablePrice.toLocaleString()}`;

      document.getElementById('downPaymentTarget').textContent =
        `$${downPaymentTarget.toLocaleString()}`;

      document.getElementById('monthsToGoal').textContent = "Calculating...";
    });
  }

});
