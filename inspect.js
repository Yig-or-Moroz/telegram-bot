const db = require('./db');

function showTable(name) {
  db.all(`SELECT * FROM ${name}`, [], (err, rows) => {
    if (err) {
      console.log(`❌ Error reading ${name}:`, err.message);
    } else {
      console.log(`\n========== TABLE: ${name} ==========`);
      console.table(rows);
    }
  });
}

const tables = ['days', 'places', 'items', 'day_items', 'place_items', 'day_item_progress'];

tables.forEach(showTable);