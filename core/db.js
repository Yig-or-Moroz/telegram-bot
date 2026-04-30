const db = require('../db');

const run = (sql, p = []) =>
	new Promise((res, rej) => db.run(sql, p, function (e) { e ? rej(e) : res(this); }));

const get = (sql, p = []) =>
	new Promise((res, rej) => db.get(sql, p, (e, r) => e ? rej(e) : res(r)));

const all = (sql, p = []) =>
	new Promise((res, rej) => db.all(sql, p, (e, r) => e ? rej(e) : res(r)));

module.exports = { run, get, all };