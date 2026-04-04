const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

db.serialize(() => {
	// Таблиця місць
	db.run(`
    CREATE TABLE IF NOT EXISTS places (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    )
  `);

	// Таблиця позицій
	db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )
  `);

	// Таблиця зв’язку місце ↔ позиція з днями і стартовою кількістю
	db.run(`
    CREATE TABLE IF NOT EXISTS place_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      place_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      days_of_week TEXT NOT NULL,
      default_quantity INTEGER NOT NULL DEFAULT 1,
      UNIQUE(place_id, item_id),
      FOREIGN KEY(place_id) REFERENCES places(id),
      FOREIGN KEY(item_id) REFERENCES items(id)
    )
  `);

	// Таблиця днів
	db.run(`
    CREATE TABLE IF NOT EXISTS days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL
    )
  `);

	// Таблиця заявки дня
	db.run(`
    CREATE TABLE IF NOT EXISTS day_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_id INTEGER NOT NULL,
      place_item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      comment TEXT,
      FOREIGN KEY(day_id) REFERENCES days(id),
      FOREIGN KEY(place_item_id) REFERENCES place_items(id)
    )
  `);
});

module.exports = db;