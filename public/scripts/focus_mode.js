/* ================= MONEY MAP RENDERER ================= */

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Money Map initialized");

  /* ================= DOM ELEMENTS ================= */

  const focusDropdown = document.getElementById("focusModeDropdown");
  const savingsSubgoal = document.getElementById("savingsSubgoalDropdown");
  const affordabilitySection = document.getElementById("affordabilitySection");
  const loanInputs = document.getElementById("loanInputs");
  const customSavingsInput = document.getElementById("customSavingsInput");

  const incomeInput = document.getElementById("monthlyIncome");
  const expensesInput = document.getElementById("monthlyExpenses");
  const emergencyInput = document.getElementById("emergencyMonths");

  const loanInput = document.getElementById("loanInput");
  const downPaymentInput = document.getElementById("downPaymentInput");
  const settingsToggleBtn = document.getElementById("settingsToggleBtn");
  const settingsOverlay = document.getElementById("settingsOverlay");
  const customGoalInput = document.getElementById("customGoalInput");

  const vaultPercent = document.getElementById("vaultPercent");
  const banksPercent = document.getElementById("banksPercent");
  const metalsPercent = document.getElementById("metalsPercent");
  const investmentPercent = document.getElementById("investmentPercent");

  const saveGoalBtn = document.getElementById("saveGoalBtn");

  let currentMonths = 0;
  let monthsAnimationFrame = null;

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

    const goal = data.goal || {};

    // focus mode
    focusDropdown.value = goal.type || "";

    // savings subgoal
    savingsSubgoal.value = goal.subgoal || "";

    // savings goal
    if (goal.amount) {
      customGoalInput.value = formatMoney(goal.amount);
    }

    // loan inputs
    if (goal.loanAmount) {
      loanInput.value = formatMoney(goal.loanAmount);
    }

    if (goal.downPayment) {
      downPaymentInput.value = formatMoney(goal.downPayment);
    }

    applyFocusMode(focusDropdown.value);
    applySavingsSubgoal(savingsSubgoal.value);

    if (goal.type === "savings") {

      const result = await calculateMonthsToGoal();

      if (result) {
        monthsToGoal = result.months || 0;
        animateMonths(monthsToGoal);
      }

    }

  } catch (err) {
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
  // const remainingGoal = Math.max(downPaymentValue - usableSavings, 0);
  const goalAmount = getGoalAmount();
  const remainingGoal = Math.max(goalAmount - usableSavings, 0);

  const surplus = income - expenses;
  if (surplus <= 0) return { months: 0, message: "No surplus available" };

  const savingsPerMonth = surplus * 0.5; // adjust % if needed
  if (remainingGoal === 0) return { months: 0, message: "Goal Reached 🎉" };

  const months = Math.ceil(remainingGoal / savingsPerMonth);

  return {
    months,
    message: `Goal Reached In ${months} month${months > 1 ? "s" : ""}`
  };
}

window.calculateMonthsToGoal = calculateMonthsToGoal;

  /* ================= ANIMATION ================= */

function animateMonths(targetMonths) {

  const els = document.querySelectorAll(".months-to-goal");
  if (!els.length) return;

  if (monthsAnimationFrame) {
    cancelAnimationFrame(monthsAnimationFrame);
  }

  const startValue = currentMonths;
  const duration = 900;
  const startTime = performance.now();

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function frame(time) {

    const progress = Math.min((time - startTime) / duration, 1);
    const eased = easeOutCubic(progress);

    const value = Math.round(
      startValue + (targetMonths - startValue) * eased
    );

    const goalDate = getGoalDate(targetMonths);

    els.forEach(el => {
      el.textContent =
        `${value} month${value !== 1 ? "s" : ""} • ${goalDate}`;
    });

    if (progress < 1) {
      monthsAnimationFrame = requestAnimationFrame(frame);
    } else {
      currentMonths = targetMonths;
    }
  }

  monthsAnimationFrame = requestAnimationFrame(frame);
}


  /* ================= SAVE PROFILE ================= */

async function saveProfile() {

  let monthsToGoal = 0;

  if (focusDropdown?.value === "savings") {
    const result = await calculateMonthsToGoal();
    monthsToGoal = result?.months || 0;
    animateMonths(result.months);
  }

  // Clean number parsing helper
  const parseMoney = (val) =>
    Number((val || "").replace(/,/g, "")) || 0;

  const goal = {
    type: focusDropdown?.value || "",
    subgoal: savingsSubgoal?.value || "",
    amount: parseMoney(customGoalInput?.value),
    loanAmount: parseMoney(loanInput?.value),
    downPayment: parseMoney(downPaymentInput?.value)
  };

  const payload = {
    monthlyIncome: Number(incomeInput?.value || 0),
    monthlyExpenses: Number(expensesInput?.value || 0),
    emergencyMonths: Number(emergencyInput?.value || 0),
    goal,
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
  /* ================= APPLY FOCUS MODE And Savings Sub Goals================= */

function applyFocusMode(mode) {
  if (!focusProfiles[mode]) return;

  const profile = focusProfiles[mode];

  vaultPercent.textContent = profile.vault + "%";
  banksPercent.textContent = profile.banks + "%";
  metalsPercent.textContent = profile.metals + "%";
  investmentPercent.textContent = profile.investments + "%";

  if (mode === "savings") {
    affordabilitySection.style.display = "block";
  } else {
    affordabilitySection.style.display = "none";


    document.querySelectorAll(".months-to-goal").forEach(el => {
      el.textContent = "";
    });
  }
}

function applySavingsSubgoal(type) {

  if (!loanInputs || !customSavingsInput) return;

  if (type === "loan") {

    loanInputs.style.display = "block";
    customSavingsInput.style.display = "none";

  } else if (type === "custom") {

    loanInputs.style.display = "none";
    customSavingsInput.style.display = "block";

  } else {

    loanInputs.style.display = "none";
    customSavingsInput.style.display = "none";

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
    // focusDropdown.value === "savings" && savingsSubgoal.value;
    focusDropdown.value === "savings" && savingsSubgoal.value !== "";

  affordabilitySection.style.display = isSavingsMode ? "block" : "none";

  if (!isSavingsMode) {
    document.querySelectorAll(".months-to-goal").forEach(el => {
      el.textContent = "";
    });
    return;
  }

function getGoalAmount() {

  if (savingsSubgoal.value === "loan") {
    const loan = Number(loanInput.value.replace(/,/g, "")) || 0;
    const down = Number(downPaymentInput.value.replace(/,/g, "")) || 0;
    return loan + down;
  }

  if (savingsSubgoal.value === "custom") {
    return Number(customGoalInput.value.replace(/,/g, "")) || 0;
  }

  return 0;
}

async function updateGoalMessage() {

  const result = await calculateMonthsToGoal();
  if (!result) return;

  const messageEl = document.querySelector(".goal-message");
  if (messageEl) {
    messageEl.textContent = result.message;
  }

  currentMonths = result.months;
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

  // savingsSubgoal?.addEventListener("change", updateAffordability);
  savingsSubgoal?.addEventListener("change", () => {
  applySavingsSubgoal(savingsSubgoal.value);
  updateAffordability();
});

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

incomeInput?.addEventListener("input", updateGoalMessage);
expensesInput?.addEventListener("input", updateGoalMessage);
emergencyInput?.addEventListener("input", updateGoalMessage);

  /* ================= INIT ================= */

  await loadProfile();
  }
});