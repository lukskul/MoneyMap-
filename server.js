const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// app.use(express.static('public'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

/* ================= FILE PATHS ================= */
const dataDir = path.join(__dirname, 'data');

const files = {
  metals: path.join(dataDir, 'metals.json'),
  vault: path.join(dataDir, 'vault.json'),
  banks: path.join(dataDir, 'banks.json'),
  investments: path.join(dataDir, 'investments.json'),
  spotPrices: path.join(dataDir, 'spotPrices.json'),
  profile: path.join(dataDir, 'profile.json') 
};

/* ================= HELPERS ================= */
function readJSON(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
      return fallback;
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch {
    return fallback;
  }
}

function writeJSON(filePath, data, res) {
  fs.writeFile(filePath, JSON.stringify(data, null, 2), err => {
    if (err) return res.status(500).send('Write error');
    res.json({ success: true });
  });
}

/* ================= PROFILE ================= */

app.get('/api/profile', (req, res) => {
  const profile = readJSON(files.profile, {
    monthlyIncome: 0,
    monthlyExpenses: 0,
    emergencyMonths: 6,
    focusMode: "",
    savingsSubgoal: "",
    loanAmount: 0,
    downPayment: 0,
    monthsToGoal: 0
  });

  res.json(profile);
});

app.post('/api/profile', (req, res) => {
  writeJSON(files.profile, req.body, res);
});


/* ================= METALS ================= */
app.get('/api/metals', (req, res) => {
  const metals = readJSON(files.metals, { holdings: [] });
  res.json(metals);
});

app.post('/api/metals', (req, res) => {
  const { metals, weight, quantity, buyPrice, design } = req.body; // <-- use 'metals'

  if (!metals || typeof weight !== 'number' || typeof quantity !== 'number' || typeof buyPrice !== 'number') {
    return res.status(400).send('Invalid metals entry');
  }

  const metalsData = readJSON(files.metals, { holdings: [] });
  metalsData.holdings.push({ metals, weight, quantity, buyPrice, design: design || '' });
  writeJSON(files.metals, metalsData, res);
});

app.delete('/api/metals/:index', (req, res) => {
  const index = parseInt(req.params.index);
  const metals = readJSON(files.metals, { holdings: [] });

  if (index < 0 || index >= metals.holdings.length) return res.status(400).send('Invalid index');

  metals.holdings.splice(index, 1);
  writeJSON(files.metals, metals, res);
});

/* ================= VAULT ================= */
app.get('/api/vault', (req, res) => {
  const vault = readJSON(files.vault, { vault: [] });
  res.json(vault);
});

app.post('/api/vault', (req, res) => {
  const { denomination, quantity, year } = req.body;

  if (
    typeof denomination !== 'number' ||
    typeof quantity !== 'number' ||
    quantity <= 0
  ) {
    return res.status(400).send('Invalid vault entry');
  }

  const vault = readJSON(files.vault, { vault: [] });

  vault.vault.push({
    denomination,
    quantity,
    year: year || null
  });

  writeJSON(files.vault, vault, res);
});

/* ================= BANKS ================= */
app.get('/api/banks', (req, res) => {
  const banks = readJSON(files.banks, { accounts: [] });
  res.json(banks);
});

app.post('/api/banks', (req, res) => {
  const { bank, type, amount } = req.body;

  if (
    typeof bank !== 'string' ||
    typeof type !== 'string' ||
    typeof amount !== 'number' ||
    amount <= 0
  ) {
    return res.status(400).send('Invalid bank account');
  }

  const banks = readJSON(files.banks, { accounts: [] });

  banks.accounts.push({
    bank,
    type,
    amount
  });

  writeJSON(files.banks, banks, res);
});

/* ================= INVESTMENTS ================= */
app.get('/api/investments', (req, res) => {
  const investments = readJSON(files.investments, { investments: [] });
  res.json(investments);
});

app.post('/api/investments', (req, res) => {
  const { platform, asset, value } = req.body;
  if (!platform || !asset || typeof value !== 'number') return res.status(400).send('Invalid investment');

  const investments = readJSON(files.investments, { investments: [] });
  investments.investments.push({ platform, asset, value });
  writeJSON(files.investments, investments, res);
});

/* ================= SPOT PRICES ================= */
app.get('/api/spot-prices', (req, res) => {
  const prices = readJSON(files.spotPrices, {});
  res.json(prices);
});

app.post('/api/spot-prices', (req, res) => {
  writeJSON(files.spotPrices, req.body, res);
});

/* ================= START SERVER ================= */
app.listen(PORT, () => {
  console.log(`Money Map running at http://localhost:${PORT}`);
});
