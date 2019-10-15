const Route = require('../../structures/Route');
const path = require('path');
const Util = require('../../utils/Util');
const jetpack = require('fs-jetpack');
const multer = require('multer');
const moment = require('moment');
const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: parseInt(process.env.MAX_SIZE, 10) * (1000 * 1000),
		files: 1
	},
	fileFilter: (req, file, cb) => {
		/*
		if (options.blacklist.mimes.includes(file.mimetype)) {
			return cb(new Error(`${file.mimetype} is a blacklisted filetype.`));
		} else if (options.blacklist.extensions.some(ext => path.extname(file.originalname).toLowerCase() === ext)) {
			return cb(new Error(`${path.extname(file.originalname).toLowerCase()} is a blacklisted extension.`));
		}
		*/
		return cb(null, true);
	}
}).array('files[]');

class uploadPOST extends Route {
	constructor() {
		super('/upload', 'post', { bypassAuth: true });
	}

	async run(req, res, db) {
		const user = await Util.isAuthorized(req);
		if (!user && process.env.PUBLIC_MODE == 'false') return res.status(401).json({ message: 'Not authorized to use this resource' });

		const albumId = req.body.albumid || req.headers.albumid;
		if (albumId && !user) return res.status(401).json({ message: 'Only registered users can upload files to an album' });
		if (albumId && user) {
			const album = await db.table('albums').where({ id: albumId, userId: user.id }).first();
			if (!album) return res.status(401).json({ message: 'Album doesn\'t exist or it doesn\'t belong to the user' });
		}

		return upload(req, res, async err => {
			if (err) console.error(err.message);

			let uploadedFile = {};
			let insertedId;

			const remappedKeys = this._remapKeys(req.body);
			const file = req.files[0];

			const ext = path.extname(file.originalname);
			const hash = Util.generateFileHash(file.buffer);

			const filename = Util.getUniqueFilename(file.originalname);

			/*
				First let's get the hash of the file. This will be useful to check if the file
				has already been upload by either the user or an anonymous user.
				In case this is true, instead of uploading it again we retrieve the url
				of the file that is already saved and thus don't store extra copies of the same file.

				For this we need to wait until we have a filename so that we can delete the uploaded file.
			*/
			const exists = await this.checkIfFileExists(db, user, hash);
			if (exists) return this.fileExists(res, exists, filename);

			if (remappedKeys && remappedKeys.uuid) {
				const chunkOutput = path.join(__dirname,
					'..',
					'..',
					'..',
					'..',
					process.env.UPLOAD_FOLDER,
					'chunks',
					remappedKeys.uuid,
					`${remappedKeys.chunkindex.padStart(3, 0)}${ext || ''}`);
				await jetpack.writeAsync(chunkOutput, file.buffer);
			} else {
				const output = path.join(__dirname,
					'..',
					'..',
					'..',
					'..',
					process.env.UPLOAD_FOLDER,
					filename);
				await jetpack.writeAsync(output, file.buffer);
				uploadedFile = {
					name: filename,
					hash,
					size: file.buffer.length,
					url: filename
				};
			}

			if (!remappedKeys || !remappedKeys.uuid) {
				Util.generateThumbnails(uploadedFile.name);
				insertedId = await this.saveFileToDatabase(req, res, user, db, uploadedFile, file);
				if (!insertedId) return res.status(500).json({ message: 'There was an error saving the file.' });
				uploadedFile.deleteUrl = `${process.env.DOMAIN}/api/file/${insertedId[0]}`;

				/*
					If the upload had an album specified we make sure to create the relation
					and update the according timestamps..
				*/
				this.saveFileToAlbum(db, albumId, insertedId);
			}

			return res.status(201).send({
				message: 'Sucessfully uploaded the file.',
				...uploadedFile
			});
		});
	}

	fileExists(res, exists, filename) {
		res.json({
			message: 'Successfully uploaded the file.',
			name: exists.name,
			hash: exists.hash,
			size: exists.size,
			url: `${process.env.DOMAIN}/${exists.name}`,
			deleteUrl: `${process.env.DOMAIN}/api/file/${exists.id}`,
			repeated: true
		});

		return Util.deleteFile(filename);
	}

	async checkIfFileExists(db, user, hash) {
		const exists = await db.table('files')
			.where(function() { // eslint-disable-line func-names
				if (user) this.where('userId', user.id);
				else this.whereNull('userId');
			})
			.where({ hash })
			.first();
		return exists;
	}

	async saveFileToAlbum(db, albumId, insertedId) {
		if (!albumId) return;

		const now = moment.utc().toDate();
		try {
			await db.table('albumsFiles').insert({ albumId, fileId: insertedId[0] });
			await db.table('albums').where('id', albumId).update('editedAt', now);
		} catch (error) {
			console.error(error);
		}
	}

	async saveFileToDatabase(req, res, user, db, file, originalFile) {
		/*
			Save the upload information to the database
		*/
		const now = moment.utc().toDate();
		let insertedId = null;
		try {
			/*
				This is so fucking dumb
			*/
			if (process.env.DB_CLIENT === 'sqlite3') {
				insertedId = await db.table('files').insert({
					userId: user ? user.id : null,
					name: file.name,
					original: originalFile.originalname,
					type: originalFile.mimetype || '',
					size: file.size,
					hash: file.hash,
					ip: req.ip,
					createdAt: now,
					editedAt: now
				});
			} else {
				insertedId = await db.table('files').insert({
					userId: user ? user.id : null,
					name: file.name,
					original: originalFile.originalname,
					type: originalFile.mimetype || '',
					size: file.size,
					hash: file.hash,
					ip: req.ip,
					createdAt: now,
					editedAt: now
				}, 'id');
			}
			return insertedId;
		} catch (error) {
			console.error('There was an error saving the file to the database');
			console.error(error);
			return null;
			// return res.status(500).json({ message: 'There was an error uploading the file.' });
		}
	}

	_remapKeys(body) {
		const keys = Object.keys(body);
		if (keys.length) {
			for (const key of keys) {
				if (!/^dz/.test(key)) continue;
				body[key.replace(/^dz/, '')] = body[key];
				delete body[key];
			}
			return body;
		}
	}
}

module.exports = uploadPOST;
