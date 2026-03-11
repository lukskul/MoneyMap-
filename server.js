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
app.get('/api/spot-prices', async (req, res) => {
  const cache = readJSON(files.spotPrices, {});
  const ONE_HOUR = 60 * 60 * 1000;

  if (cache.lastUpdated && Date.now() - cache.lastUpdated < ONE_HOUR) {
    return res.json(cache);
  }

  try {
    const headers = {
      "x-access-token": process.env.GOLD_API_KEY,
      "Content-Type": "application/json"
    };

    const gold = await fetch("https://www.goldapi.io/api/XAU/USD", { headers }).then(r => r.json());
    const silver = await fetch("https://www.goldapi.io/api/XAG/USD", { headers }).then(r => r.json());

    const data = {
      gold: gold.price || cache.gold || 0,
      silver: silver.price || cache.silver || 0,
      copper: cache.copper || 1.99,
      lastUpdated: Date.now()
    };

    fs.writeFileSync(files.spotPrices, JSON.stringify(data, null, 2));

    res.json(data);

  } catch (err) {

    if (cache.gold) {
      return res.json(cache); // fallback
    }

    res.status(500).send("Failed to fetch spot prices");
  }
});

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

/* ================= BANKS API ================= */

// GET all accounts
app.get('/api/banks', (req, res) => {
  const banks = readJSON(files.banks, { accounts: [] });
  res.json(banks);
});

// POST new account
app.post('/api/banks', (req, res) => {
  const { bank, type, amount } = req.body;

  if (
    !bank || !type ||
    typeof amount !== 'number' || amount <= 0
  ) {
    return res.status(400).send('Invalid bank account');
  }

  const banks = readJSON(files.banks, { accounts: [] });

  const newAccount = {
    id: Date.now().toString(), // unique ID
    bank,
    type,
    amount
  };

  banks.accounts.push(newAccount);
  writeJSON(files.banks, banks, res);
});

// PUT update account amount
app.put('/api/banks/:id', (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;

  if (typeof amount !== 'number' || amount < 0) {
    return res.status(400).send('Invalid amount');
  }

  const banks = readJSON(files.banks, { accounts: [] });
  const account = banks.accounts.find(a => a.id === id);

  if (!account) return res.status(404).send('Bank account not found');

  account.amount = amount;
  writeJSON(files.banks, banks, res);
});

// DELETE account
app.delete('/api/banks/:id', (req, res) => {
  const { id } = req.params;
  const banks = readJSON(files.banks, { accounts: [] });

  const index = banks.accounts.findIndex(a => a.id === id);
  if (index === -1) return res.status(404).send('Bank account not found');

  banks.accounts.splice(index, 1);
  writeJSON(files.banks, banks, res);
});

/* ================= INVESTMENTS ================= */

// GET
app.get('/api/investments', (req, res) => {
  const investments = readJSON(files.investments, { investments: [] });
  res.json(investments);
});

// POST (Add new)
app.post('/api/investments', (req, res) => {
  const { platform, asset, value } = req.body;

  if (!platform || !asset || typeof value !== 'number') {
    return res.status(400).send('Invalid investment');
  }

  const data = readJSON(files.investments, { investments: [] });

  const newInvestment = {
    id: Date.now().toString(), // simple unique id
    platform,
    asset,
    value
  };

  data.investments.push(newInvestment);
  writeJSON(files.investments, data, res);
});

// PUT (Update value)
app.put('/api/investments/:id', (req, res) => {
  const { id } = req.params;
  const { value } = req.body;

  if (typeof value !== 'number') {
    return res.status(400).send('Invalid value');
  }

  const data = readJSON(files.investments, { investments: [] });

  const investment = data.investments.find(inv => inv.id === id);

  if (!investment) {
    return res.status(404).send('Investment not found');
  }

  investment.value = value;

  writeJSON(files.investments, data, res);
});

// DELETE
app.delete('/api/investments/:id', (req, res) => {
  const { id } = req.params;

  const data = readJSON(files.investments, { investments: [] });

  const index = data.investments.findIndex(inv => inv.id === id);

  if (index === -1) {
    return res.status(404).send('Investment not found');
  }

  data.investments.splice(index, 1);

  writeJSON(files.investments, data, res);
});

/* ================= START SERVER ================= */
app.listen(PORT, () => {
  console.log(`Money Map running at http://localhost:${PORT}`);
});
