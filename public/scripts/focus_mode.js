/* ================= MONEY MAP RENDERER ================= */

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Money Map initialized");

  /* ================= DOM ELEMENTS ================= */

  const focusDropdown = document.getElementById("focusModeDropdown");
  const savingsSection = document.getElementById("savingsSection");
  const savingsSubgoal = document.getElementById("savingsSubgoalDropdown");
  const affordabilitySection = document.getElementById("affordabilitySection");

  const incomeInput = document.getElementById("monthlyIncome");
  const expensesInput = document.getElementById("monthlyExpenses");
  const emergencyInput = document.getElementById("emergencyMonths");

  const loanInput = document.getElementById("loanInput");
  const downPaymentInput = document.getElementById("downPaymentInput");
  const monthsToGoalEl = document.getElementById("monthsToGoal");

  const settingsToggleBtn = document.getElementById("settingsToggleBtn");
  const settingsOverlay = document.getElementById("settingsOverlay");

  const vaultPercent = document.getElementById("vaultPercent");
  const banksPercent = document.getElementById("banksPercent");
  const metalsPercent = document.getElementById("metalsPercent");
  const investmentPercent = document.getElementById("investmentPercent");

  const saveGoalBtn = document.getElementById("saveGoalBtn");

  /* ================= SETTINGS STATE ================= */

  let currentSettings = {
    monthlyIncome: 0,
    monthlyExpenses: 0,
    emergencyMonths: 6,
    focusMode: "",
    savingsSubgoal: "",
    loanAmount: 0,
    downPayment: 0,

    // These must be populated elsewhere in your app
    vaultBalance: 0,
    bankBalance: 0,
  };

  /* ================= FOCUS PROFILES ================= */

  const focusProfiles = {
    growth: { vault: 10, banks: 15, metals: 15, investments: 60 },
    savings: { vault: 50, banks: 25, metals: 10, investments: 15 },
    protection: { vault: 30, banks: 15, metals: 40, investments: 15 },
  };

  /* ================= SETTINGS OVERLAY ================= */

  settingsToggleBtn?.addEventListener("click", () => {
    settingsOverlay?.classList.toggle("open");
  });

  settingsOverlay?.addEventListener("click", (e) => {
    if (e.target.id === "settingsOverlay") {
      settingsOverlay.classList.remove("open");
    }
  });

  /* ================= LOAD PROFILE ================= */

  async function loadProfile() {
    try {
      const res = await fetch("/api/profile");
      if (!res.ok) return;

      const data = await res.json();
      if (!data) return;

      currentSettings = { ...currentSettings, ...data };

      incomeInput.value = data.monthlyIncome || "";
      expensesInput.value = data.monthlyExpenses || "";
      emergencyInput.value = data.emergencyMonths || 6;

      focusDropdown.value = data.focusMode || "";
      savingsSubgoal.value = data.savingsSubgoal || "";

      if (data.loanAmount) loanInput.value = formatMoney(data.loanAmount);
      if (data.downPayment) downPaymentInput.value = formatMoney(data.downPayment);

      applyFocusMode(focusDropdown.value);
      updateAffordability();
    } catch {
      console.log("No saved profile yet.");
    }
  }

  /* ================= CORE CALCULATION ================= */

  function calculateMonthsToGoal() {
    const income = Number(incomeInput?.value || 0);
    const expenses = Number(expensesInput?.value || 0);
    const emergencyMonths = Number(emergencyInput?.value || 6);

    const surplus = income - expenses;
    if (surplus <= 0) return { months: 0, message: "No surplus available" };

    const savingsPerMonth = surplus * 0.5;

    const vaultBalance = Number(currentSettings.vaultBalance || 0);
    const bankBalance = Number(currentSettings.bankBalance || 0);

    const totalSavings = vaultBalance + bankBalance;
    const requiredEmergencyFund = expenses * emergencyMonths;

    const usableSavings = Math.max(totalSavings - requiredEmergencyFund, 0);

    const downPaymentValue = Number(
      downPaymentInput?.value.replace(/,/g, "") || 0
    );

    const remainingGoal = Math.max(downPaymentValue - usableSavings, 0);

    if (remainingGoal === 0)
      return { months: 0, message: "Goal already covered" };

    const months = Math.ceil(remainingGoal / savingsPerMonth);

    return { months, message: `${months} months` };
  }

  /* ================= SAVE PROFILE ================= */

  async function saveProfile() {
    const result = calculateMonthsToGoal();

    const payload = {
      monthlyIncome: Number(incomeInput?.value || 0),
      monthlyExpenses: Number(expensesInput?.value || 0),
      emergencyMonths: Number(emergencyInput?.value || 6),
      focusMode: focusDropdown?.value || "",
      savingsSubgoal: savingsSubgoal?.value || "",
      loanAmount: Number(loanInput?.value.replace(/,/g, "") || 0),
      downPayment: Number(downPaymentInput?.value.replace(/,/g, "") || 0),
      monthsToGoal: result.months,
    };

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Save failed");

      currentSettings = { ...currentSettings, ...payload };
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  /* ================= APPLY FOCUS MODE ================= */

  function applyFocusMode(mode) {
    if (!focusProfiles[mode]) return;

    const profile = focusProfiles[mode];

    vaultPercent.textContent = profile.vault + "%";
    banksPercent.textContent = profile.banks + "%";
    metalsPercent.textContent = profile.metals + "%";
    investmentPercent.textContent = profile.investments + "%";

    if (mode === "savings") {
      savingsSection.style.display = "block";
    } else {
      savingsSection.style.display = "none";
      affordabilitySection.style.display = "none";
    }
  }

  /* ================= AFFORDABILITY ================= */

  function updateAffordability() {
    if (
      focusDropdown.value !== "savings" ||
      !savingsSubgoal.value
    ) {
      affordabilitySection.style.display = "none";
      return;
    }

    affordabilitySection.style.display = "block";

    const income = Number(incomeInput.value || 0);

    const recommendedLoan = income * 36;

    if (!loanInput.value) {
      loanInput.value = formatMoney(recommendedLoan);
    }

    const loanValue = Number(loanInput.value.replace(/,/g, "") || 0);

    const recommendedDownPayment =
      savingsSubgoal.value === "car"
        ? loanValue * 0.1
        : loanValue * 0.2;

    if (!downPaymentInput.value) {
      downPaymentInput.value = formatMoney(recommendedDownPayment);
    }

    const result = calculateMonthsToGoal();
    monthsToGoalEl.textContent = result.message;
  }

  /* ================= HELPERS ================= */

  function formatMoney(value) {
    return Number(value).toLocaleString();
  }

  function formatMoneyInput(input) {
    const raw = input.value.replace(/,/g, "").replace(/\D/g, "");
    input.value = raw ? Number(raw).toLocaleString() : "";
  }

  /* ================= EVENT LISTENERS ================= */

  focusDropdown?.addEventListener("change", () => {
    applyFocusMode(focusDropdown.value);
    updateAffordability();
  });

  savingsSubgoal?.addEventListener("change", updateAffordability);

  loanInput?.addEventListener("input", () => {
    formatMoneyInput(loanInput);
    updateAffordability();
  });

  downPaymentInput?.addEventListener("input", () => {
    formatMoneyInput(downPaymentInput);
    updateAffordability();
  });

  saveGoalBtn?.addEventListener("click", async () => {
    saveGoalBtn.disabled = true;
    saveGoalBtn.textContent = "Calculating...";

    updateAffordability();

    await new Promise(resolve => setTimeout(resolve, 100));

    saveGoalBtn.textContent = "Saving...";

    const success = await saveProfile();

    saveGoalBtn.textContent = success ? "Saved ✓" : "Error ❌";

    setTimeout(() => {
      saveGoalBtn.textContent = "Save";
      saveGoalBtn.disabled = false;
    }, 1200);

    settingsOverlay?.classList.remove("open");
  });

  /* ================= INIT ================= */

  await loadProfile();
});




