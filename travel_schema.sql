-- Run this part separately, as PostgreSQL doesn't use IF NOT EXISTS with USE.
CREATE DATABASE travel_partner;

-- Switch to your database in admin tools or use \c travel_partner in psql.

-- =========================================
-- 1. USERS TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    avatar VARCHAR(255),
    bio TEXT,
    role VARCHAR(10) DEFAULT 'user', -- ENUM replaced with VARCHAR
    language VARCHAR(20),
    gender VARCHAR(10),
    dob DATE,
    travel_styles TEXT,
    interests TEXT
);

-- =========================================
-- 2. TRIPS TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS trips (
    id SERIAL PRIMARY KEY,
    host_id INTEGER NOT NULL,
    destination VARCHAR(100) NOT NULL,
    vehicle VARCHAR(50),
    budget INTEGER,
    start_date DATE,
    end_date DATE,
    preferences TEXT,
    description TEXT,
    image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =========================================
-- 3. TRIP_REQUESTS TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS trip_requests (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER NOT NULL,
    requester_id INTEGER NOT NULL,
    host_id INTEGER NOT NULL,
    status VARCHAR(10) DEFAULT 'pending', -- ENUM replaced with VARCHAR
    message TEXT,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =========================================
-- 4. TRIP_PARTICIPANTS TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS trip_participants (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =========================================
-- 5. CHAT_ROOMS TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS chat_rooms (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER NOT NULL,
    user1_id INTEGER NOT NULL,
    user2_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =========================================
-- 6. MESSAGES TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    message_text TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =========================================
-- 7. REVIEWS TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER NOT NULL,
    reviewer_id INTEGER NOT NULL,
    reviewee_id INTEGER NOT NULL,
    rating INTEGER CHECK(rating BETWEEN 1 AND 5),
    content TEXT,
    reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewee_id) REFERENCES users(id) ON DELETE CASCADE
);
