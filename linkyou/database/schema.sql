-- LinkYou Database Schema

CREATE DATABASE IF NOT EXISTS linkyou CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE linkyou;

-- Users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    telegram_id VARCHAR(255) UNIQUE,
    vk_id VARCHAR(255) UNIQUE,
    google_id VARCHAR(255) UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    avatar_url VARCHAR(500),
    gender ENUM('male', 'female', 'other') NOT NULL,
    birth_date DATE NOT NULL,
    age INT GENERATED ALWAYS AS (TIMESTAMPDIFF(YEAR, birth_date, CURDATE())) STORED,
    height DECIMAL(5,2), -- in cm
    weight DECIMAL(5,2), -- in kg
    body_type ENUM('slim', 'average', 'athletic', 'curvy', 'plus_size'),
    location_city VARCHAR(100),
    location_country VARCHAR(100),
    about_me TEXT,
    looking_for_gender ENUM('male', 'female', 'both'),
    looking_for_age_min INT DEFAULT 18,
    looking_for_age_max INT DEFAULT 99,
    is_admin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_gender (gender),
    INDEX idx_age (age),
    INDEX idx_location (location_city, location_country),
    INDEX idx_looking_for (looking_for_gender, looking_for_age_min, looking_for_age_max)
);

-- User photos gallery
CREATE TABLE user_photos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    photo_url VARCHAR(500) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    upload_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_primary (is_primary)
);

-- Likes/Matches system
CREATE TABLE likes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    liker_id INT NOT NULL,
    liked_id INT NOT NULL,
    status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (liker_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (liked_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_like (liker_id, liked_id),
    INDEX idx_liker (liker_id),
    INDEX idx_liked (liked_id),
    INDEX idx_status (status)
);

-- Messages/Chat system
CREATE TABLE conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user1_id INT NOT NULL,
    user2_id INT NOT NULL,
    last_message TEXT,
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_conversation (user1_id, user2_id),
    INDEX idx_user1 (user1_id),
    INDEX idx_user2 (user2_id)
);

CREATE TABLE messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    sender_id INT NOT NULL,
    message_text TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_conversation (conversation_id),
    INDEX idx_sender (sender_id),
    INDEX idx_created (created_at)
);

-- User interests/hobbies
CREATE TABLE interests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50)
);

CREATE TABLE user_interests (
    user_id INT NOT NULL,
    interest_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, interest_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (interest_id) REFERENCES interests(id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
);

-- Reports/Moderation
CREATE TABLE reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reporter_id INT NOT NULL,
    reported_user_id INT NOT NULL,
    reason TEXT NOT NULL,
    status ENUM('pending', 'reviewed', 'resolved') DEFAULT 'pending',
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    resolved_by INT,
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_reported (reported_user_id)
);

-- Activity logs for admin panel
CREATE TABLE activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user (user_id),
    INDEX idx_action (action),
    INDEX idx_created (created_at)
);

-- Insert some sample interests
INSERT INTO interests (name, category) VALUES 
('Путешествия', 'hobbies'),
('Спорт', 'hobbies'),
('Музыка', 'hobbies'),
('Кино', 'hobbies'),
('Чтение', 'hobbies'),
('Готовка', 'hobbies'),
('Искусство', 'hobbies'),
('Технологии', 'hobbies'),
('Природа', 'hobbies'),
('Фотография', 'hobbies');
