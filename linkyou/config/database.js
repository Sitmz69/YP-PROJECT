const mysql = require('mysql2/promise');
require('dotenv').config();

class Database {
    constructor() {
        this.pool = null;
    }

    async connect() {
        try {
            this.pool = mysql.createPool({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'linkyou',
                port: process.env.DB_PORT || 3306,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0,
                charset: 'utf8mb4'
            });

            // Test connection
            const connection = await this.pool.getConnection();
            console.log('✓ Connected to MySQL database');
            connection.release();
            
            return this.pool;
        } catch (error) {
            console.error('✗ Database connection failed:', error.message);
            console.log('Running in fallback mode without database...');
            return null;
        }
    }

    async query(sql, params = []) {
        if (!this.pool) {
            throw new Error('Database not connected');
        }
        
        try {
            const [rows] = await this.pool.execute(sql, params);
            return rows;
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            console.log('Database connection closed');
        }
    }
}

module.exports = new Database();
