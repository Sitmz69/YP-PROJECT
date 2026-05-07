const express = require('express');
const router = express.Router();
const database = require('../config/database');

// Middleware to verify admin token
const verifyAdmin = (req, res, next) => {
    const jwt = require('jsonwebtoken');
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        if (!decoded.is_admin) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        req.userId = decoded.id;
        req.isAdmin = true;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// Get dashboard statistics
router.get('/stats', verifyAdmin, async (req, res) => {
    try {
        if (database.pool) {
            const [totalUsers] = await database.query('SELECT COUNT(*) as count FROM users');
            const [activeUsers] = await database.query('SELECT COUNT(*) as count FROM users WHERE is_active = TRUE');
            const [newUsersToday] = await database.query("SELECT COUNT(*) as count FROM users WHERE DATE(created_at) = CURDATE()");
            const [totalConversations] = await database.query('SELECT COUNT(*) as count FROM conversations');
            const [totalMessages] = await database.query('SELECT COUNT(*) as count FROM messages');
            const [pendingReports] = await database.query("SELECT COUNT(*) as count FROM reports WHERE status = 'pending'");

            res.json({
                stats: {
                    totalUsers: totalUsers[0].count,
                    activeUsers: activeUsers[0].count,
                    newUsersToday: newUsersToday[0].count,
                    totalConversations: totalConversations[0].count,
                    totalMessages: totalMessages[0].count,
                    pendingReports: pendingReports[0].count
                }
            });
        } else {
            res.json({ stats: { totalUsers: 0, activeUsers: 0, newUsersToday: 0, totalConversations: 0, totalMessages: 0, pendingReports: 0 } });
        }
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

// Get all users with pagination
router.get('/users', verifyAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, search, status } = req.query;

        if (database.pool) {
            let query = 'SELECT * FROM users WHERE 1=1';
            const params = [];

            if (search) {
                query += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)';
                params.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }

            if (status !== undefined) {
                query += ' AND is_active = ?';
                params.push(status === 'active');
            }

            const offset = (page - 1) * limit;
            query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
            params.push(parseInt(limit), offset);

            const [users] = await database.query(query, params);
            const [totalResult] = await database.query(query.replace('LIMIT ? OFFSET ?', ''), params.slice(0, params.length - 2));

            res.json({ 
                users, 
                total: totalResult.length,
                page: parseInt(page),
                totalPages: Math.ceil(totalResult.length / parseInt(limit))
            });
        } else {
            res.json({ users: [], total: 0, page: 1, totalPages: 0 });
        }
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// Update user (ban/activate/promote to admin)
router.put('/users/:userId', verifyAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { isActive, isAdmin } = req.body;

        if (database.pool) {
            const updates = [];
            const params = [];

            if (isActive !== undefined) {
                updates.push('is_active = ?');
                params.push(isActive);
            }

            if (isAdmin !== undefined) {
                updates.push('is_admin = ?');
                params.push(isAdmin);
            }

            if (updates.length > 0) {
                params.push(userId);
                await database.query(
                    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
                    params
                );

                // Log action
                await database.query(
                    'INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
                    [userId, 'admin_update_user', JSON.stringify({ isActive, isAdmin }), req.ip]
                );

                const [updatedUser] = await database.query('SELECT * FROM users WHERE id = ?', [userId]);
                res.json({ success: true, user: updatedUser[0] });
            } else {
                res.status(400).json({ error: 'No updates provided' });
            }
        } else {
            res.json({ success: true });
        }
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete user
router.delete('/users/:userId', verifyAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        if (database.pool) {
            await database.query('DELETE FROM users WHERE id = ?', [userId]);

            // Log action
            await database.query(
                'INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
                [userId, 'admin_delete_user', 'User deleted by admin', req.ip]
            );

            res.json({ success: true });
        } else {
            res.json({ success: true });
        }
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Get reports
router.get('/reports', verifyAdmin, async (req, res) => {
    try {
        const { status = 'pending' } = req.query;

        if (database.pool) {
            const [reports] = await database.query(
                `SELECT r.*, 
                        ru.first_name as reporter_first_name, ru.last_name as reporter_last_name,
                        bu.first_name as reported_first_name, bu.last_name as reported_last_name
                 FROM reports r
                 JOIN users ru ON r.reporter_id = ru.id
                 JOIN users bu ON r.reported_user_id = bu.id
                 WHERE r.status = ?
                 ORDER BY r.created_at DESC`,
                [status]
            );

            res.json({ reports });
        } else {
            res.json({ reports: [] });
        }
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ error: 'Failed to get reports' });
    }
});

// Update report status
router.put('/reports/:reportId', verifyAdmin, async (req, res) => {
    try {
        const { reportId } = req.params;
        const { status, adminNotes } = req.body;

        if (database.pool) {
            await database.query(
                'UPDATE reports SET status = ?, admin_notes = ?, resolved_at = NOW(), resolved_by = ? WHERE id = ?',
                [status, adminNotes, req.userId, reportId]
            );

            res.json({ success: true });
        } else {
            res.json({ success: true });
        }
    } catch (error) {
        console.error('Update report error:', error);
        res.status(500).json({ error: 'Failed to update report' });
    }
});

// Get activity logs
router.get('/logs', verifyAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 50, action } = req.query;

        if (database.pool) {
            let query = 'SELECT * FROM activity_logs WHERE 1=1';
            const params = [];

            if (action) {
                query += ' AND action = ?';
                params.push(action);
            }

            const offset = (page - 1) * limit;
            query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
            params.push(parseInt(limit), offset);

            const logs = await database.query(query, params);

            res.json({ logs, page: parseInt(page) });
        } else {
            res.json({ logs: [], page: 1 });
        }
    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({ error: 'Failed to get logs' });
    }
});

// Get recent registrations
router.get('/recent-registrations', verifyAdmin, async (req, res) => {
    try {
        if (database.pool) {
            const [users] = await database.query(
                'SELECT * FROM users ORDER BY created_at DESC LIMIT 20'
            );
            res.json({ users });
        } else {
            res.json({ users: [] });
        }
    } catch (error) {
        console.error('Get recent registrations error:', error);
        res.status(500).json({ error: 'Failed to get recent registrations' });
    }
});

module.exports = router;
