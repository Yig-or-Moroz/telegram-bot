const db = require('./db');

db.serialize(() => {
	console.log('Cloning templates to all weekdays...');

	db.all(`
		SELECT pi.*, p.days_of_week
		FROM place_items pi
		JOIN places p ON p.id = pi.place_id
		WHERE pi.weekday = 1
	`, (err, rows) => {
		if (err) throw err;

		const stmt = db.prepare(`
			INSERT INTO place_items (place_id, item_id, weekday, default_quantity)
			VALUES (?, ?, ?, ?)
		`);

		for (const row of rows) {
			const days = row.days_of_week.split(',').map(d => d.trim());

			for (const d of days) {
				if (d == 1) continue; // понеділок вже є

				stmt.run(row.place_id, row.item_id, d, row.default_quantity);
			}
		}

		stmt.finalize(() => {
			console.log('Migration done ✅');
			process.exit(0);
		});
	});
});