require('dotenv/config');
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fileUpload = require('express-fileupload');

const app = express();
const port = process.env.PORT || 3000;
const secretKey = 'dkfnad_ajlbflqb3q83o';

const pool = new Pool({
	database: 'postgres',
	password: 'Amonov2004',
	user: 'postgres',
	host: 'localhost',
});

app.use(express.json());
app.use(fileUpload());

function authenticateToken(req, res, next) {
	const authHeader = req.headers['authorization'];
	const token = authHeader && authHeader.split(' ')[1];
	if (!token) return res.sendStatus(401);

	jwt.verify(token, secretKey, (err, user) => {
		if (err) return res.sendStatus(403);
		req.user = user;
		next();
	});
}

app.post('/register', async (req, res) => {
	try {
		const { username, email, password } = req.body;
		const hashedPassword = await bcrypt.hash(password, 10);
		console.log(req.body);

		const query =
			'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *';
		const result = await pool.query(query, [username, email, hashedPassword]);
		const user = result.rows[0];

		const token = jwt.sign(
			{ id: user.id, username: user.username },
			secretKey,
			{ expiresIn: '1d' }
		);

		res.json({ user, token });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

app.post('/login', async (req, res) => {
	try {
		const { username, password } = req.body;

		const query = 'SELECT * FROM users WHERE username = $1';
		const result = await pool.query(query, [username]);
		const user = result.rows[0];

		if (!user || !(await bcrypt.compare(password, user.password))) {
			return res.status(401).json({ error: 'Invalid credentials' });
		}

		const token = jwt.sign(
			{ id: user.id, username: user.username },
			secretKey,
			{ expiresIn: '1d' }
		);

		res.json({ user, token });
	} catch (error) {
		res.status(500).json({ error: 'Something went wrong!' });
	}
});

app.post('/categories', async (req, res) => {
	try {
		const { cat_name } = req.body;

		const query = 'INSERT INTO categories (cat_name) VALUES ($1) RETURNING *';
		const result = await pool.query(query, [cat_name]);
		res.json(result.rows[0]);
	} catch (error) {
		res.status(500).json({ error: 'Something went wrong!' });
	}
});

app.get('/categories', async (req, res) => {
	try {
		const query = 'SELECT * FROM categories';
		const result = await pool.query(query);
		res.json(result.rows);
	} catch (error) {
		res.status(500).json({ error: 'Something went wrong!' });
	}
});

app.post('/categories/:categoryId/sap_categories', async (req, res) => {
	try {
		const { categoryId } = req.params;
		// postmanda id ikki nuqtasiz yoziladi
		const { sap_name } = req.body;

		const categoryQuery = 'SELECT * FROM categories WHERE id = $1';
		const categoryResult = await pool.query(categoryQuery, [categoryId]);
		const category = categoryResult.rows[0];

		if (!category) {
			return res.status(404).json({ error: 'Category not found' });
		}

		const query =
			'INSERT INTO sap_categories (sap_name, cat_ref_id) VALUES ($1, $2) RETURNING *';
		const result = await pool.query(query, [sap_name, categoryId]);
		res.json(result.rows[0]);
	} catch (error) {
		res.status(500).json({ error: 'Something went wrong!' });
	}
});

app.get('/categories/:categoryId/sap_categories', async (req, res) => {
	try {
		const { categoryId } = req.params;
		const query = 'SELECT * FROM sap_categories WHERE cat_ref_id = $1';
		const result = await pool.query(query, [categoryId]);
		res.json(result.rows);
	} catch (error) {
		res.status(500).json({ error: 'Something went wrong!' });
	}
});

app.post('/sections/:sectionId/videos', authenticateToken, async (req, res) => {
	try {
		const { sectionId } = req.params;
		const { title, sap_category_id } = req.body;
		const userId = req.user.id;

		const sectionQuery = 'SELECT * FROM sap_categories WHERE id = $1';
		const sectionResult = await pool.query(sectionQuery, [sectionId]);
		const section = sectionResult.rows[0];

		if (!section) {
			return res.status(404).json({ error: 'Section not found' });
		}

		if (sap_category_id !== section.cat_ref_id.toString()) {
			return res.status(400).json({ error: 'Invalid sap_category_id' });
		}

		if (!req.files || !req.files.video) {
			return res.status(400).json({ error: 'Video file not uploaded' });
		}

		const video = req.files.video;

		const videoPath = `./uploads/videos/${video.name}`;

		video.mv(videoPath, async (error) => {
			if (error) {
				return res.status(500).json({ error: 'Failed to upload video' });
			}

			const query =
				'INSERT INTO videos (user_id, title, sap_category_id, link) VALUES ($1, $2, $3, $4) RETURNING *';
			const result = await pool.query(query, [
				userId,
				title,
				sap_category_id,
				videoPath,
			]);
			res.json(result.rows[0]);
		});
	} catch (error) {
		res.status(500).json({ error: 'Something went wrong!' });
	}
});

app.get('/sections/:sectionId/videos', async (req, res) => {
	try {
		const { sectionId } = req.params;
		const query = 'SELECT * FROM videos WHERE sap_category_id = $1';
		const result = await pool.query(query, [sectionId]);
		res.json(result.rows);
	} catch (error) {
		res.status(500).json({ error: 'Something went wrong!' });
	}
});

app.post('/videos/:videoId/comments', authenticateToken, async (req, res) => {
	try {
		const { videoId } = req.params;
		const { content } = req.body;
		const userId = req.user.id;

		const videoQuery = 'SELECT * FROM videos WHERE id = $1';
		const videoResult = await pool.query(videoQuery, [videoId]);
		const video = videoResult.rows[0];

		if (!video) {
			return res.status(404).json({ error: 'Video not found' });
		}

		const query =
			'INSERT INTO comments (user_id, video_id, content) VALUES ($1, $2, $3) RETURNING *';
		const result = await pool.query(query, [userId, videoId, content]);
		res.json(result.rows[0]);
	} catch (error) {
		res.status(500).json({ error: 'Something went wrong!' });
	}
});

app.get('/videos/:videoId/comments', async (req, res) => {
	try {
		const { videoId } = req.params;
		const query = 'SELECT * FROM comments WHERE video_id = $1';
		const result = await pool.query(query, [videoId]);
		res.json(result.rows);
	} catch (error) {
		res.status(500).json({ error: 'Something went wrong!' });
	}
});

// ... other routes ...

// Start the server
app.listen(port, () => {
	console.log(`Server running on http://localhost:${port}`);
});
