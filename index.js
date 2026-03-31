const db = require('./db');

db.run(
	"INSERT INTO test (name) VALUES (?)", 
	['Ihor'],

	function (err) {
		if (err) {
			console.error(err);
			return;
		} 


		db.all(`SELECT * FROM test`, [], (err, rows) => {
			console.log('Before update: ', rows );


			db.run('UPDATE test SET name = ? WHERE id = ?', 
				['Piter', this.lastID],
				function (err) {
				if (err) {
					console.error(err);
					return;
					}
					
					
					db.all(`SELECT * FROM test`, [], (err, rows) => {
						console.log('After update:', rows);
					});
				}
			);
		});
	}
);			