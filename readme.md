# MoneyMap-

MoneyMap

MoneyMap is a desktop application built with Electron that helps you organize, manage, and grow your personal savings and assets—all in one place.

Whether you're just starting your savings journey with a home safe or already managing multiple bank accounts and assets spread across different institutions, MoneyMap gives you a centralized view of your financial picture.

Track and manage a wide range of assets, including:

Precious Metals — Gold, silver, copper, and other physical holdings.

Cash & Collectibles — Cash stored in your home safe, collectible currency, and other valuables.

Bank Accounts — Keep track of balances across multiple checking and savings accounts.

Retirement Accounts — Organize your 401(k), Traditional IRA, and Roth IRA assets.

Investments & Cryptocurrency — Monitor investment holdings and crypto assets.

MoneyMap helps you calculate gains and losses, establish savings goals, and allocate income across three strategic financial approaches: Growth, Savings, and Protection.

All of this is presented through a clean, retractable interface designed to make managing your money more organized, accessible, and straightforward.

Your assets. Your goals. Your financial direction. All in one place.

## 🚀 Features

- Add and view metal holdings with design, weight, and purchase price
- Real-time spot price fetch for Gold, Silver (from GoldAPI)
- Auto-calculate total portfolio value and gain/loss
- Clean UI with collapsible input form
- Offline fallback using local and server-cached spot prices
- Choose a savings strategy
- Standalone desktop app (built with Electron)
- Set Savings goals for loan downpayments
- Set asside emergency funds
- Include other investments to monitor your overall net worth

## 🖥️ Installation

1. **Clone the repo:**

   ```bash
   git clone https://github.com/yourusername/metal-wallet.git
   cd metal-wallet

## How To start in the command line run: 
    npm install 
    npm start 

## How to Get real gold and silver spot prices to reflect on my App: Setup

Money Map uses [GoldAPI.io](https://www.goldapi.io/) to retrieve precious metal spot prices. Each user must provide their own API key.

### 1. Get an API Key

1. Visit [GoldAPI.io](https://www.goldapi.io/).
2. Create an account and obtain your API key.

### 2. Create a `.env` File

In the root directory of the project, in the same folder as `server.js`, create a file named `.env`.

Add your API key:

```env
GOLD_API_KEY=your_api_key_here
```

Replace `your_api_key_here` with your own GoldAPI key.

### 3. Install Dependencies

Run the following commands in the project directory:

```bash
npm install
npm install dotenv
```

### 4. Restart Money Map

Save the `.env` file and restart the application.

### Security

- Never commit your `.env` file to GitHub.
- Ensure `.env` is included in `.gitignore`.
- Keep your API key private. Each user should use their own key.



## Things to Do :

    -Change the goal message to protection and growth when selected

    -Move the buckets based on the goal selected the highest percentage bucket animates to the top of the UI. 

    - Pie chart math needs to reflect percentage changes accuratly.  