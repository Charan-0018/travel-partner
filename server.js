const express = require('express');
const mysql = require('mysql2');
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

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

// DB connect
const db = mysql.createConnection({
  host: 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: 'travel_partner'
});
db.connect(err => { if (err) throw err; console.log('Database connected.'); });

/* ====================== AUTH ====================== */
app.post('/signup', async (req, res) => {
  const { username, password, email, mobile, gender, language, dob } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  db.query(
    'INSERT INTO users (username, email, password, mobile, gender, language, dob) VALUES (?,?,?,?,?,?,?)',
    [username, email, hashed, mobile || null, gender || null, language || null, dob || null],
    err => {
      if (err) return res.send(err);
      res.redirect('/login.html');
    }
  );
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.query('SELECT * FROM users WHERE username=?', [username], async (err, results) => {
    if (err) throw err;
    if (results.length && await bcrypt.compare(password, results[0].password)) {
      req.session.user = results[0];
      res.redirect('/dashboard.html');
    } else {
      res.send('Invalid credentials');
    }
  });
});

app.get('/me', (req, res) => {
  if (!req.session.user) return res.json(null);
  res.json({ id: req.session.user.id, username: req.session.user.username });
});

/* ====================== PROFILE ====================== */
app.get('/profile', (req, res) => {
  if (!req.session.user) return res.status(401).send('Not logged in');
  db.query(
    'SELECT username, email, mobile, gender, language, dob FROM users WHERE id = ?',
    [req.session.user.id],
    (err, results) => {
      if (err) throw err;
      res.json(results[0]);
    }
  );
});

app.post('/profile', (req, res) => {
  if (!req.session.user) return res.status(401).send('Not logged in');
  const { username, email, mobile, gender, language, dob } = req.body;
  db.query(
    `UPDATE users 
     SET username=?, email=?, mobile=?, gender=?, language=?, dob=? 
     WHERE id=?`,
    [username, email, mobile, gender, language, dob, req.session.user.id],
    err => {
      if (err) throw err;
      res.send('Profile updated successfully');
    }
  );
});

/* ====================== HOST A TRIP ====================== */
app.post('/host', upload.single('image'), (req, res) => {
  if (!req.session.user) return res.redirect('/login.html');
  const { destination, vehicle, budget, start_date, end_date, preferences, description } = req.body;
  const image = req.file ? req.file.filename : null;
  db.query(
    `INSERT INTO trips (host_id, destination, vehicle, budget, start_date, end_date, preferences, description, image) 
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [req.session.user.id, destination, vehicle, budget, start_date, end_date, preferences, description, image],
    err => { if (err) throw err; res.redirect('/dashboard.html'); }
  );
});

/* ====================== AI-LIKE SEARCH ====================== */
app.get('/trips', (req, res) => {
  let sql = `SELECT trips.*, users.username 
             FROM trips 
             JOIN users ON trips.host_id = users.id `;
  let wheres = [];
  let params = [];

  if (req.query.location) {
    wheres.push('LOWER(trips.destination) LIKE ?');
    params.push(`%${req.query.location.toLowerCase()}%`);
  }
  if (req.query.budget) {
    wheres.push('trips.budget <= ?');
    params.push(Number(req.query.budget));
  }

  if (wheres.length) sql += " WHERE " + wheres.join(' AND ');
  sql += " ORDER BY created_at DESC";

  db.query(sql, params, (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});

/* ====================== TRIP DETAILS ====================== */
app.get('/trip/:id', (req, res) => {
  db.query(`
    SELECT trips.*, users.username AS host_username, users.mobile AS host_mobile
    FROM trips
    JOIN users ON trips.host_id = users.id
    WHERE trips.id=?`,
    [req.params.id],
    (err, tripRows) => {
      if (err) throw err;
      if (!tripRows.length) return res.status(404).send('Trip not found');

      const trip = tripRows[0];
      db.query(
        `SELECT users.id, users.username
         FROM trip_participants
         JOIN users ON trip_participants.user_id = users.id
         WHERE trip_participants.trip_id = ?`,
        [req.params.id],
        (err2, participants) => {
          if (err2) throw err2;
          trip.participants = [
            { id: trip.host_id, username: `${trip.host_username} (host)`, mobile: trip.host_mobile },
            ...participants
          ];
          res.json(trip);
        }
      );
    }
  );
});

/* ====================== JOIN REQUESTS ====================== */
app.post('/trip/:id/request-join', (req, res) => {
  if (!req.session.user) return res.redirect('/login.html');
  const { message } = req.body;
  db.query('SELECT host_id FROM trips WHERE id=?', [req.params.id], (err, trips) => {
    if (err) throw err;
    if (!trips.length) return res.status(404).send('Trip not found');
    const hostId = trips[0].host_id;
    db.query(
      'INSERT INTO trip_requests (trip_id, requester_id, host_id, message) VALUES (?,?,?,?)',
      [req.params.id, req.session.user.id, hostId, message],
      err2 => { if (err2) throw err2; res.send('Join request sent!'); }
    );
  });
});

app.get('/my-trip-requests', (req, res) => {
  if (!req.session.user) return res.redirect('/login.html');
  db.query(
    `SELECT trip_requests.*, users.username AS requester_name, trips.destination
     FROM trip_requests
     JOIN users ON trip_requests.requester_id = users.id
     JOIN trips ON trip_requests.trip_id = trips.id
     WHERE trip_requests.host_id = ? AND trip_requests.status = 'pending'`,
    [req.session.user.id],
    (err, results) => { if (err) throw err; res.json(results); }
  );
});

app.post('/trip-requests/:id/:action', (req, res) => {
  const { id, action } = req.params;
  if (!['accepted', 'rejected'].includes(action)) return res.status(400).send('Invalid action');

  db.query('SELECT * FROM trip_requests WHERE id=?', [id], (err, requests) => {
    if (err) throw err;
    if (!requests.length) return res.status(404).send('Request not found');

    const request = requests[0];
    db.query('UPDATE trip_requests SET status=? WHERE id=?', [action, id], err2 => {
      if (err2) throw err2;
      if (action === 'accepted') {
        db.query(
          'INSERT INTO trip_participants (trip_id, user_id) VALUES (?, ?)',
          [request.trip_id, request.requester_id],
          err4 => { if (err4) throw err4; }
        );
        db.query(
          'INSERT INTO chat_rooms (trip_id, user1_id, user2_id) VALUES (?,?,?)',
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

/* ====================== CHAT ====================== */
app.get('/chat-rooms', (req, res) => {
  if (!req.session.user) return res.status(401).send('Not logged in');
  const userId = req.session.user.id;
  db.query(
    `SELECT chat_rooms.*, u1.username AS user1_name, u2.username AS user2_name, trips.destination
     FROM chat_rooms
     JOIN users u1 ON chat_rooms.user1_id = u1.id
     JOIN users u2 ON chat_rooms.user2_id = u2.id
     JOIN trips ON chat_rooms.trip_id = trips.id
     WHERE chat_rooms.user1_id = ? OR chat_rooms.user2_id = ?`,
    [userId, userId],
    (err, results) => { if (err) throw err; res.json(results); }
  );
});

app.get('/chat/:chatId/messages', (req, res) => {
  if (!req.session.user) return res.status(401).send('Not logged in');
  const { chatId } = req.params;
  const userId = req.session.user.id;

  db.query(
    'SELECT * FROM chat_rooms WHERE id=? AND (user1_id=? OR user2_id=?)',
    [chatId, userId, userId],
    (err, rooms) => {
      if (err) throw err;
      if (!rooms.length) return res.status(403).send('Not allowed in this chat');

      db.query(
        `SELECT messages.*, users.username AS sender_name 
         FROM messages 
         JOIN users ON messages.sender_id = users.id
         WHERE chat_id=? ORDER BY sent_at ASC`,
        [chatId],
        (err2, results) => { if (err2) throw err2; res.json(results); }
      );
    }
  );
});

app.post('/chat/:chatId/message', (req, res) => {
  if (!req.session.user) return res.status(401).send('Not logged in');
  const { chatId } = req.params;
  const { message_text } = req.body;
  const senderId = req.session.user.id;

  db.query(
    'SELECT * FROM chat_rooms WHERE id=? AND (user1_id=? OR user2_id=?)',
    [chatId, senderId, senderId],
    (err, rooms) => {
      if (err) throw err;
      if (!rooms.length) return res.status(403).send('Not allowed in this chat');

      db.query(
        'INSERT INTO messages (chat_id, sender_id, message_text) VALUES (?,?,?)',
        [chatId, senderId, message_text],
        (err2, result) => {
          if (err2) throw err2;
          io.to(`room-${chatId}`).emit('newMessage', {
            id: result.insertId,
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

/* ====================== USERS ====================== */
app.get('/users', (req, res) => {
  if (!req.session.user) return res.status(401).send('Not logged in');
  db.query('SELECT id, username FROM users WHERE id != ?', [req.session.user.id], (err, users) => {
    if (err) throw err; res.json(users);
  });
});

app.get('/', (req, res) => res.redirect('/login.html'));

/* ====================== SOCKET.IO ====================== */
io.on('connection', socket => {
  console.log('User connected:', socket.id);
  socket.on('joinRoom', roomId => {
    socket.join(`room-${roomId}`);
    console.log(`Socket ${socket.id} joined room-${roomId}`);
  });
  socket.on('disconnect', () => console.log('User disconnected:', socket.id));
});

server.listen(3000, () => console.log('Server running on http://localhost:3000'));
