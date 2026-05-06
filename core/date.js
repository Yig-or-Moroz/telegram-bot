const { run, get, all } = require('./db');

function formatDateUA(dateStr) {
	const [y, m, d] = dateStr.split('-');
	return `${d}.${m}.${y}`;
}

async function getOrCreateDayByDate(dateStr) {

	// 💥 ЗАХИСТ ВІД СМІТТЯ
	if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
		throw new Error(`Invalid date passed to getOrCreateDayByDate: ${dateStr}`);
	}

	let day = await get(`SELECT * FROM days WHERE date = ?`, [dateStr]);
	if (day) return day;

	const r = await run(`INSERT INTO days (date) VALUES (?)`, [dateStr]);
	return { id: r.lastID, date: dateStr };
}

function getShiftedDate(shift) {
	const d = new Date();
	d.setDate(d.getDate() + shift);
	return d.toISOString().split('T')[0];
}

function getDbDayFromDate(dateStr) {
	const jsDay = new Date(dateStr).getDay();
	return jsDay === 0 ? 7 : jsDay;
}

module.exports = {
	formatDateUA,
	getOrCreateDayByDate,
	getShiftedDate,
	getDbDayFromDate
};