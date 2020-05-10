const Route = require('../../structures/Route');
const log = require('../../utils/Log');
const bcrypt = require('bcrypt');
const moment = require('moment');
const uuidv4 = require('uuid/v4');

class registerPOST extends Route {
	constructor() {
		super('/auth/register', 'post', { bypassAuth: true });
	}

	async run(req, res, db) {
		if (process.env.USER_ACCOUNTS === 'false') return res.status(401).json({ message: 'Creation of new accounts is currently disabled' });
		if (!req.body) return res.status(400).json({ message: 'No body provided' });
		const { username, regkey, password } = req.body;
		if (!username || !password) return res.status(401).json({ message: 'Invalid body provided' });

		if (username.length < 4 || username.length > 32) {
			return res.status(400).json({ message: 'Username must have 4-32 characters' });
		}
		if (password.length < 6 || password.length > 64) {
			return res.status(400).json({ message: 'Password must have 6-64 characters' });
		}

		/*
			Make sure the username doesn't exist yet
		*/
		const user = await db.table('users').where('username', username).first();
		if (user) return res.status(401).json({ message: 'Username already exists' });

		/*
			Make sure user has register key
		*/
		if (process.env.REGKEY !== regkey) return res.status(401).json({ message: 'Invalid registration key provided' });

		/*
			Hash the supplied password
		*/
		let hash;
		try {
			hash = await bcrypt.hash(password, 10);
		} catch (error) {
			log.error('Error generating password hash');
			log.error(error);
			return res.status(401).json({ message: 'There was a problem processing your account' });
		}

		/*
			Create the user
		*/
		const now = moment.utc().toDate();
		await db.table('users').insert({
			uuid: uuidv4(),
			username,
			password: hash,
			passwordEditedAt: now,
			createdAt: now,
			editedAt: now,
			enabled: true,
			isAdmin: false
		});
		return res.json({ message: 'The account was created successfully' });
	}
}

module.exports = registerPOST;
