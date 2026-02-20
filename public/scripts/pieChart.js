let pieChart;

function createPortfolioPie(chartId, data) {
  const ctx = document.getElementById(chartId).getContext('2d');

  if (pieChart) pieChart.destroy();

  pieChart = new Chart(ctx, {
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
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#fff', font: { size: 14 }, usePointStyle: true, padding: 20 }
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(0,0,0,0.7)',
          titleColor: '#fff',
          bodyColor: '#fff'
        }
      }
    }
  });
}

async function renderIncomeFlowPie() {
  try {
    const res = await fetch('/api/profile');
    if (!res.ok) return;

    const profile = await res.json();
    const monthlyIncome = Number(profile.monthlyIncome || 0);
    const monthlyExpenses = Number(profile.monthlyExpenses || 0);
    const netIncome = monthlyIncome - monthlyExpenses;

    if (netIncome <= 0) return;

    // Focus mode percentages
    const focusProfiles = {
      growth: { vaultCash: 10, vaultMetals: 15, banks: 15, investments: 60 },
      savings: { vaultCash: 50, vaultMetals: 10, banks: 25, investments: 15 },
      protection: { vaultCash: 30, vaultMetals: 40, banks: 15, investments: 15 }
    };

    const focusMode = profile.focusMode || 'savings';
    const percentages = focusProfiles[focusMode] || focusProfiles['savings'];

    // Update the title dynamically
    const titleEl = document.querySelector('.portfolio-title');
    if (titleEl) {
      titleEl.textContent = `Portfolio allocation ${focusMode}`;
    }

    // Calculate allocated amounts
    const flowData = {
      'Vault Cash': (percentages.vaultCash / 100) * netIncome,
      'Vault Metals': (percentages.vaultMetals / 100) * netIncome,
      'Banks': (percentages.banks / 100) * netIncome,
      'Investments': (percentages.investments / 100) * netIncome
    };

    createPortfolioPie('portfolioPieChart', flowData);

  } catch (err) {
    console.error("Failed to render income flow pie chart:", err);
  }
}

// Refresh pie whenever portfolio overlay opens
const portfolioOverlay = document.getElementById('portfolioOverlay');
const portfolioToggleBtn = document.getElementById('portfolioToggleBtn');
const closePortfolioBtn = document.getElementById('closePortfolioBtn');

portfolioToggleBtn.addEventListener('click', async () => {
  portfolioOverlay.classList.add('open');
  await renderIncomeFlowPie();
});

closePortfolioBtn.addEventListener('click', () => {
  portfolioOverlay.classList.remove('open');
});

// Optional: refresh when profile changes
window.updatePortfolioPie = renderIncomeFlowPie;
