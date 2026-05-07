const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const VKontakteStrategy = require('passport-vkontakte').Strategy;
const router = express.Router();
const database = require('../config/database.js');
require('dotenv').config();

// In-memory storage for fallback mode (no database)
const usersMemory = new Map();
let userIdCounter = 1;

// Passport Google Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback'
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            if (database.pool) {
                const [rows] = await database.query(
                    'SELECT * FROM users WHERE google_id = ?',
                    [profile.id]
                );
                
                if (rows.length > 0) {
                    return done(null, rows[0]);
                } else {
                    const [result] = await database.query(
                        'INSERT INTO users (google_id, email, first_name, last_name, avatar_url, gender, birth_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [profile.id, profile.emails[0]?.value, profile.name?.givenName, profile.name?.familyName, profile.photos[0]?.value, 'other', '2000-01-01']
                    );
                    
                    const [newUser] = await database.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
                    return done(null, newUser[0]);
                }
            } else {
                // Fallback mode
                let user = Array.from(usersMemory.values()).find(u => u.google_id === profile.id);
                if (!user) {
                    const id = userIdCounter++;
                    user = {
                        id,
                        google_id: profile.id,
                        email: profile.emails[0]?.value,
                        first_name: profile.name?.givenName || 'User',
                        last_name: profile.name?.familyName || '',
                        avatar_url: profile.photos[0]?.value,
                        gender: 'other',
                        birth_date: '2000-01-01'
                    };
                    usersMemory.set(id, user);
                }
                return done(null, user);
            }
        } catch (error) {
            return done(error, null);
        }
    }));
}

// Passport VKontakte Strategy
if (process.env.VKONTAKTE_APP_ID && process.env.VKONTAKTE_APP_SECRET) {
    passport.use(new VKontakteStrategy({
        clientID: process.env.VKONTAKTE_APP_ID,
        clientSecret: process.env.VKONTAKTE_APP_SECRET,
        callbackURL: process.env.VKONTAKTE_CALLBACK_URL || 'http://localhost:3000/auth/vk/callback'
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            if (database.pool) {
                const [rows] = await database.query(
                    'SELECT * FROM users WHERE vk_id = ?',
                    [profile.id]
                );
                
                if (rows.length > 0) {
                    return done(null, rows[0]);
                } else {
                    const [result] = await database.query(
                        'INSERT INTO users (vk_id, email, first_name, last_name, avatar_url, gender, birth_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [profile.id, profile.emails[0]?.value, profile.name?.givenName, profile.name?.familyName, profile.photos[0]?.value, 'other', '2000-01-01']
                    );
                    
                    const [newUser] = await database.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
                    return done(null, newUser[0]);
                }
            } else {
                // Fallback mode
                let user = Array.from(usersMemory.values()).find(u => u.vk_id === profile.id);
                if (!user) {
                    const id = userIdCounter++;
                    user = {
                        id,
                        vk_id: profile.id,
                        email: profile.emails[0]?.value,
                        first_name: profile.name?.givenName || 'User',
                        last_name: profile.name?.familyName || '',
                        avatar_url: profile.photos[0]?.value,
                        gender: 'other',
                        birth_date: '2000-01-01'
                    };
                    usersMemory.set(id, user);
                }
                return done(null, user);
            }
        } catch (error) {
            return done(error, null);
        }
    }));
}

// Telegram Auth (manual verification)
router.post('/telegram', async (req, res) => {
    try {
        const { auth_data } = req.body;
        
        // Verify Telegram auth data (simplified - in production verify hash)
        if (!auth_data || !auth_data.id) {
            return res.status(400).json({ error: 'Invalid Telegram auth data' });
        }

        if (database.pool) {
            const [rows] = await database.query(
                'SELECT * FROM users WHERE telegram_id = ?',
                [auth_data.id.toString()]
            );
            
            if (rows.length > 0) {
                const user = rows[0];
                const token = jwt.sign({ id: user.id, is_admin: user.is_admin }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
                return res.json({ success: true, user, token });
            } else {
                // Create new user from Telegram
                const [result] = await database.query(
                    'INSERT INTO users (telegram_id, first_name, last_name, avatar_url, gender, birth_date) VALUES (?, ?, ?, ?, ?, ?)',
                    [auth_data.id.toString(), auth_data.first_name || 'User', auth_data.last_name || '', auth_data.photo_url, 'other', '2000-01-01']
                );
                
                const [newUser] = await database.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
                const token = jwt.sign({ id: newUser[0].id, is_admin: newUser[0].is_admin }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
                return res.json({ success: true, user: newUser[0], token });
            }
        } else {
            // Fallback mode
            let user = Array.from(usersMemory.values()).find(u => u.telegram_id === auth_data.id.toString());
            if (!user) {
                const id = userIdCounter++;
                user = {
                    id,
                    telegram_id: auth_data.id.toString(),
                    first_name: auth_data.first_name || 'User',
                    last_name: auth_data.last_name || '',
                    avatar_url: auth_data.photo_url,
                    gender: 'other',
                    birth_date: '2000-01-01'
                };
                usersMemory.set(id, user);
            }
            const token = jwt.sign({ id: user.id, is_admin: user.is_admin || false }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
            return res.json({ success: true, user, token });
        }
    } catch (error) {
        console.error('Telegram auth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

// Register with email/password
router.post('/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName, gender, birthDate } = req.body;

        if (!email || !password || !firstName || !birthDate) {
            return res.status(400).json({ error: 'All required fields must be filled' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        if (database.pool) {
            const [existingUsers] = await database.query('SELECT * FROM users WHERE email = ?', [email]);
            if (existingUsers.length > 0) {
                return res.status(400).json({ error: 'Email already registered' });
            }

            const [result] = await database.query(
                'INSERT INTO users (email, password_hash, first_name, last_name, gender, birth_date) VALUES (?, ?, ?, ?, ?, ?)',
                [email, passwordHash, firstName, lastName || '', gender, birthDate]
            );

            const [newUser] = await database.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
            const user = newUser[0];
            const token = jwt.sign({ id: user.id, is_admin: user.is_admin }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });

            res.json({ success: true, user, token });
        } else {
            // Fallback mode
            const existingUser = Array.from(usersMemory.values()).find(u => u.email === email);
            if (existingUser) {
                return res.status(400).json({ error: 'Email already registered' });
            }

            const id = userIdCounter++;
            const user = {
                id,
                email,
                password_hash: passwordHash,
                first_name: firstName,
                last_name: lastName || '',
                gender,
                birth_date: birthDate,
                is_admin: id === 1 // First user is admin
            };
            usersMemory.set(id, user);
            
            const token = jwt.sign({ id: user.id, is_admin: user.is_admin }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
            res.json({ success: true, user, token });
        }
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login with email/password
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        if (database.pool) {
            const [users] = await database.query('SELECT * FROM users WHERE email = ?', [email]);
            if (users.length === 0) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const user = users[0];
            const validPassword = await bcrypt.compare(password, user.password_hash);
            if (!validPassword) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const token = jwt.sign({ id: user.id, is_admin: user.is_admin }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
            res.json({ success: true, user, token });
        } else {
            // Fallback mode
            const user = Array.from(usersMemory.values()).find(u => u.email === email);
            if (!user || !user.password_hash) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const validPassword = await bcrypt.compare(password, user.password_hash);
            if (!validPassword) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const token = jwt.sign({ id: user.id, is_admin: user.is_admin }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
            res.json({ success: true, user, token });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// OAuth callbacks
router.get('/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/#login' }),
    (req, res) => {
        const token = jwt.sign({ id: req.user.id, is_admin: req.user.is_admin }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
        res.redirect(`/#auth-callback?token=${token}&userId=${req.user.id}`);
    }
);

router.get('/vk/callback',
    passport.authenticate('vkontakte', { session: false, failureRedirect: '/#login' }),
    (req, res) => {
        const token = jwt.sign({ id: req.user.id, is_admin: req.user.is_admin }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
        res.redirect(`/#auth-callback?token=${token}&userId=${req.user.id}`);
    }
);

// Verify token middleware
const verifyToken = (req, res, next) => {
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

// Get current user
router.get('/me', verifyToken, async (req, res) => {
    try {
        if (database.pool) {
            const [users] = await database.query('SELECT * FROM users WHERE id = ?', [req.userId]);
            if (users.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            res.json({ user: users[0] });
        } else {
            const user = usersMemory.get(req.userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            res.json({ user });
        }
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

module.exports = router;
