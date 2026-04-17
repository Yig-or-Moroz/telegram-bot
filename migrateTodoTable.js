const db = require('./db');

db.serialize(() => {
	console.log('Migrating day_item_progress...');

	db.run(`DROP TABLE IF EXISTS day_item_progress`);

	db.run(`
		CREATE TABLE day_item_progress (
			day_id INTEGER NOT NULL,
			item_id INTEGER NOT NULL,
			done INTEGER NOT NULL DEFAULT 0,
			PRIMARY KEY (day_id, item_id),
			FOREIGN KEY(day_id) REFERENCES days(id),
			FOREIGN KEY(item_id) REFERENCES items(id)
		)
	`, () => {
		console.log('Migration completed ✅');
		process.exit(0);
	});
});