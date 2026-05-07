const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const database = require('../config/database');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../public/images/uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'user-' + req.userId + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// In-memory storage for fallback mode
const profilesMemory = new Map();
const searchesMemory = [];

// Middleware to verify token (import from auth)
const verifyToken = (req, res, next) => {
    const jwt = require('jsonwebtoken');
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        req.userId = decoded.id;
        req.isAdmin = decoded.is_admin;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// Get user profiles with filters
router.get('/search', verifyToken, async (req, res) => {
    try {
        const { 
            gender, 
            lookingForGender, 
            ageMin, 
            ageMax, 
            bodyType, 
            location,
            page = 1,
            limit = 20 
        } = req.query;

        if (database.pool) {
            let query = 'SELECT * FROM users WHERE is_active = TRUE AND id != ?';
            const params = [req.userId];

            if (gender) {
                query += ' AND gender = ?';
                params.push(gender);
            }

            if (lookingForGender) {
                query += ' AND (looking_for_gender = ? OR looking_for_gender = "both")';
                params.push(lookingForGender);
            }

            if (ageMin) {
                query += ' AND age >= ?';
                params.push(parseInt(ageMin));
            }

            if (ageMax) {
                query += ' AND age <= ?';
                params.push(parseInt(ageMax));
            }

            if (bodyType) {
                query += ' AND body_type = ?';
                params.push(bodyType);
            }

            if (location) {
                query += ' AND (location_city LIKE ? OR location_country LIKE ?)';
                params.push(`%${location}%`, `%${location}%`);
            }

            const offset = (page - 1) * limit;
            query += ' LIMIT ? OFFSET ?';
            params.push(parseInt(limit), offset);

            const users = await database.query(query, params);
            
            // Get photo count for each user
            for (let user of users) {
                const [photos] = await database.query(
                    'SELECT photo_url FROM user_photos WHERE user_id = ? AND is_primary = TRUE LIMIT 1',
                    [user.id]
                );
                user.avatar_url = photos.length > 0 ? photos[0].photo_url : user.avatar_url;
            }

            res.json({ users, total: users.length });
        } else {
            // Fallback mode - generate some sample users
            let users = Array.from(profilesMemory.values()).filter(u => u.id !== req.userId);
            
            if (gender) {
                users = users.filter(u => u.gender === gender);
            }
            
            if (lookingForGender) {
                users = users.filter(u => u.looking_for_gender === lookingForGender || u.looking_for_gender === 'both');
            }
            
            if (ageMin) {
                users = users.filter(u => {
                    const age = new Date().getFullYear() - new Date(u.birth_date).getFullYear();
                    return age >= parseInt(ageMin);
                });
            }
            
            if (ageMax) {
                users = users.filter(u => {
                    const age = new Date().getFullYear() - new Date(u.birth_date).getFullYear();
                    return age <= parseInt(ageMax);
                });
            }

            const start = (page - 1) * limit;
            const end = start + parseInt(limit);
            res.json({ users: users.slice(start, end), total: users.length });
        }
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Get user profile by ID
router.get('/:id', verifyToken, async (req, res) => {
    try {
        if (database.pool) {
            const [users] = await database.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
            if (users.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            const user = users[0];
            
            // Get user photos
            const [photos] = await database.query(
                'SELECT photo_url, is_primary FROM user_photos WHERE user_id = ? ORDER BY is_primary DESC, upload_order ASC',
                [user.id]
            );
            user.photos = photos;
            
            // Get user interests
            const [interests] = await database.query(
                `SELECT i.name, i.category FROM interests i 
                 JOIN user_interests ui ON i.id = ui.interest_id 
                 WHERE ui.user_id = ?`,
                [user.id]
            );
            user.interests = interests;
            
            res.json({ user });
        } else {
            const user = profilesMemory.get(parseInt(req.params.id));
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            res.json({ user });
        }
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// Update user profile
router.put('/profile', verifyToken, async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            gender,
            birthDate,
            height,
            weight,
            bodyType,
            locationCity,
            locationCountry,
            aboutMe,
            lookingForGender,
            lookingForAgeMin,
            lookingForAgeMax
        } = req.body;

        if (database.pool) {
            await database.query(
                `UPDATE users SET 
                    first_name = ?, last_name = ?, gender = ?, birth_date = ?,
                    height = ?, weight = ?, body_type = ?,
                    location_city = ?, location_country = ?, about_me = ?,
                    looking_for_gender = ?, looking_for_age_min = ?, looking_for_age_max = ?
                WHERE id = ?`,
                [
                    firstName, lastName, gender, birthDate,
                    height, weight, bodyType,
                    locationCity, locationCountry, aboutMe,
                    lookingForGender, lookingForAgeMin, lookingForAgeMax,
                    req.userId
                ]
            );

            const [updatedUser] = await database.query('SELECT * FROM users WHERE id = ?', [req.userId]);
            res.json({ success: true, user: updatedUser[0] });
        } else {
            // Fallback mode
            const user = profilesMemory.get(req.userId);
            if (user) {
                Object.assign(user, {
                    first_name: firstName,
                    last_name: lastName,
                    gender,
                    birth_date: birthDate,
                    height,
                    weight,
                    body_type: bodyType,
                    location_city: locationCity,
                    location_country: locationCountry,
                    about_me: aboutMe,
                    looking_for_gender: lookingForGender,
                    looking_for_age_min: lookingForAgeMin,
                    looking_for_age_max: lookingForAgeMax
                });
                profilesMemory.set(req.userId, user);
                res.json({ success: true, user });
            } else {
                res.status(404).json({ error: 'User not found' });
            }
        }
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Upload profile photo
router.post('/photo', verifyToken, upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const photoUrl = `/images/uploads/${req.file.filename}`;
        const isPrimary = req.body.isPrimary === 'true';

        if (database.pool) {
            if (isPrimary) {
                // Set all other photos as non-primary
                await database.query('UPDATE user_photos SET is_primary = FALSE WHERE user_id = ?', [req.userId]);
                
                // Update main avatar
                await database.query('UPDATE users SET avatar_url = ? WHERE id = ?', [photoUrl, req.userId]);
            }

            await database.query(
                'INSERT INTO user_photos (user_id, photo_url, is_primary) VALUES (?, ?, ?)',
                [req.userId, photoUrl, isPrimary]
            );

            res.json({ success: true, photoUrl });
        } else {
            // Fallback mode
            const user = profilesMemory.get(req.userId);
            if (user) {
                user.avatar_url = photoUrl;
                if (!user.photos) user.photos = [];
                user.photos.push({ photo_url: photoUrl, is_primary: isPrimary });
                profilesMemory.set(req.userId, user);
                res.json({ success: true, photoUrl });
            } else {
                res.status(404).json({ error: 'User not found' });
            }
        }
    } catch (error) {
        console.error('Upload photo error:', error);
        res.status(500).json({ error: 'Failed to upload photo' });
    }
});

// Like another user
router.post('/like/:userId', verifyToken, async (req, res) => {
    try {
        const likedUserId = req.params.userId;

        if (database.pool) {
            // Check if already liked
            const [existingLikes] = await database.query(
                'SELECT * FROM likes WHERE liker_id = ? AND liked_id = ?',
                [req.userId, likedUserId]
            );

            if (existingLikes.length > 0) {
                return res.status(400).json({ error: 'Already liked this user' });
            }

            await database.query(
                'INSERT INTO likes (liker_id, liked_id) VALUES (?, ?)',
                [req.userId, likedUserId]
            );

            // Check if it's a match
            const [mutualLike] = await database.query(
                'SELECT * FROM likes WHERE liker_id = ? AND liked_id = ? AND status = "accepted"',
                [likedUserId, req.userId]
            );

            let isMatch = false;
            if (mutualLike.length > 0) {
                isMatch = true;
                await database.query(
                    'UPDATE likes SET status = "accepted" WHERE liker_id = ? AND liked_id = ?',
                    [req.userId, likedUserId]
                );

                // Create conversation
                await database.query(
                    'INSERT IGNORE INTO conversations (user1_id, user2_id) VALUES (?, ?)',
                    [Math.min(req.userId, likedUserId), Math.max(req.userId, likedUserId)]
                );
            }

            res.json({ success: true, isMatch });
        } else {
            // Fallback mode
            res.json({ success: true, isMatch: false });
        }
    } catch (error) {
        console.error('Like error:', error);
        res.status(500).json({ error: 'Failed to like user' });
    }
});

// Get matches
router.get('/matches', verifyToken, async (req, res) => {
    try {
        if (database.pool) {
            const [matches] = await database.query(
                `SELECT u.*, l.created_at as liked_at 
                 FROM likes l 
                 JOIN users u ON (l.liker_id = u.id OR l.liked_id = u.id)
                 WHERE (l.liker_id = ? OR l.liked_id = ?) 
                 AND l.status = "accepted"
                 AND u.id != ?`,
                [req.userId, req.userId, req.userId]
            );
            res.json({ matches });
        } else {
            res.json({ matches: [] });
        }
    } catch (error) {
        console.error('Get matches error:', error);
        res.status(500).json({ error: 'Failed to get matches' });
    }
});

// Add interest to user
router.post('/interests', verifyToken, async (req, res) => {
    try {
        const { interestId } = req.body;

        if (database.pool) {
            await database.query(
                'INSERT IGNORE INTO user_interests (user_id, interest_id) VALUES (?, ?)',
                [req.userId, interestId]
            );
            res.json({ success: true });
        } else {
            res.json({ success: true });
        }
    } catch (error) {
        console.error('Add interest error:', error);
        res.status(500).json({ error: 'Failed to add interest' });
    }
});

module.exports = router;
