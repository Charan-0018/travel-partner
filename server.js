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


// Multer setup for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });


const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });


const db = mysql.createConnection({
  host: 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: 'travel_partner'
});
db.connect(err => { if (err) throw err; console.log('Database connected.'); });


/* ===== AUTH ===== */
app.post('/signup', async (req, res) => {
  const { username, password, email, mobile, gender, language, dob, travel_styles, interests } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  db.query(
    `INSERT INTO users (username, email, password, mobile, gender, language, dob, travel_styles, interests) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [username, email, hashed, mobile || null, gender || null, language || null, dob || null, JSON.stringify(travel_styles || []), JSON.stringify(interests || [])],
    err => {
      if (err) return res.send(err);
      res.redirect('/login.html');
    }
  );
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
    if (err) throw err;
    if (results.length && await bcrypt.compare(password, results[0].password)) {
      req.session.user = results[0];
      res.redirect('/dashboard.html');
    } else {
      res.send('Invalid credentials');
    }
  });
});


app.get('/profile', (req, res) => {
  if (!req.session.user) return res.status(401).send('Not logged in');
  db.query(
    `SELECT username, email, mobile, gender, language, dob, travel_styles, interests 
     FROM users WHERE id = ?`,
    [req.session.user.id],
    (err, results) => {
      if (err) throw err;
      if(results[0]) {
        results[0].travel_styles = JSON.parse(results[0].travel_styles || '[]');
        results[0].interests = JSON.parse(results[0].interests || '[]');
      }
      res.json(results[0]);
    }
  );
});

app.post('/profile', (req, res) => {
  if (!req.session.user) return res.status(401).send('Not logged in');
  const { username, email, mobile, gender, language, dob, travel_styles, interests } = req.body;
  db.query(
    `UPDATE users SET username=?, email=?, mobile=?, gender=?, language=?, dob=?, travel_styles=?, interests=? WHERE id=?`,
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
  db.query(
    `INSERT INTO trips (host_id, destination, vehicle, budget, start_date, end_date, preferences, description, image) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.session.user.id, destination, vehicle, budget, start_date, end_date, preferences, description, image],
    err => { if (err) throw err; res.redirect('/dashboard.html'); }
  );
});


/* ===== AI TRAVEL COMPANION MATCHING ===== */
app.get('/travel-buddies', (req, res) => {
  if (!req.session.user) return res.status(401).send('Not logged in');
  db.query('SELECT id, travel_styles, interests FROM users WHERE id = ?', [req.session.user.id], (err, userRes) => {
    if (err) throw err;
    if (!userRes.length) return res.status(404).send('User not found');

    const currentUser = userRes[0];
    const currentStyles = JSON.parse(currentUser.travel_styles || '[]');
    const currentInterests = JSON.parse(currentUser.interests || '[]');

    db.query('SELECT id, username, travel_styles, interests FROM users WHERE id != ?', [req.session.user.id], (err2, users) => {
      if (err2) throw err2;

      const similarityScores = users.map(u => {
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
    WHERE trips.host_id = ?
  `;
  const joinedTripsQuery = `
    SELECT trips.*, 'participant' AS role, users.username 
    FROM trip_participants 
    JOIN trips ON trip_participants.trip_id = trips.id
    JOIN users ON users.id = trips.host_id
    WHERE trip_participants.user_id = ? AND trips.host_id != ?
  `;
  db.query(hostedTripsQuery, [userId], (err, hostedTrips) => {
    if (err) throw err;
    db.query(joinedTripsQuery, [userId, userId], (err2, joinedTrips) => {
      if (err2) throw err2;
      res.json({ hosted: hostedTrips, joined: joinedTrips });
    });
  });
});


/* TRIPS SEARCH */
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


/* TRIP DETAILS */
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


/* JOIN REQUESTS */
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


/* CHAT */
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


/* USERS */
app.get('/users', (req, res) => {
  if (!req.session.user) return res.status(401).send('Not logged in');
  db.query('SELECT id, username FROM users WHERE id != ?', [req.session.user.id], (err, users) => {
    if (err) throw err; res.json(users);
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

app.post('/trip-requests/:id/:action', (req, res) => {
  const { id, action } = req.params; // 'accepted' or 'rejected'
  if (!['accepted', 'rejected'].includes(action)) return res.status(400).send('Invalid action');

  // Use 'action' as status
  const status = action;

  db.query('SELECT * FROM trip_requests WHERE id = ?', [id], (err, requests) => {
    if (err) return res.status(500).send('Database error');
    if (requests.length === 0) return res.status(404).send('Request not found');

    const request = requests[0];

    db.query('SELECT trip_name FROM trips WHERE id = ?', [request.trip_id], (err, trips) => {
      if (err) return res.status(500).send('Database error');
      if (trips.length === 0) return res.status(404).send('Trip not found');

      const tripName = trips[0].trip_name;

      // Update request status
      db.query('UPDATE trip_requests SET status = ? WHERE id = ?', [status, id], err => {
        if (err) return res.status(500).send('Error updating request status');

        // Prepare notification message
        let notifyMsg = status === 'accepted' 
          ? `Your request to join the trip "${tripName}" was approved.` 
          : `Your request to join the trip "${tripName}" was rejected.`;

        // Insert notification for requester
        const insertNotifSql = 'INSERT INTO notifications (user_id, message) VALUES (?, ?)';
        db.query(insertNotifSql, [request.requester_id, notifyMsg], err => {
          if (err) return res.status(500).send('Error inserting notification');

          if (status === 'accepted') {
            // Also add user as participant and create chat room
            db.query(
              'INSERT INTO trip_participants (trip_id, user_id) VALUES (?, ?)',
              [request.trip_id, request.requester_id],
              err => {
                if (err) return res.status(500).send('Error adding participant');

                db.query(
                  'INSERT INTO chat_rooms (trip_id, user1_id, user2_id) VALUES (?, ?, ?)',
                  [request.trip_id, request.host_id, request.requester_id],
                  err => {
                    if (err) return res.status(500).send('Error creating chat room');
                    res.send('Request approved, participant added, notification sent, and chat room created');
                  }
                );
              }
            );
          } else {
            // If rejected, just send the notification response
            res.send(`Request rejected and notification sent.`);
          }
        });
      });
    });
  });
});

// Existing imports and setup omitted for brevity

// ... your existing routes and middleware

// Returns all matching travel buddies (already included in your code)
app.get('/travel-buddies', (req, res) => {
  if (!req.session.user) return res.status(401).send('Not logged in');
  db.query('SELECT id, travel_styles, interests FROM users WHERE id = ?', [req.session.user.id], (err, userRes) => {
    if (err) throw err;
    if (!userRes.length) return res.status(404).send('User not found');

    const currentUser = userRes[0];
    const currentStyles = JSON.parse(currentUser.travel_styles || '[]');
    const currentInterests = JSON.parse(currentUser.interests || '[]');

    db.query('SELECT id, username, travel_styles, interests FROM users WHERE id != ?', [req.session.user.id], (err2, users) => {
      if (err2) throw err2;

      const similarityScores = users.map(u => {
        let score = 0;
        const uStyles = JSON.parse(u.travel_styles || '[]');
        const uInterests = JSON.parse(u.interests || '[]');

        score += currentStyles.filter(s => uStyles.includes(s)).length;
        score += currentInterests.filter(i => uInterests.includes(i)).length;

        return { ...u, score };
      });

      similarityScores.sort((a, b) => b.score - a.score);
      const topMatches = similarityScores.filter(u => u.score > 0);  // returns all matches, no slice()
      res.json(topMatches);
    });
  });
});

// New route to fetch trips by a specific host user:
app.get('/trips-by-host/:hostId', (req, res) => {
  const hostId = parseInt(req.params.hostId, 10);
  if (isNaN(hostId)) return res.status(400).send('Invalid host ID');

  db.query(
    `SELECT * FROM trips WHERE host_id = ? ORDER BY created_at DESC`,
    [hostId],
    (err, results) => {
      if (err) return res.status(500).send('Database error');
      res.json(results);
    }
  );
});

// ... your existing app.listen or server.listen calls

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Server running on http://localhost:${port}`));

