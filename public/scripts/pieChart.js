let pieChart;
const portfolioOverlay = document.getElementById('portfolioOverlay');
const portfolioToggleBtn = document.getElementById('portfolioToggleBtn');
const closePortfolioBtn = document.getElementById('closePortfolioBtn');

portfolioToggleBtn.addEventListener('click', () => {
  portfolioOverlay.classList.add('open');
  window.checkPortfolioBalance(); // refresh chart when opened
});

closePortfolioBtn.addEventListener('click', () => {
  portfolioOverlay.classList.remove('open');
});

// Close when clicking outside content
portfolioOverlay.addEventListener('click', (e) => {
  if (e.target.id === 'portfolioOverlay') {
    portfolioOverlay.classList.remove('open');
  }
});


function createPortfolioPie(chartId, totals) {
  const ctx = document.getElementById(chartId).getContext('2d');

  if (pieChart) pieChart.destroy();

  const data = {
    'Vault Cash': totals.vaultCash || 0,
    'Vault Metals': totals.vaultMetals || 0,
    'Banks': totals.banks || 0,
    'Investments': totals.investments || 0
  };

  pieChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: Object.keys(data),
      datasets: [{
        data: Object.values(data),
        backgroundColor: [
          'rgba(144, 238, 144, 0.7)', // soft green
          'rgba(173, 216, 230, 0.7)', // soft blue
          'rgba(255, 206, 86, 0.7)',  // soft yellow
          'rgba(255, 159, 64, 0.7)'   // soft orange
        ],
        borderColor: 'rgba(255,255,255,0.8)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'right', // can be 'left' too
          labels: {
            color: '#fff', // white text
            font: { size: 14 },
            usePointStyle: true,
            padding: 20
          },
          onHover: function (e, legendItem, legend) {
            // Animate the legend item on hover
            const item = legend.legendItems[legendItem.index];
            item.font = { ...item.font, weight: 'bold', size: 16 };
            pieChart.update();
          },
          onLeave: function (e, legendItem, legend) {
            const item = legend.legendItems[legendItem.index];
            item.font = { ...item.font, weight: 'normal', size: 14 };
            pieChart.update();
          }
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

// Example usage
const totals = {
  vaultCash: 5000,
  vaultMetals: 8000,
  banks: 12000,
  investments: 20000
};

createPortfolioPie('portfolioPieChart', totals);
