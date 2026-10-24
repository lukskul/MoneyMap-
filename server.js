const express = require('express');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const session = require('express-session');

// Development storage. For a packaged Electron app, use a writable
// app data directory supplied by Electron's app.getPath('userData').
const dataDir = path.resolve(process.env.MONEYMAP_DATA_DIR || path.join(__dirname, 'privateData'));
const usersDir = path.join(dataDir, 'users');
const usersFile = path.join(dataDir, 'users.json');
const sessionSecretFile = path.join(dataDir, 'session-secret');

fs.mkdirSync(usersDir, { recursive: true });

// Preserve your existing data structures.
const defaults = {
  metals: { holdings: [] },
  vault: { vault: [] },
  banks: { accounts: [] },
  investments: { investments: [] },
  spotPrices: {},
  profile: {
    monthlyIncome: 0,
    monthlyExpenses: 0,
    emergencyMonths: 6,
    focusMode: "",
    savingsSubgoal: "",
    loanAmount: 0,
    downPayment: 0,
    monthsToGoal: 0
  }
};

function readJSON(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

function writeJSON(filePath, data, res) {
  try {
    const temp = `${filePath}.${crypto.randomUUID()}.tmp`;

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(temp, JSON.stringify(data, null, 2), {
      mode: 0o600
    });
    fs.renameSync(temp, filePath);

    if (res) return res.json({ success: true });
    return true;
  } catch (error) {
    console.error('Failed to write JSON:', error);

    if (res) {
      return res.status(500).json({
        success: false,
        error: 'Failed to save data'
      });
    }

    throw error;
  }
}

function getUserFiles(userId) {
  // Accept only a server-generated UUID.
  if (!/^[0-9a-f-]{36}$/i.test(userId || '')) {
    throw new Error('Invalid user ID');
  }

  const dir = path.join(usersDir, userId);

  return {
    metals: path.join(dir, 'metals.json'),
    vault: path.join(dir, 'vault.json'),
    banks: path.join(dir, 'banks.json'),
    investments: path.join(dir, 'investments.json'),
    spotPrices: path.join(dir, 'spotPrices.json'),
    profile: path.join(dir, 'profile.json')
  };
}

function initializeUser(userId) {
  const files = getUserFiles(userId);

  for (const [key, file] of Object.entries(files)) {
    if (!fs.existsSync(file)) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(defaults[key], null, 2), {
        flag: 'wx',
        mode: 0o600
      });
    }
  }
}

function getUsers() {
  const users = readJSON(usersFile, []);
  if (!Array.isArray(users)) {
    throw new Error('Invalid users registry');
  }
  return users;
}

function getSessionSecret() {
  if (process.env.MONEYMAP_SESSION_SECRET) {
    return process.env.MONEYMAP_SESSION_SECRET;
  }

  try {
    return fs.readFileSync(sessionSecretFile, 'utf8').trim();
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  const secret = crypto.randomBytes(48).toString('hex');
  try {
    fs.writeFileSync(sessionSecretFile, secret, {
      flag: 'wx',
      mode: 0o600
    });
    return secret;
  } catch (err) {
    // Another instance may have created the secret at the same time.
    if (err.code === 'EEXIST') {
      return fs.readFileSync(sessionSecretFile, 'utf8').trim();
    }
    throw err;
  }
}

// Use a distinct cookie name for each project data directory. Cookies are not
// isolated by port, so different localhost ports alone are not sufficient.
const sessionCookieName = 'moneymap.sid.' +
  crypto.createHash('sha256').update(dataDir).digest('hex').slice(0, 12);

// Serve only frontend assets from public/.
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '100kb' }));

app.use(session({
  name: sessionCookieName,
  secret: getSessionSecret(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: false,
    maxAge: 8 * 60 * 60 * 1000
  }
}));

function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Please log in.' });
  }

  try {
    req.userFiles = getUserFiles(req.session.userId);
    next();
  } catch (err) {
    next(err);
  }
}


/* ================= AUTHENTICATION ================= */

function saveUsers(users) {
  const temp = `${usersFile}.${crypto.randomUUID()}.tmp`;

  fs.writeFileSync(temp, JSON.stringify(users, null, 2), {
    flag: 'wx',
    mode: 0o600
  });
  fs.renameSync(temp, usersFile);
}

function validUsername(value) {
  return typeof value === 'string' &&
    /^[a-z0-9_-]{3,32}$/.test(value);
}

function finishLogin(req, res, user) {
  req.session.regenerate(err => {
    if (err) {
      return res.status(500).json({ error: 'Could not start session.' });
    }

    req.session.userId = user.id;

    req.session.save(err => {
      if (err) {
        return res.status(500).json({ error: 'Could not save session.' });
      }

      res.json({
        user: { id: user.id, username: user.username }
      });
    });
  });
}

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const username = typeof req.body.username === 'string'
      ? req.body.username.trim().toLowerCase()
      : '';

    const password = typeof req.body.password === 'string'
      ? req.body.password
      : '';

    if (!validUsername(username)) {
      return res.status(400).json({
        error: 'Username must be 3–32 characters using letters, numbers, _ or -.'
      });
    }

    if (password.length < 12 ||
        Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({
        error: 'Password must be at least 12 characters and no more than 72 UTF-8 bytes.'
      });
    }

    const users = getUsers();

    if (users.some(u => u.username === username)) {
      return res.status(409).json({ error: 'Username already exists.' });
    }

    const user = {
      id: crypto.randomUUID(),
      username,
      passwordHash: await bcrypt.hash(password, 12)
    };

    // Create private files and save the account registry.
    initializeUser(user.id);
    users.push(user);
    saveUsers(users);

    finishLogin(req, res, user);
  } catch (err) {
    next(err);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const username = typeof req.body.username === 'string'
      ? req.body.username.trim().toLowerCase()
      : '';

    const password = typeof req.body.password === 'string'
      ? req.body.password
      : '';

    const user = getUsers().find(u => u.username === username);

    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      return res.status(401).json({
        error: 'Invalid username or password.'
      });
    }

    finishLogin(req, res, user);
  } catch (err) {
    next(err);
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = getUsers().find(u => u.id === req.session.userId);

  if (!user) {
    return req.session.destroy(() => {
      res.status(401).json({ error: 'Session is no longer valid.' });
    });
  }

  res.json({
    user: { id: user.id, username: user.username }
  });
});

app.post('/api/auth/logout', (req, res) => {
  if (!req.session) return res.sendStatus(204);

  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed.' });
    }

    res.clearCookie(sessionCookieName, {
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
      path: '/'
    });

    res.sendStatus(204);
  });
});

// All financial APIs below this point require a valid login.
app.use('/api', requireAuth);


/* ================= PROFILE ================= */

app.get('/api/profile', (req, res) => {
  const profile = readJSON(req.userFiles.profile, {
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
  writeJSON(req.userFiles.profile, req.body, res);
});


/* ================= METALS ================= */


app.get('/api/spot-prices', async (req, res) => {
  const ONE_HOUR = 60 * 60 * 1000;
  const file = req.userFiles?.spotPrices;

  if (!file) {
    return res.status(500).json({
      error: 'Spot price cache path is unavailable. Check user file setup.'
    });
  }

  const cache = readJSON(file, {});
  const hasCachedPrices =
    Number(cache.gold) > 0 && Number(cache.silver) > 0;

  // Use a valid cache for up to one hour.
  if (
    hasCachedPrices &&
    cache.lastUpdated &&
    Date.now() - Number(cache.lastUpdated) < ONE_HOUR
  ) {
    return res.json(cache);
  }

  const apiKey = process.env.GOLD_API_KEY;

  if (!apiKey) {
    console.error('Spot prices: GOLD_API_KEY is missing.');

    if (hasCachedPrices) {
      return res.json({ ...cache, stale: true });
    }

    return res.status(500).json({
      error: 'GOLD_API_KEY is not configured on the server.'
    });
  }

  async function fetchMetal(symbol) {
    const response = await fetch(
      `https://www.goldapi.io/api/${symbol}/USD`,
      {
        headers: {
          'x-access-token': apiKey,
          'Accept': 'application/json'
        }
      }
    );

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(
        `GoldAPI ${symbol} failed:`,
        response.status,
        body
      );

      throw new Error(
        `GoldAPI ${symbol} returned HTTP ${response.status}`
      );
    }

    const price = Number(body.price);

    if (!Number.isFinite(price) || price <= 0) {
      console.error(`GoldAPI ${symbol} returned invalid price:`, body);
      throw new Error(`GoldAPI ${symbol} returned no valid price`);
    }

    return price;
  }

  try {
    const [goldPrice, silverPrice] = await Promise.all([
      fetchMetal('XAU'),
      fetchMetal('XAG')
    ]);

    const data = {
      gold: goldPrice,
      silver: silverPrice,
      copper: Number(cache.copper) > 0 ? Number(cache.copper) : 1.99,
      lastUpdated: Date.now()
    };

    writeJSON(file, data);

    console.log('Spot prices updated:', {
      gold: data.gold,
      silver: data.silver
    });

    return res.json(data);

  } catch (err) {
    console.error('Spot price update failed:', err.message);

    if (hasCachedPrices) {
      return res.json({ ...cache, stale: true });
    }

    return res.status(502).json({
      error: 'Failed to fetch spot prices.',
      details: err.message
    });
  }
});


/* ================= VAULT ================= */
app.get('/api/vault', (req, res) => {
  const vault = readJSON(req.userFiles.vault, { vault: [] });
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

  const vault = readJSON(req.userFiles.vault, { vault: [] });

  vault.vault.push({
    denomination,
    quantity,
    year: year || null
  });

  writeJSON(req.userFiles.vault, vault, res);
});

app.get('/api/metals', (req, res) => {
  const metals = readJSON(req.userFiles.metals, { holdings: [] });
  res.json(metals);
});


app.post('/api/metals', (req, res) => {
  try {
    const file = req.userFiles.metals;
    const data = readJSON(file, { holdings: [] });

    const { metals, weight, quantity, buyPrice, design } = req.body;

    // Validate the submitted holding
    if (
      typeof metals !== 'string' || !metals.trim() ||
      typeof design !== 'string' || !design.trim() ||
      !Number.isFinite(weight) || weight <= 0 ||
      !Number.isInteger(quantity) || quantity <= 0 ||
      !Number.isFinite(buyPrice) || buyPrice < 0
    ) {
      return res.status(400).json({
        error: 'Invalid metal holding data.'
      });
    }

    // Add the new holding
    data.holdings = Array.isArray(data.holdings)
      ? data.holdings
      : [];

    const { randomUUID } = require('crypto');

    data.holdings.push({
      id: randomUUID(),
      metals: metals.trim(),
      weight,
      quantity,
      buyPrice,
      design: design.trim()
    });

    // Save using the same file format as GET /api/metals
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');

    return res.status(201).json({
      success: true,
      holding: data.holdings[data.holdings.length - 1],
      holdings: data.holdings
    });
  } catch (error) {
    console.error('Error saving metal holding:', error);
    return res.status(500).json({
      error: 'Failed to save metal holding.'
    });
  }
});


/* DELETE metal holding */
app.delete('/api/metals/:id', (req, res) => {
  const { id } = req.params;
  const metals = readJSON(req.userFiles.metals, { holdings: [] });

  const index = metals.holdings.findIndex(
    item => String(item.id) === id
  );

  if (index === -1) {
    return res.status(404).send('Metal holding not found');
  }

  metals.holdings.splice(index, 1);
  writeJSON(req.userFiles.metals, metals, res);
});


/* DELETE cash account */
app.delete('/api/cash/:id', (req, res) => {
  const { id } = req.params;
  const cash = readJSON(req.userFiles.cash, { accounts: [] });

  const index = cash.accounts.findIndex(
    item => String(item.id) === id
  );

  if (index === -1) {
    return res.status(404).send('Cash account not found');
  }

  cash.accounts.splice(index, 1);
  writeJSON(req.userFiles.cash, cash, res);
});

/*======== REMOVE A QUANTITY FROM A METAL HOLDING ==========*/

app.post('/api/metals/remove-quantity', (req, res) => {
  try {
    const { metals, design, quantity } = req.body;

    if (
      typeof metals !== 'string' ||
      !metals.trim() ||
      typeof design !== 'string' ||
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      return res.status(400).send('Invalid metal removal request.');
    }

    const file = req.userFiles.metals;
    const data = readJSON(file, { holdings: [] });

    data.holdings = Array.isArray(data.holdings) ? data.holdings : [];

    const matches = item =>
      item.metals === metals &&
      (item.design || '') === design;

    const available = data.holdings
      .filter(matches)
      .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

    if (quantity > available) {
      return res.status(400).send('Not enough matching items to remove.');
    }

    let remaining = quantity;

    for (
      let i = data.holdings.length - 1;
      i >= 0 && remaining > 0;
      i--
    ) {
      const item = data.holdings[i];
      if (!matches(item)) continue;

      const currentQuantity = Number(item.quantity) || 0;
      const removeCount = Math.min(currentQuantity, remaining);

      item.quantity = currentQuantity - removeCount;
      remaining -= removeCount;

      if (item.quantity === 0) {
        data.holdings.splice(i, 1);
      }
    }

    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');

    return res.json({
      success: true,
      holdings: data.holdings
    });
  } catch (error) {
    console.error('Error removing metal quantity:', error);
    return res.status(500).send('Failed to remove metal quantity.');
  }
});


/*=====. Remove quantity from Cash deposits.=========*/

app.post('/api/vault/remove-quantity', (req, res) => {
  try {
    const { denomination, year, quantity } = req.body;

    if (
      !Number.isFinite(denomination) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      typeof year !== 'string'
    ) {
      return res.status(400).send('Invalid removal request.');
    }

    const file = req.userFiles.vault;
    const data = readJSON(file, { vault: [] });

    data.vault = Array.isArray(data.vault) ? data.vault : [];

    const matchesYear = entry => {
      const entryYear =
        entry.year == null || entry.year === ''
          ? 'Assorted'
          : String(entry.year);

      return (
        Number(entry.denomination) === denomination &&
        entryYear === year
      );
    };

    const available = data.vault
      .filter(matchesYear)
      .reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);

    if (quantity > available) {
      return res.status(400).send('Not enough bills available to remove.');
    }

    let remaining = quantity;

    // Reduce matching entries; remove records that reach zero.
    for (let i = data.vault.length - 1; i >= 0 && remaining > 0; i--) {
      const entry = data.vault[i];

      if (!matchesYear(entry)) continue;

      const entryQuantity = Number(entry.quantity) || 0;
      const toRemove = Math.min(entryQuantity, remaining);

      entry.quantity = entryQuantity - toRemove;
      remaining -= toRemove;

      if (entry.quantity === 0) {
        data.vault.splice(i, 1);
      }
    }

    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');

    return res.json({ success: true, vault: data.vault });
  } catch (error) {
    console.error('Error removing vault cash:', error);
    return res.status(500).send('Failed to remove vault cash.');
  }
});



/* ================= BANKS API ================= */

// GET all accounts
app.get('/api/banks', (req, res) => {
  const banks = readJSON(req.userFiles.banks, { accounts: [] });
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

  const banks = readJSON(req.userFiles.banks, { accounts: [] });

  const newAccount = {
    id: Date.now().toString(), // unique ID
    bank,
    type,
    amount
  };

  banks.accounts.push(newAccount);
  writeJSON(req.userFiles.banks, banks, res);
});

// PUT update account amount
app.put('/api/banks/:id', (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;

  if (typeof amount !== 'number' || amount < 0) {
    return res.status(400).send('Invalid amount');
  }

  const banks = readJSON(req.userFiles.banks, { accounts: [] });
  const account = banks.accounts.find(a => a.id === id);

  if (!account) return res.status(404).send('Bank account not found');

  account.amount = amount;
  writeJSON(req.userFiles.banks, banks, res);
});

// DELETE account
app.delete('/api/banks/:id', (req, res) => {
  const { id } = req.params;
  const banks = readJSON(req.userFiles.banks, { accounts: [] });

  const index = banks.accounts.findIndex(a => a.id === id);
  if (index === -1) return res.status(404).send('Bank account not found');

  banks.accounts.splice(index, 1);
  writeJSON(req.userFiles.banks, banks, res);
});

/* ================= INVESTMENTS ================= */

// GET
app.get('/api/investments', (req, res) => {
  const investments = readJSON(req.userFiles.investments, { investments: [] });
  res.json(investments);
});

// POST (Add new)
app.post('/api/investments', (req, res) => {
  const { platform, asset, value } = req.body;

  if (!platform || !asset || typeof value !== 'number') {
    return res.status(400).send('Invalid investment');
  }

  const data = readJSON(req.userFiles.investments, { investments: [] });

  const newInvestment = {
    id: Date.now().toString(), // simple unique id
    platform,
    asset,
    value
  };

  data.investments.push(newInvestment);
  writeJSON(req.userFiles.investments, data, res);
});

// PUT (Update value)
app.put('/api/investments/:id', (req, res) => {
  const { id } = req.params;
  const { value } = req.body;

  if (typeof value !== 'number') {
    return res.status(400).send('Invalid value');
  }

  const data = readJSON(req.userFiles.investments, { investments: [] });

  const investment = data.investments.find(inv => inv.id === id);

  if (!investment) {
    return res.status(404).send('Investment not found');
  }

  investment.value = value;

  writeJSON(req.userFiles.investments, data, res);
});


/* DELETE investment */
app.delete('/api/investments/:id', (req, res) => {
  const { id } = req.params;
  const investments = readJSON(req.userFiles.investments, { investments: [] });

  const index = investments.investments.findIndex(
    item => String(item.id) === id
  );

  if (index === -1) {
    return res.status(404).send('Investment not found');
  }

  investments.investments.splice(index, 1);
  writeJSON(req.userFiles.investments, investments, res);
});



/* ================= START SERVER ================= */
const server = app.listen(PORT, '127.0.0.1', () => {
  const address = server.address();
  const actualPort = address && typeof address === 'object' ? address.port : PORT;

  // main.js waits for this exact marker before opening the Electron window.
  console.log(`SERVER_READY:${actualPort}`);
  console.log(`Money Map running at http://127.0.0.1:${actualPort}`);
});

server.on('error', error => {
  console.error('Money Map server failed to start:', error);
  process.exitCode = 1;
});
