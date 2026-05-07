const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
require('dotenv').config();

const database = require('../config/database.js');
const authRoutes = require('../routes/auth.js');
const userRoutes = require('../routes/users.js');
const chatRoutes = require('../routes/chat.js');
const adminRoutes = require('../routes/admin.js');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'linkyou-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Initialize database
database.connect().then(() => {
    console.log('Server starting...');
}).catch(err => {
    console.log('Starting without database connection');
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);

// Main page route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Socket.IO for real-time chat
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_conversation', (conversationId) => {
        socket.join(`conversation_${conversationId}`);
        console.log(`User joined conversation ${conversationId}`);
    });

    socket.on('send_message', async (data) => {
        try {
            const { conversationId, senderId, messageText } = data;
            
            // Save message to database if available
            if (database.pool) {
                await database.query(
                    'INSERT INTO messages (conversation_id, sender_id, message_text) VALUES (?, ?, ?)',
                    [conversationId, senderId, messageText]
                );
                
                // Update last message in conversation
                await database.query(
                    'UPDATE conversations SET last_message = ?, last_message_at = NOW() WHERE id = ?',
                    [messageText, conversationId]
                );
            }

            // Broadcast to all users in the conversation
            io.to(`conversation_${conversationId}`).emit('new_message', {
                conversationId,
                senderId,
                messageText,
                createdAt: new Date()
            });
        } catch (error) {
            console.error('Error sending message:', error);
        }
    });

    socket.on('typing', (data) => {
        socket.to(`conversation_${data.conversationId}`).emit('user_typing', {
            userId: data.userId,
            isTyping: data.isTyping
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Make io accessible to routes
app.set('io', io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 LinkYou server running on http://localhost:${PORT}`);
    console.log(`📱 Ready for connections!`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Shutting down server...');
    await database.close();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

module.exports = { app, server, io };
