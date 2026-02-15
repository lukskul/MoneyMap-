const API_KEY = "goldapi-pv9smbmkqkxq-io";

/* ================= SPOT PRICES ================= */
async function fetchSpotPrices() {
  const headers = {
    "x-access-token": API_KEY,
    "Content-Type": "application/json"
  };

  try {
    const [goldRes, silverRes] = await Promise.all([
      fetch("https://www.goldapi.io/api/XAU/USD", { headers }),
      fetch("https://www.goldapi.io/api/XAG/USD", { headers })
    ]);

    if (!goldRes.ok || !silverRes.ok) {
      const status = !goldRes.ok ? goldRes.status : silverRes.status;
      throw new Error(`GoldAPI response not ok (status ${status})`);
    }

    const goldData = await goldRes.json();
    const silverData = await silverRes.json();

    const prices = {
      gold: goldData.price,
      silver: silverData.price,
      copper: 1.99,
      lastUpdated: new Date().toISOString()
    };

    localStorage.setItem('spotPrices', JSON.stringify(prices));

    await fetch('/api/spot-prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prices)
    });

    return prices;
  } catch {
    const cached = localStorage.getItem('spotPrices');
    if (cached) return JSON.parse(cached);
    return { gold: 0, silver: 0, copper: 1.99, lastUpdated: null };
  }
}

/* ================= HOLDINGS ================= */
async function fetchHoldings() {
  const res = await fetch('/api/metals');
  const metals = await res.json();
  return metals.holdings || [];
}

// Expose globally for total-assets.js
window.fetchHoldings = fetchHoldings;

function groupHoldings(holdings) {
  const grouped = {};
  holdings.forEach(item => {
    const key = `${item.metals}|${item.design || ''}`;
    if (!grouped[key]) {
      grouped[key] = {
        metals: item.metals,
        design: item.design,
        ounces: item.weight * item.quantity,
        totalBuy: item.buyPrice * item.weight * item.quantity
      };
    } else {
      grouped[key].ounces += item.weight * item.quantity;
      grouped[key].totalBuy += item.buyPrice * item.weight * item.quantity;
    }
  });

  Object.values(grouped).forEach(entry => {
    entry.buyPrice = entry.totalBuy / entry.ounces;
  });

  return Object.values(grouped);
}

/* ================= RENDER TABLE ================= */
let currentFilter = null;

async function renderMetals(spotPrices, holdings, filterMetals = null) {
  const grouped = groupHoldings(holdings);
  const table = document.getElementById('metalsTable');
  table.innerHTML = '';

  const uniqueDesigns = [...new Set(holdings.map(h => h.design).filter(Boolean))];
  document.getElementById('designs').innerHTML = uniqueDesigns.map(d => `<option value="${d}">`).join('');

  let totalValue = 0;

  grouped.forEach(item => {
    if (filterMetals && item.metals !== filterMetals) return;

    const spot = spotPrices[item.metals] || 0;
    const value = item.ounces * spot;
    const cost = item.ounces * item.buyPrice;
    const gainLoss = value - cost;

    totalValue += value;

    const row = document.createElement('tr');
    row.setAttribute('data-metals', item.metals);
    row.innerHTML = `
      <td class="metals-cell" style="cursor:pointer">${item.metals}</td>
      <td>${item.design || '-'}</td>
      <td>${item.ounces}</td>
      <td>$${item.buyPrice.toFixed(2)}</td>
      <td>$${spot.toFixed(2)}</td>
      <td style="color:${gainLoss >= 0 ? 'lightgreen' : 'lightblue'}">$${gainLoss.toFixed(2)}</td>
      <td style="color:green">$${value.toFixed(2)}</td>
    `;
    table.appendChild(row);

    row.querySelector('.metals-cell').addEventListener('click', async () => {
      currentFilter = currentFilter === item.metals ? null : item.metals;
      await renderMetals(spotPrices, holdings, currentFilter);
      window.updateTotalAssets && window.updateTotalAssets();
    });
  });

  document.getElementById('portfolioValue').textContent = `(Total: $${totalValue.toFixed(2)})`;

  // Expose bucket total for total-assets.js
  window.bucketTotals = window.bucketTotals || {};
  window.bucketTotals.metals = totalValue;
}

/* ================= UPDATE UI ================= */
async function updateUI() {
  const spotPrices = await fetchSpotPrices();
  const holdings = await fetchHoldings();

  document.getElementById('goldSpot').textContent = `Gold: $${spotPrices.gold.toFixed(2)}`;
  document.getElementById('silverSpot').textContent = `Silver: $${spotPrices.silver.toFixed(2)}`;
  document.getElementById('copperSpot').textContent = `Copper: $${spotPrices.copper.toFixed(2)}`;

  await renderMetals(spotPrices, holdings, currentFilter);

  if (spotPrices.lastUpdated) {
    const date = new Date(spotPrices.lastUpdated);
    document.getElementById('lastUpdated').textContent = `Last updated: ${date.toLocaleString()}`;
  } else {
    document.getElementById('lastUpdated').textContent = 'Last updated: N/A';
  }

  window.updateTotalAssets && window.updateTotalAssets();
}

/* ================= FORM & EVENTS ================= */
document.addEventListener('DOMContentLoaded', () => {
  const metalsInput = document.getElementById('metals');
  const weightSelect = document.getElementById('weightSelect');
  const quantityInput = document.getElementById('metalsQuantity');
  const buyPriceInput = document.getElementById('buyPrice');
  const designInput = document.getElementById('design');
  const submitBtn = document.getElementById('submitBtn');
  const toggleBtn = document.getElementById('toggleFormBtn');
  const formWrapper = document.getElementById('formWrapper');

  toggleBtn.addEventListener('click', () => formWrapper.classList.toggle('open'));

  function validateForm() {
    const metals = metalsInput.value.trim();
    const weight = parseFloat(weightSelect.value);
    const quantity = parseInt(quantityInput.value, 10);
    const buyPrice = parseFloat(buyPriceInput.value);
    const design = designInput.value.trim();

    const isValid =
      metals !== '' &&
      !isNaN(weight) && weight > 0 &&
      !isNaN(quantity) && quantity > 0 &&
      !isNaN(buyPrice) && buyPrice >= 0 &&
      design !== '';

    submitBtn.disabled = !isValid;
    submitBtn.style.backgroundColor = isValid ? '#4CAF50' : '#ccc';
    submitBtn.style.cursor = isValid ? 'pointer' : 'not-allowed';
  }

  [metalsInput, weightSelect, quantityInput, buyPriceInput, designInput].forEach(input =>
    input.addEventListener('input', validateForm)
  );

  document.getElementById('entryForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const entry = {
      metals: metalsInput.value.trim(),
      weight: parseFloat(weightSelect.value),
      quantity: parseInt(quantityInput.value, 10),
      buyPrice: parseFloat(buyPriceInput.value),
      design: designInput.value.trim()
    };

    try {
      // Add new coin to server
      const response = await fetch('/api/metals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });

      if (!response.ok) {
        console.error('Server error:', await response.text());
        return; // Stop if server failed
      }

      // Clear form
      e.target.reset();
      validateForm();

      // Force update holdings and UI
      const updatedHoldings = await fetchHoldings(); // fresh data from server
      const spotPrices = JSON.parse(localStorage.getItem('spotPrices')) || {};
      await renderMetals(spotPrices, updatedHoldings, currentFilter);

      // Update total assets
      window.updateTotalAssets && window.updateTotalAssets();

    } catch (error) {
      console.error('Fetch error:', error);
    }
  });

  validateForm();
});

updateUI();

/* ================= TOTAL ASSETS HOOK ================= */
window.getMetalsTotal = async function () {
  const holdings = await fetchHoldings();
  const spotPrices = JSON.parse(localStorage.getItem('spotPrices')) || {};
  return holdings.reduce(
    (sum, item) => sum + item.weight * item.quantity * (spotPrices[item.metals] || 0),
    0
  );
};

// Register metals bucket for total-assets.js
window.registerAssetBucket && window.registerAssetBucket('metals', window.getMetalsTotal);
