const { run, get, all } = require('./db');

function getTargetDateInfo() {
	const today = new Date();
	const d = today.getDay();

	let target = new Date(today);

	if (d === 6) target.setDate(today.getDate() + 2); // субота
	else if (d === 0) target.setDate(today.getDate() + 1); // неділя
	else target.setDate(today.getDate() + 1);

	const targetDay = target.getDay() === 0 ? 7 : target.getDay();
	const targetDate = target.toISOString().split('T')[0];

	return { targetDate, targetDay };
}

async function getOrCreateTargetDay() {
	const { targetDate } = getTargetDateInfo();
	let day = await get(`SELECT * FROM days WHERE date = ?`, [targetDate]);
	if (day) return day;
	const r = await run(`INSERT INTO days (date) VALUES (?)`, [targetDate]);
	return { id: r.lastID, date: targetDate };
}

function formatDateUA(dateStr) {
	const [y, m, d] = dateStr.split('-');
	return `${d}.${m}.${y}`;
}

async function getOrCreateDayByDate(dateStr) {
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
	getTargetDateInfo,
	getOrCreateTargetDay,
	formatDateUA,
	getOrCreateDayByDate,
	getShiftedDate,
	getDbDayFromDate
};