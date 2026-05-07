const express = require('express');
const router = express.Router();
const database = require('../config/database');

// Middleware to verify token
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

// Get conversations for user
router.get('/conversations', verifyToken, async (req, res) => {
    try {
        if (database.pool) {
            const [conversations] = await database.query(
                `SELECT c.*, 
                        u1.id as user1_id, u1.first_name as user1_first_name, u1.last_name as user1_last_name, u1.avatar_url as user1_avatar,
                        u2.id as user2_id, u2.first_name as user2_first_name, u2.last_name as user2_last_name, u2.avatar_url as user2_avatar
                 FROM conversations c
                 JOIN users u1 ON c.user1_id = u1.id
                 JOIN users u2 ON c.user2_id = u2.id
                 WHERE c.user1_id = ? OR c.user2_id = ?
                 ORDER BY c.last_message_at DESC`,
                [req.userId, req.userId]
            );

            const result = conversations.map(c => {
                const otherUser = c.user1_id === req.userId ? 
                    { id: c.user2_id, first_name: c.user2_first_name, last_name: c.user2_last_name, avatar_url: c.user2_avatar } :
                    { id: c.user1_id, first_name: c.user1_first_name, last_name: c.user1_last_name, avatar_url: c.user1_avatar };
                
                return {
                    id: c.id,
                    otherUser,
                    lastMessage: c.last_message,
                    lastMessageAt: c.last_message_at
                };
            });

            res.json({ conversations: result });
        } else {
            res.json({ conversations: [] });
        }
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ error: 'Failed to get conversations' });
    }
});

// Get messages in conversation
router.get('/conversations/:conversationId/messages', verifyToken, async (req, res) => {
    try {
        const { conversationId } = req.params;

        if (database.pool) {
            // Verify user has access to this conversation
            const [conv] = await database.query(
                'SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
                [conversationId, req.userId, req.userId]
            );

            if (conv.length === 0) {
                return res.status(404).json({ error: 'Conversation not found' });
            }

            const [messages] = await database.query(
                `SELECT m.*, u.first_name, u.last_name, u.avatar_url 
                 FROM messages m 
                 JOIN users u ON m.sender_id = u.id 
                 WHERE m.conversation_id = ? 
                 ORDER BY m.created_at ASC 
                 LIMIT 50`,
                [conversationId]
            );

            res.json({ messages });
        } else {
            res.json({ messages: [] });
        }
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

// Send message
router.post('/conversations/:conversationId/messages', verifyToken, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { messageText } = req.body;

        if (!messageText || !messageText.trim()) {
            return res.status(400).json({ error: 'Message text is required' });
        }

        if (database.pool) {
            // Verify user has access to this conversation
            const [conv] = await database.query(
                'SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
                [conversationId, req.userId, req.userId]
            );

            if (conv.length === 0) {
                return res.status(404).json({ error: 'Conversation not found' });
            }

            const [result] = await database.query(
                'INSERT INTO messages (conversation_id, sender_id, message_text) VALUES (?, ?, ?)',
                [conversationId, req.userId, messageText]
            );

            await database.query(
                'UPDATE conversations SET last_message = ?, last_message_at = NOW() WHERE id = ?',
                [messageText, conversationId]
            );

            const [newMessage] = await database.query(
                `SELECT m.*, u.first_name, u.last_name, u.avatar_url 
                 FROM messages m 
                 JOIN users u ON m.sender_id = u.id 
                 WHERE m.id = ?`,
                [result.insertId]
            );

            // Emit via Socket.IO
            const io = req.app.get('io');
            if (io) {
                io.to(`conversation_${conversationId}`).emit('new_message', {
                    conversationId,
                    ...newMessage[0]
                });
            }

            res.json({ success: true, message: newMessage[0] });
        } else {
            res.json({ success: true, message: { message_text: messageText, created_at: new Date() } });
        }
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Create conversation (start chat with matched user)
router.post('/conversations', verifyToken, async (req, res) => {
    try {
        const { otherUserId } = req.body;

        if (!otherUserId) {
            return res.status(400).json({ error: 'Other user ID is required' });
        }

        if (database.pool) {
            // Check if conversation already exists
            const [existing] = await database.query(
                'SELECT * FROM conversations WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)',
                [req.userId, otherUserId, otherUserId, req.userId]
            );

            if (existing.length > 0) {
                return res.json({ conversation: existing[0], created: false });
            }

            const [result] = await database.query(
                'INSERT INTO conversations (user1_id, user2_id) VALUES (?, ?)',
                [Math.min(req.userId, otherUserId), Math.max(req.userId, otherUserId)]
            );

            const [newConv] = await database.query('SELECT * FROM conversations WHERE id = ?', [result.insertId]);
            res.json({ conversation: newConv[0], created: true });
        } else {
            res.json({ conversation: { id: Date.now(), user1_id: req.userId, user2_id: otherUserId }, created: true });
        }
    } catch (error) {
        console.error('Create conversation error:', error);
        res.status(500).json({ error: 'Failed to create conversation' });
    }
});

// Mark messages as read
router.put('/conversations/:conversationId/read', verifyToken, async (req, res) => {
    try {
        const { conversationId } = req.params;

        if (database.pool) {
            await database.query(
                'UPDATE messages SET is_read = TRUE WHERE conversation_id = ? AND sender_id != ?',
                [conversationId, req.userId]
            );

            res.json({ success: true });
        } else {
            res.json({ success: true });
        }
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({ error: 'Failed to mark messages as read' });
    }
});

module.exports = router;
