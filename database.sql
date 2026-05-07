USE linkyou;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255),
    password VARCHAR(255),
    age INT,
    gender VARCHAR(50),
    city VARCHAR(255),
    preferences VARCHAR(255),
    bio TEXT,
    avatar VARCHAR(255),
    height INT,
    weight INT,
    role VARCHAR(50) DEFAULT 'user',
    banned INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT,
    receiver_id INT,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);