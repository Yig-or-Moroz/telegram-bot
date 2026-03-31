const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite');

db.serialize(() => {
	db.run(`
		CREATE TABLE IF NOT EXISTS days (
      	id INTEGER PRIMARY KEY AUTOINCREMENT,
      	name TEXT
		)
	`);

	db.run(`
		CREATE TABLE IF NOT EXISTS places (
      	id INTEGER PRIMARY KEY AUTOINCREMENT,
      	date TEXT
		)
	`);

	db.run(`
		CREATE TABLE IF NOT EXISTS items (
      	id INTEGER PRIMARY KEY AUTOINCREMENT,
      	place_id INTEGER,
			name TEXT,
			default_quantity INTEGER
		)
	`);

	db.run(`
		CREATE TABLE IF NOT EXISTS day_items (
      	id INTEGER PRIMARY KEY AUTOINCREMENT,
      	day_id INTEGER,
			item_id INTEGER,
			quantity INTEGER
		)
	`);

	db.run(`
		CREATE TABLE IF NOT EXISTS delivery (
      	id INTEGER PRIMARY KEY AUTOINCREMENT,
      	day_id INTEGER,
			name TEXT,
			comment TEXT
		)
	`);

});

module.exports = db;