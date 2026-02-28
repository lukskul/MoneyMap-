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
    emergencyMonths: 0,
    focusMode: "",
    savingsSubgoal: "",
    loanAmount: 0,
    downPayment: 0,
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
      emergencyInput.value = data.emergencyMonths || 0;

      focusDropdown.value = data.focusMode || "";
      savingsSubgoal.value = data.savingsSubgoal || "";

      if (data.loanAmount) loanInput.value = formatMoney(data.loanAmount);
      if (data.downPayment) downPaymentInput.value = formatMoney(data.downPayment);

      applyFocusMode(focusDropdown.value);
      await updateAffordability();

    } catch {
      console.log("No saved profile yet.");
    }
  }

  /* ================= CORE CALCULATION ================= */

  async function calculateMonthsToGoal() {

    const emergencyData = await window.calculateEmergencyFund();
    if (!emergencyData) {
      return { months: 0, message: "Emergency data unavailable" };
    }

    const { target } = emergencyData;

    const income = Number(incomeInput?.value || 0);
    const expenses = Number(expensesInput?.value || 0);
    const vaultBalance = Number(currentSettings?.vaultBalance || 0);
    const bankBalance = Number(currentSettings?.bankBalance || 0);

    const downPaymentValue = Number(
      downPaymentInput?.value?.replace(/,/g, "") || 0
    );

    const totalCash = vaultBalance + bankBalance;
    const usableSavings = Math.max(totalCash - target, 0);
    const surplus = income - expenses;

    if (surplus <= 0) {
      return { months: 0, message: "No surplus available" };
    }

    const savingsPerMonth = surplus * 0.5;
    const remainingGoal = Math.max(downPaymentValue - usableSavings, 0);

    if (remainingGoal === 0) {
      return { months: 0, message: "Goal already covered 🎉" };
    }

    const months = Math.ceil(remainingGoal / savingsPerMonth);

    return {
      months,
      message: `Goal Reached In ${months} month${months > 1 ? "s" : ""}`
    };
  }

  window.calculateMonthsToGoal = calculateMonthsToGoal;

  /* ================= ANIMATION ================= */

let monthsAnimationFrame = null;

function animateMonths(targetMonths) {

  const els = document.querySelectorAll(".months-to-goal");
  if (!els.length) return;

  if (monthsAnimationFrame) {
    cancelAnimationFrame(monthsAnimationFrame);
  }

  const duration = 800;
  const start = performance.now();
  const startValue = 0;

  function animate(currentTime) {
    const elapsed = currentTime - start;
    const progress = Math.min(elapsed / duration, 1);

    const currentValue = Math.ceil(startValue + (targetMonths - startValue) * progress);

    els.forEach(el => {
      el.textContent = `${currentValue} month${currentValue !== 1 ? "s" : ""}`;
    });

    if (progress < 1) {
      monthsAnimationFrame = requestAnimationFrame(animate);
    }
  }

  monthsAnimationFrame = requestAnimationFrame(animate);
}

  /* ================= SAVE PROFILE ================= */

  async function saveProfile() {

    const result = await calculateMonthsToGoal();

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

  async function updateAffordability() {


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

    const result = await calculateMonthsToGoal();

    animateMonths(result.months);

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

  focusDropdown?.addEventListener("change", async () => {
    applyFocusMode(focusDropdown.value);
    await updateAffordability();
  });

  savingsSubgoal?.addEventListener("change", updateAffordability);

  loanInput?.addEventListener("input", async () => {
    formatMoneyInput(loanInput);
    await updateAffordability();
  });

  downPaymentInput?.addEventListener("input", async () => {
    formatMoneyInput(downPaymentInput);
    await updateAffordability();
  });

  saveGoalBtn?.addEventListener("click", async () => {

    if (saveGoalBtn.classList.contains("is-saving")) return;

    try {
      saveGoalBtn.classList.add("is-saving");
      saveGoalBtn.style.pointerEvents = "none";
      saveGoalBtn.textContent = "Saving...";

      await updateAffordability();

      const success = await saveProfile();

      if (success) {
        saveGoalBtn.textContent = "Saved ✓";

        setTimeout(() => {
          settingsOverlay?.classList.remove("open");
          saveGoalBtn.classList.remove("is-saving");
          saveGoalBtn.style.pointerEvents = "auto";
          saveGoalBtn.textContent = "Save";
        }, 1500);

        return;
      }

      saveGoalBtn.textContent = "Error";

    } catch (err) {
      console.error(err);
      saveGoalBtn.textContent = "Error";
    }

    setTimeout(() => {
      saveGoalBtn.classList.remove("is-saving");
      saveGoalBtn.style.pointerEvents = "auto";
      saveGoalBtn.textContent = "Save";
    }, 1500);
  });

incomeInput?.addEventListener("input", updateAffordability);
expensesInput?.addEventListener("input", updateAffordability);
emergencyInput?.addEventListener("input", updateAffordability);

  /* ================= INIT ================= */

  await loadProfile();
});