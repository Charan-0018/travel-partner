const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const session = require('express-session');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({ secret: 'secret', resave: false, saveUninitialized: true }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

// PostgreSQL pool instead of mysql2 connection
const pool = new Pool({
  host: process.env.PG_HOST,
  user: process.env.PG_USER,
  password: process.env.PG_PASS,
  database: process.env.PG_DB,
  port: process.env.PG_PORT || 5432
});

/* ===== AUTH ===== */
app.post('/signup', async (req, res) => {
  const { username, password, email, mobile, gender, language, dob, travel_styles, interests } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  pool.query(
    `INSERT INTO users (username, email, password, mobile, gender, language, dob, travel_styles, interests) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      username, email, hashed, mobile || null, gender || null, language || null,
      dob || null, JSON.stringify(travel_styles || []), JSON.stringify(interests || [])
    ],
    err => {
      if (err) return res.send(err);
      res.redirect('/login.html');
    }
  );
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  pool.query('SELECT * FROM users WHERE username = $1', [username], async (err, result) => {
    if (err) throw err;
    if (result.rows.length && await bcrypt.compare(password, result.rows[0].password)) {
      req.session.user = result.rows[0];
      res.redirect('/dashboard.html');
    } else {
      res.send('Invalid credentials');
    }
  });
});

app.get('/profile', (req, res) => {
  if (!req.session.user) return res.status(401).send('Not logged in');
  pool.query(
    `SELECT username, email, mobile, gender, language, dob, travel_styles, interests 
     FROM users WHERE id = $1`,
    [req.session.user.id],
    (err, result) => {
      if (err) throw err;
      if(result.rows[0]) {
        result.rows[0].travel_styles = JSON.parse(result.rows[0].travel_styles || '[]');
        result.rows[0].interests = JSON.parse(result.rows[0].interests || '[]');
      }
      res.json(result.rows[0]);
    }
  );
});

app.post('/profile', (req, res) => {
  if (!req.session.user) return res.status(401).send('Not logged in');
  const { username, email, mobile, gender, language, dob, travel_styles, interests } = req.body;
  pool.query(
    `UPDATE users SET username=$1, email=$2, mobile=$3, gender=$4, language=$5, dob=$6, travel_styles=$7, interests=$8 WHERE id=$9`,
    [username, email, mobile, gender, language, dob, JSON.stringify(travel_styles || []), JSON.stringify(interests || []), req.session.user.id],
    err => {
      if (err) throw err;
      res.send('Profile updated successfully');
    }
  );
});

/* ===== HOST A TRIP ===== */
app.post('/host', upload.single('image'), (req, res) => {
  if (!req.session.user) return res.redirect('/login.html');
  const { destination, vehicle, budget, start_date, end_date, preferences, description } = req.body;
  const image = req.file ? req.file.filename : null;
  pool.query(
    `INSERT INTO trips (host_id, destination, vehicle, budget, start_date, end_date, preferences, description, image) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [req.session.user.id, destination, vehicle, budget, start_date, end_date, preferences, description, image],
    err => { if (err) throw err; res.redirect('/dashboard.html'); }
  );
});

/* ===== AI TRAVEL COMPANION MATCHING ===== */
app.get('/travel-buddies', (req, res) => {
  if (!req.session.user) return res.status(401).send('Not logged in');
  pool.query('SELECT id, travel_styles, interests FROM users WHERE id = $1', [req.session.user.id], (err, userRes) => {
    if (err) throw err;
    if (!userRes.rows.length) return res.status(404).send('User not found');

    const currentUser = userRes.rows[0];
    const currentStyles = JSON.parse(currentUser.travel_styles || '[]');
    const currentInterests = JSON.parse(currentUser.interests || '[]');

    pool.query('SELECT id, username, travel_styles, interests FROM users WHERE id != $1', [req.session.user.id], (err2, result2) => {
      if (err2) throw err2;

      const similarityScores = result2.rows.map(u => {
        let score = 0;
        const uStyles = JSON.parse(u.travel_styles || '[]');
        const uInterests = JSON.parse(u.interests || '[]');

        score += currentStyles.filter(s => uStyles.includes(s)).length;
        score += currentInterests.filter(i => uInterests.includes(i)).length;

        return { ...u, score };
      });

      similarityScores.sort((a, b) => b.score - a.score);
      const topMatches = similarityScores.filter(u => u.score > 0).slice(0,20);
      res.json(topMatches);
    });
  });
});

/* ===== MY TRIPS ===== */
app.get('/my-trips', (req, res) => {
  if (!req.session.user) return res.status(401).send('Not logged in');
  const userId = req.session.user.id;
  const hostedTripsQuery = `
    SELECT trips.*, 'host' AS role, users.username
    FROM trips
    JOIN users ON users.id = trips.host_id
    WHERE trips.host_id = $1
  `;
  const joinedTripsQuery = `
    SELECT trips.*, 'participant' AS role, users.username 
    FROM trip_participants 
    JOIN trips ON trip_participants.trip_id = trips.id
    JOIN users ON users.id = trips.host_id
    WHERE trip_participants.user_id = $1 AND trips.host_id != $2
  `;
  pool.query(hostedTripsQuery, [userId], (err, hostedTrips) => {
    if (err) throw err;
    pool.query(joinedTripsQuery, [userId, userId], (err2, joinedTrips) => {
      if (err2) throw err2;
      res.json({ hosted: hostedTrips.rows, joined: joinedTrips.rows });
    });
  });
});

/* TRIPS SEARCH */
app.get('/trips', (req, res) => {
  let sql = `
    SELECT trips.*, users.username 
    FROM trips 
    JOIN users ON trips.host_id = users.id `;
  let wheres = [];
  let params = [];

  if (req.query.location) {
    wheres.push('LOWER(trips.destination) LIKE $1');
    params.push(`%${req.query.location.toLowerCase()}%`);
  }
  if (req.query.budget) {
    wheres.push(`trips.budget <= $${params.length + 1}`);
    params.push(Number(req.query.budget));
  }

  if (wheres.length) sql += " WHERE " + wheres.join(' AND ');
  sql += " ORDER BY created_at DESC";

  pool.query(sql, params, (err, result) => {
    if (err) throw err;
    res.json(result.rows);
  });
});

/* TRIP DETAILS */
app.get('/trip/:id', (req, res) => {
  pool.query(
    `SELECT trips.*, users.username AS host_username, users.mobile AS host_mobile
     FROM trips
     JOIN users ON trips.host_id = users.id
     WHERE trips.id=$1`,
    [req.params.id],
    (err, tripRows) => {
      if (err) throw err;
      if (!tripRows.rows.length) return res.status(404).send('Trip not found');

      const trip = tripRows.rows[0];
      pool.query(
        `SELECT users.id, users.username
         FROM trip_participants
         JOIN users ON trip_participants.user_id = users.id
         WHERE trip_participants.trip_id = $1`,
        [req.params.id],
        (err2, participants) => {
          if (err2) throw err2;
          trip.participants = [
            { id: trip.host_id, username: `${trip.host_username} (host)`, mobile: trip.host_mobile },
            ...participants.rows
          ];
          res.json(trip);
        }
      );
    }
  );
});

/* JOIN REQUESTS */
app.post('/trip/:id/request-join', (req, res) => {
  if (!req.session.user) return res.redirect('/login.html');
  const { message } = req.body;
  pool.query('SELECT host_id FROM trips WHERE id=$1', [req.params.id], (err, trips) => {
    if (err) throw err;
    if (!trips.rows.length) return res.status(404).send('Trip not found');
    const hostId = trips.rows[0].host_id;
    pool.query(
      'INSERT INTO trip_requests (trip_id, requester_id, host_id, message) VALUES ($1, $2, $3, $4)',
      [req.params.id, req.session.user.id, hostId, message],
      err2 => { if (err2) throw err2; res.send('Join request sent!'); }
    );
  });
});

app.get('/my-trip-requests', (req, res) => {
  if (!req.session.user) return res.redirect('/login.html');
  pool.query(
    `SELECT trip_requests.*, users.username AS requester_name, trips.destination
     FROM trip_requests
     JOIN users ON trip_requests.requester_id = users.id
     JOIN trips ON trip_requests.trip_id = trips.id
     WHERE trip_requests.host_id = $1 AND trip_requests.status = 'pending'`,
    [req.session.user.id],
    (err, result) => { if (err) throw err; res.json(result.rows); }
  );
});

app.post('/trip-requests/:id/:action', (req, res) => {
  const { id, action } = req.params;
  if (!['accepted', 'rejected'].includes(action)) return res.status(400).send('Invalid action');

  pool.query('SELECT * FROM trip_requests WHERE id=$1', [id], (err, requests) => {
    if (err) throw err;
    if (!requests.rows.length) return res.status(404).send('Request not found');

    const request = requests.rows[0];
    pool.query('UPDATE trip_requests SET status=$1 WHERE id=$2', [action, id], err2 => {
      if (err2) throw err2;
      if (action === 'accepted') {
        pool.query(
          'INSERT INTO trip_participants (trip_id, user_id) VALUES ($1, $2)',
          [request.trip_id, request.requester_id],
          err4 => { if (err4) throw err4; }
        );
        pool.query(
          'INSERT INTO chat_rooms (trip_id, user1_id, user2_id) VALUES ($1, $2, $3)',
          [request.trip_id, request.host_id, request.requester_id],
          err3 => {
            if (err3) throw err3;
            res.send('Request accepted, participant added, and chat room created');
          }
        );
      } else {
        res.send(`Request ${action}`);
      }
    });
  });
});

/* CHAT */
app.get('/chat-rooms', (req, res) => {
  if (!req.session.user) return res.status(401).send('Not logged in');
  const userId = req.session.user.id;
  pool.query(
    `SELECT chat_rooms.*, u1.username AS user1_name, u2.username AS user2_name, trips.destination
     FROM chat_rooms
     JOIN users u1 ON chat_rooms.user1_id = u1.id
     JOIN users u2 ON chat_rooms.user2_id = u2.id
     JOIN trips ON chat_rooms.trip_id = trips.id
     WHERE chat_rooms.user1_id = $1 OR chat_rooms.user2_id = $2`,
    [userId, userId],
    (err, result) => { if (err) throw err; res.json(result.rows); }
  );
});

app.get('/chat/:chatId/messages', (req, res) => {
  if (!req.session.user) return res.status(401).send('Not logged in');
  const { chatId } = req.params;
  const userId = req.session.user.id;

  pool.query(
    'SELECT * FROM chat_rooms WHERE id=$1 AND (user1_id=$2 OR user2_id=$3)',
    [chatId, userId, userId],
    (err, rooms) => {
      if (err) throw err;
      if (!rooms.rows.length) return res.status(403).send('Not allowed in this chat');

      pool.query(
        `SELECT messages.*, users.username AS sender_name 
         FROM messages 
         JOIN users ON messages.sender_id = users.id
         WHERE chat_id=$1 ORDER BY sent_at ASC`,
        [chatId],
        (err2, result2) => { if (err2) throw err2; res.json(result2.rows); }
      );
    }
  );
});

app.post('/chat/:chatId/message', (req, res) => {
  if (!req.session.user) return res.status(401).send('Not logged in');
  const { chatId } = req.params;
  const { message_text } = req.body;
  const senderId = req.session.user.id;

  pool.query(
    'SELECT * FROM chat_rooms WHERE id=$1 AND (user1_id=$2 OR user2_id=$3)',
    [chatId, senderId, senderId],
    (err, rooms) => {
      if (err) throw err;
      if (!rooms.rows.length) return res.status(403).send('Not allowed in this chat');

      pool.query(
        'INSERT INTO messages (chat_id, sender_id, message_text) VALUES ($1, $2, $3) RETURNING id',
        [chatId, senderId, message_text],
        (err2, result) => {
          if (err2) throw err2;
          io.to(`room-${chatId}`).emit('newMessage', {
            id: result.rows[0].id,
            chat_id: parseInt(chatId),
            sender_id: senderId,
            message_text,
            sent_at: new Date().toISOString()
          });
          res.send('Message sent');
        }
      );
    }
  );
});

/* USERS */
app.get('/users', (req, res) => {
  if (!req.session.user) return res.status(401).send('Not logged in');
  pool.query('SELECT id, username FROM users WHERE id != $1', [req.session.user.id], (err, result) => {
    if (err) throw err; res.json(result.rows);
  });
});

app.get('/', (req, res) => res.redirect('/login.html'));

/* SOCKET.IO */
io.on('connection', socket => {
  console.log('User connected:', socket.id);
  socket.on('joinRoom', roomId => {
    socket.join(`room-${roomId}`);
    console.log(`Socket ${socket.id} joined room-${roomId}`);
  });
  socket.on('disconnect', () => console.log('User disconnected:', socket.id));
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Server running on http://localhost:${port}`));
