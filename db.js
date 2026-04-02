const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite');

db.serialize(() => {

	db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE
    )
  `);

	db.run(`
    CREATE TABLE IF NOT EXISTS places (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE
    )
  `);

	// ГОЛОВНА ТАБЛИЦЯ ЗВʼЯЗКУ
	db.run(`
    CREATE TABLE IF NOT EXISTS place_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      place_id INTEGER,
      item_id INTEGER,
      days_of_week TEXT,
      UNIQUE(place_id, item_id)
    )
  `);

	db.run(`
    CREATE TABLE IF NOT EXISTS days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE
    )
  `);

	db.run(`
    CREATE TABLE IF NOT EXISTS day_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_id INTEGER,
      place_item_id INTEGER,
      quantity INTEGER,
      comment TEXT
    )
  `);

});

module.exports = db;