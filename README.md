# Bakery Order Management Bot

A Telegram bot for managing daily bakery orders and coordinating cake production tasks. It helps organize recurring orders, customize daily requests, track delivery dates, and manage production progress directly through Telegram.

## Features

- **Daily order management** — view and edit daily orders for different locations.
- **Reusable templates** — manage default order templates to simplify recurring workflows.
- **Custom order items** — add, remove, or adjust items for a specific day's request.
- **Order history** — access previous daily requests.
- **Cake production overview** — view cakes that need to be prepared, grouped by item, with quantities and custom-order comments.
- **Delivery scheduling** — manage delivery orders by date, including item quantities and comments.
- **Daily to-do list** — track production progress for the day's tasks.
- **Interactive Telegram menus** — navigate the bot using reply keyboards and buttons.

## Tech Stack

- **Node.js** — JavaScript runtime
- **Telegraf** — Telegram Bot API framework
- **SQLite** — local relational database
- **dotenv** — environment variable configuration

## Architecture

The project uses a modular structure to separate Telegram handlers, business logic, database operations, and keyboard layouts.

Key components include:

- `handlers/` — handles user interactions and bot actions.
- `services/` — builds order and production summaries.
- `keyboards/` — defines Telegram reply keyboards.
- `core/` — shared utilities, date handling, database access, and order-diff logic.

This structure makes the code easier to maintain and extend as new workflows are added.

## Getting Started

### Prerequisites

- Node.js and npm
- A Telegram bot token from [@BotFather](https://t.me/BotFather)


## Database

The bot uses SQLite to store order templates, daily requests, and related production data. This allows the application to manage recurring orders and daily changes without requiring a separate database server.

## What I Learned

- Structuring a Node.js application into separate modules.
- Handling interactive Telegram workflows and multi-step user input.
- Designing relational data models with SQLite.
- Separating reusable order templates from day-specific changes.
- Managing date-based workflows and production progress.
- Building a practical automation tool around a real-world process.

## Author

**Ihor Moroz**

- [GitHub Profile](https://github.com/Yig-or-Moroz)
- [Repository](https://github.com/Yig-or-Moroz/telegram-bot)