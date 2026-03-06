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
      await updateMonthsUI();

    } catch {
      console.log("No saved profile yet.");
    }
  }

  /* ================= CORE CALCULATION ================= */

  async function calculateMonthsToGoal() {
  const emergencyData = await window.calculateEmergencyFund();
  if (!emergencyData) return { months: 0, message: "Emergency data unavailable" };

  const { target: emergencyTarget } = emergencyData;

  const income = Number(incomeInput?.value || 0);
  const expenses = Number(expensesInput?.value || 0);

  const vaultBalance = window.getVaultTotal ? await window.getVaultTotal() : 0;
  const bankBalance = window.getBanksTotal ? await window.getBanksTotal() : 0;
  const totalCash = vaultBalance + bankBalance;

  const downPaymentValue = Number(downPaymentInput?.value?.replace(/,/g, "") || 0);

  // Only money beyond emergency fund can go toward the goal
  const usableSavings = Math.max(totalCash - emergencyTarget, 0);

  // How much is left to reach the goal
  const remainingGoal = Math.max(downPaymentValue - usableSavings, 0);

  const surplus = income - expenses;
  if (surplus <= 0) return { months: 0, message: "No surplus available" };

  const savingsPerMonth = surplus * 0.5; // adjust % if needed
  if (remainingGoal === 0) return { months: 0, message: "Goal already covered 🎉" };

  console.log(savingsPerMonth)
  
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

    const currentValue = Math.ceil(
      startValue + (targetMonths - startValue) * progress
    );

    els.forEach(el => {
      const goalDate = getGoalDate(targetMonths);

      el.textContent =
        `${currentValue} month${currentValue !== 1 ? "s" : ""} to Savings Goal • ${goalDate}`;
    });

    if (progress < 1) {
      monthsAnimationFrame = requestAnimationFrame(animate);
    }
  }

  monthsAnimationFrame = requestAnimationFrame(animate);
}

  /* ================= SAVE PROFILE ================= */

async function saveProfile() {

  let monthsToGoal = 0;

  if (focusDropdown?.value === "savings") {
    const result = await calculateMonthsToGoal();
    monthsToGoal = result?.months || 0;

    // update UI only in savings mode
    animateMonths(monthsToGoal);
  }

  const payload = {
    monthlyIncome: Number(incomeInput?.value || 0),
    monthlyExpenses: Number(expensesInput?.value || 0),
    emergencyMonths: Number(emergencyInput?.value || 0),
    focusMode: focusDropdown?.value || "",
    savingsSubgoal: savingsSubgoal?.value || "",
    loanAmount: Number(loanInput?.value.replace(/,/g, "") || 0),
    downPayment: Number(downPaymentInput?.value.replace(/,/g, "") || 0),
    monthsToGoal
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

      document.querySelectorAll(".months-to-goal").forEach(el => {
        el.textContent = "";
      });
    }
  }

  /* ================= AFFORDABILITY ================= */
document.getElementById("loanHelper")?.addEventListener("click", () => {

  const income = Number(incomeInput.value || 0);

  if (!income) {
    alert("Enter income first.");
    return;
  }

  const estimatedLoan = income * 36;
  const estimatedDown = estimatedLoan * 0.20;

  alert(
    `Estimated affordable loan:\n$${estimatedLoan.toLocaleString()}\n\n` +
    `Suggested down payment:\n$${estimatedDown.toLocaleString()}`
  );

});


  async function updateAffordability() {

  const isSavingsMode =
    focusDropdown.value === "savings" && savingsSubgoal.value;

  affordabilitySection.style.display = isSavingsMode ? "block" : "none";

  if (!isSavingsMode) {
    document.querySelectorAll(".months-to-goal").forEach(el => {
      el.textContent = "";
    });
    return;
  }

  // Only update months if user has entered numbers
  if (loanInput.value && downPaymentInput.value) {
    await updateMonthsUI();
  }
}

  async function updateMonthsUI() {
  const result = await calculateMonthsToGoal();
  if (!result) return null;

  if (result.months === 0) {
    document.querySelectorAll(".months-to-goal").forEach(el => {
      el.textContent = result.message;
    });
    return result;
  }

  animateMonths(result.months);
  return result;
}

  /* ================= HELPERS ================= */

function getGoalDate(months) {

  if (!months || months === 0) return "Now";

  const today = new Date();
  const goalDate = new Date(today);

  goalDate.setMonth(goalDate.getMonth() + months);

  return goalDate.toLocaleString("default", {
    month: "long",
    year: "numeric"
  });
}

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

incomeInput?.addEventListener("input", updateMonthsUI);
expensesInput?.addEventListener("input", updateMonthsUI);
emergencyInput?.addEventListener("input", updateMonthsUI);

  /* ================= INIT ================= */

  await loadProfile();
});