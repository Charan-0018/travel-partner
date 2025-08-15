-- Create database
CREATE DATABASE IF NOT EXISTS travel_partner;
USE travel_partner;

-- =========================================
-- 1. USERS TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    avatar VARCHAR(255),
    bio TEXT,
    role ENUM('user','admin') DEFAULT 'user',
    language VARCHAR(20),
    gender VARCHAR(10),
    dob DATE
);

-- =========================================
-- 2. TRIPS TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS trips (
    id INT PRIMARY KEY AUTO_INCREMENT,
    host_id INT NOT NULL,
    destination VARCHAR(100) NOT NULL,
    vehicle VARCHAR(50),
    budget INT,
    start_date DATE,
    end_date DATE,
    preferences TEXT,
    description TEXT,
    image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =========================================
-- 3. TRIP_REQUESTS TABLE (with host_id)
-- =========================================
CREATE TABLE IF NOT EXISTS trip_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    trip_id INT NOT NULL,
    requester_id INT NOT NULL, -- user sending request
    host_id INT NOT NULL,      -- host of the trip
    status ENUM('pending','accepted','rejected') DEFAULT 'pending',
    message TEXT,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =========================================
-- 4. CHAT_ROOMS TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS chat_rooms (
    id INT PRIMARY KEY AUTO_INCREMENT,
    trip_id INT NOT NULL,
    user1_id INT NOT NULL,
    user2_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =========================================
-- 5. MESSAGES TABLE (linked to chat_rooms)
-- =========================================
CREATE TABLE IF NOT EXISTS messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    chat_id INT NOT NULL,
    sender_id INT NOT NULL,
    message_text TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =========================================
-- 6. REVIEWS TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS reviews (
    id INT PRIMARY KEY AUTO_INCREMENT,
    trip_id INT NOT NULL,
    reviewer_id INT NOT NULL,
    reviewee_id INT NOT NULL,
    rating INT CHECK(rating BETWEEN 1 AND 5),
    content TEXT,
    reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewee_id) REFERENCES users(id) ON DELETE CASCADE
);
