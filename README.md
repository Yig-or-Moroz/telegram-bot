# Bakery Order Management Bot

A Telegram bot for managing daily bakery orders, tracking cake production, and organizing delivery schedules. Built with Node.js, Telegraf, and SQLite.

## Getting Started

**[Open Bakery Order Management Bot on Telegram](https://t.me/ZARWKA_bot)**

Launch the bot in Telegram and press **Start** to explore its features.

## Features

- **Daily Order Management** — View and edit bakery orders for specific dates.
- **Reusable Templates** — Manage standard order templates for different locations.
- **Custom Order Modifications** — Add, remove, or adjust items for individual dates.
- **Order History** — Review previous orders.
- **Cake Production Overview** — View cakes that need to be prepared, coated, or finished.
- **Delivery Scheduling** — Organize delivery orders by date, item, and custom comments.
- **Production Progress Tracking** — Track the completion status of daily tasks.
- **Interactive Menus** — Navigate the bot using Telegram keyboard buttons.

## Tech Stack

- **JavaScript**
- **Node.js**
- **Telegraf** — Telegram Bot API framework
- **SQLite** — Relational database
- **dotenv** — Environment variable management
- **Git & GitHub** — Version control

## Project Structure

```text
telegram-bot/
├── core/
│   ├── date.js
│   ├── db.js
│   ├── diffEngine.js
│   └── helpers.js
├── handlers/
│   ├── admin.js
│   ├── edit.js
│   ├── history.js
│   ├── start.js
│   ├── template.js
│   ├── textState.js
│   ├── view.js
│   └── workCakes.js
├── keyboards/
│   └── mainMenu.js
├── services/
│   ├── requestBuilder.js
│   └── workCakesBuilder.js
├── index.js
├── package.json
├── package-lock.json
└── README.md
```

*Note: The structure above highlights the main project files.*

## Development Setup

### Prerequisites

- Node.js
- npm
- A Telegram bot token from [@BotFather](https://t.me/BotFather)

### Installation

1. Clone the repository:

   ```bash
   git clone -b refactor-v2 https://github.com/Yig-or-Moroz/telegram-bot.git
   cd telegram-bot
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the project root:

   ```env
   BOT_TOKEN=your_telegram_bot_token
   ```

4. Start the bot:

   ```bash
   npm start
   ```

Keep your bot token private. Do not commit your `.env` file to GitHub.

## Database

The bot uses SQLite to store orders, templates, items, and production progress.

The database manages entities such as:

- **Places** — Bakery locations or order destinations.
- **Items** — Products included in orders.
- **Place Items** — Default template quantities for each location.
- **Days** — Dates associated with daily orders.
- **Day Items** — Date-specific order modifications.

The database schema is initialized by the application. However, a new database may not contain the existing bakery data. To preserve current orders and templates when deploying, ensure the correct SQLite database is available on the server.

## Deployment

The bot can run on a Node.js hosting service or VPS.

For deployment:

1. Install the project dependencies.
2. Configure `BOT_TOKEN` in the hosting environment.
3. Ensure the required SQLite database is present and stored persistently.
4. Start the application with `npm start`.
5. Run only one polling instance of the bot at a time.

## What I Learned

- Structuring a Node.js application into modules.
- Building Telegram bot interactions with Telegraf.
- Working with relational data in SQLite.
- Separating reusable order templates from date-specific changes.
- Implementing multi-step conversational workflows and keyboard navigation.
- Handling dates and business logic for daily production and delivery.
- Deploying a Node.js application with environment variables and persistent database storage.

## Author

**Ihor Moroz**

- GitHub: [Yig-or-Moroz](https://github.com/Yig-or-Moroz)
- Repository: [telegram-bot](https://github.com/Yig-or-Moroz/telegram-bot/tree/refactor-v2)
- Live Telegram Bot: [@ZARWKA_bot](https://t.me/ZARWKA_bot)
