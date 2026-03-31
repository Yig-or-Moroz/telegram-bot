const db = require('./db');

db.run(
	"INSERT INTO test (name) VALUES (?)", 
	['Ihor'],

	function (err) {
		if (err) {
			console.error(err);
		} else {
			console.log("Inserted row with id:" , this.lastID)
		}
	} 
);


db.all(`SELECT * FROM test`, [], (err, rows) => {
	console.log('All rows: ', rows );
});