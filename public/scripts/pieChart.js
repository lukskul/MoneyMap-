
/* ================= PORTFOLIO PIE CHART ================= */

const portfolioPieCharts = {};

function createPortfolioPie(chartId, data) {
  const canvas = document.getElementById(chartId);
  if (!canvas) {
    console.warn(`Pie chart canvas not found: ${chartId}`);
    return;
  }

  if (portfolioPieCharts[chartId]) {
    portfolioPieCharts[chartId].destroy();
  }

  portfolioPieCharts[chartId] = new Chart(canvas.getContext('2d'), {
    type: 'pie',
    data: {
      labels: Object.keys(data),
      datasets: [{
        data: Object.values(data),
        backgroundColor: [
          'rgba(144, 238, 144, 0.7)', // Vault Cash
          'rgba(173, 216, 230, 0.7)', // Vault Metals
          'rgba(255, 206, 86, 0.7)',  // Banks
          'rgba(255, 159, 64, 0.7)'   // Investments
        ],
        borderColor: 'rgba(255,255,255,0.8)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#fff',
            font: { size: 14 },
            usePointStyle: true,
            padding: 20
          }
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(0,0,0,0.7)',
          titleColor: '#fff',
          bodyColor: '#fff',
          callbacks: {
            label(context) {
              const value = Number(context.raw) || 0;
              return `${context.label}: $${value.toLocaleString(
                undefined,
                { minimumFractionDigits: 2, maximumFractionDigits: 2 }
              )}`;
            }
          }
        }
      }
    }
  });
}

/* ================= INCOME FLOW PIE ================= */

async function renderIncomeFlowPie() {
  try {
    const res = await fetch('/api/profile', {
      credentials: 'include'
    });

    if (res.status === 401) {
      throw new Error('Your session has expired. Please log in again.');
    }

    if (!res.ok) {
      throw new Error(`Could not load profile (${res.status})`);
    }

    const profile = await res.json();

    const monthlyIncome = Number(profile.monthlyIncome) || 0;
    const monthlyExpenses = Number(profile.monthlyExpenses) || 0;
    const netIncome = monthlyIncome - monthlyExpenses;

    const focusProfiles = {
      growth: {
        vaultCash: 10,
        vaultMetals: 15,
        banks: 15,
        investments: 60
      },
      savings: {
        vaultCash: 50,
        vaultMetals: 10,
        banks: 25,
        investments: 15
      },
      protection: {
        vaultCash: 30,
        vaultMetals: 40,
        banks: 15,
        investments: 15
      }
    };

    // Normalize "Savings", "SAVINGS", etc. to the expected lowercase key.
    const rawFocusMode = window.getFocusMode?.() || 'savings';
    const focusMode = String(rawFocusMode).trim().toLowerCase();
    const percentages = focusProfiles[focusMode] || focusProfiles.savings;

    const titleEl = document.querySelector('.portfolio-title');

    if (titleEl) {
      const displayMode =
        focusMode.charAt(0).toUpperCase() + focusMode.slice(1);

      titleEl.textContent = `Portfolio Allocation ${displayMode}`;
    }

    if (netIncome <= 0) {
      // Don't leave an outdated allocation visible.
      if (portfolioPieCharts.portfolioPieChart) {
        portfolioPieCharts.portfolioPieChart.destroy();
        delete portfolioPieCharts.portfolioPieChart;
      }

      console.info('Portfolio allocation unavailable: net monthly income is not positive.');
      return;
    }

    const flowData = {
      'Vault Cash': percentages.vaultCash / 100 * netIncome,
      'Vault Metals': percentages.vaultMetals / 100 * netIncome,
      'Banks': percentages.banks / 100 * netIncome,
      'Investments': percentages.investments / 100 * netIncome
    };

    createPortfolioPie('portfolioPieChart', flowData);

  } catch (err) {
    console.error('Failed to render income flow pie chart:', err);
  }
}

/* ================= PORTFOLIO OVERLAY ================= */

function setupPortfolioOverlay() {
  const portfolioOverlay = document.getElementById('portfolioOverlay');
  const portfolioToggleBtn = document.getElementById('portfolioToggleBtn');
  const closePortfolioBtn = document.getElementById('closePortfolioBtn');

  portfolioToggleBtn?.addEventListener('click', async () => {
    portfolioOverlay?.classList.add('open');
    await renderIncomeFlowPie();
  });

  closePortfolioBtn?.addEventListener('click', () => {
    portfolioOverlay?.classList.remove('open');
  });
}

// Supports scripts loaded either before or after DOMContentLoaded.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupPortfolioOverlay);
} else {
  setupPortfolioOverlay();
}

/* ================= GLOBAL REFRESH HOOK ================= */

// Can be called after profile settings change.
window.updatePortfolioPie = renderIncomeFlowPie;
