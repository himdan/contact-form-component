require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const { Pool } = require('pg');
const { body, validationResult } = require('express-validator');

const app = express();
const port = process.env.PORT || 3000;

// Logger setup
const logger = require('./logger');

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// PostgreSQL connection pool with retry logic
let pool;
const maxRetries = 5;
let retries = 0;

function createPool() {
  pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  });

  pool.on('error', (err) => {
    logger.error('Unexpected error on idle client', err);
    if (retries < maxRetries) {
      retries++;
      logger.info(`Retrying connection (${retries}/${maxRetries})...`);
      setTimeout(createPool, 5000);
    }
  });

  return pool;
}

createPool();

// Test database connection
async function testConnection() {
  try {
    const client = await pool.connect();
    logger.info('Database connection successful');
    client.release();
  } catch (error) {
    logger.error('Database connection failed:', error.message);
    process.exit(1);
  }
}

// Create contacts table if not exists
async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_contacts_email 
      ON contacts(email)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_contacts_created_at 
      ON contacts(created_at DESC)
    `);
    
    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error('Error initializing database:', error);
    throw error;
  }
}

// Validation middleware
const validateContact = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('message')
    .trim()
    .notEmpty().withMessage('Message is required')
    .isLength({ min: 10, max: 1000 }).withMessage('Message must be between 10 and 1000 characters'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }
    next();
  }
];

// Routes
app.post('/api/contacts', validateContact, async (req, res) => {
  const { name, email, message } = req.body;
  const ipAddress = req.ip;
  const userAgent = req.get('User-Agent');
  
  try {
    const result = await pool.query(
      `INSERT INTO contacts (name, email, message, ip_address, user_agent) 
       VALUES ($1, $2, $3, $4::inet, $5) 
       RETURNING id, name, email, created_at`,
      [name, email, message, ipAddress, userAgent]
    );
    
    logger.info(`Contact saved: ${email}`);
    
    res.status(201).json({
      success: true,
      message: 'Contact saved successfully',
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error saving contact:', error);
    
    // Handle duplicate submissions
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ 
        error: 'Duplicate submission detected' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to save contact',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.get('/api/contacts', async (req, res) => {
  try {
    const { page = 1, limit = 10, email, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT id, name, email, created_at FROM contacts';
    let countQuery = 'SELECT COUNT(*) FROM contacts';
    let conditions = [];
    let params = [];
    let paramCount = 0;
    
    if (email) {
      paramCount++;
      conditions.push(`email = $${paramCount}`);
      params.push(email);
    }
    
    if (startDate) {
      paramCount++;
      conditions.push(`created_at >= $${paramCount}`);
      params.push(startDate);
    }
    
    if (endDate) {
      paramCount++;
      conditions.push(`created_at <= $${paramCount}`);
      params.push(endDate);
    }
    
    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(parseInt(limit), offset);
    
    const [result, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, params.slice(0, paramCount))
    ]);
    
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching contacts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch contacts',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.get('/api/contacts/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, message, created_at FROM contacts WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error fetching contact:', error);
    res.status(500).json({ 
      error: 'Failed to fetch contact',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.delete('/api/contacts/:id', async (req, res) => {
  try {
    // In production, add authentication/authorization here
    const apiKey = req.get('X-API-Key');
    if (process.env.NODE_ENV === 'production' && apiKey !== process.env.ADMIN_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const result = await pool.query(
      'DELETE FROM contacts WHERE id = $1 RETURNING id, email',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    logger.info(`Contact deleted: ${result.rows[0].email}`);
    
    res.json({
      success: true,
      message: 'Contact deleted successfully',
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error deleting contact:', error);
    res.status(500).json({ 
      error: 'Failed to delete contact',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Health check endpoint with database check
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'contact-form-api',
    uptime: process.uptime(),
    checks: {}
  };
  
  try {
    // Check database connection
    await pool.query('SELECT 1');
    health.checks.database = 'healthy';
  } catch (error) {
    health.status = 'unhealthy';
    health.checks.database = 'unhealthy';
    health.databaseError = error.message;
  }
  
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Metrics endpoint
app.get('/api/metrics', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_contacts,
        COUNT(DISTINCT email) as unique_emails,
        DATE(created_at) as date,
        COUNT(*) as daily_count
      FROM contacts
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching metrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch metrics',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
async function startServer() {
  try {
    await testConnection();
    await initializeDatabase();
    
    app.listen(port, '0.0.0.0', () => {
      logger.info(`Server running on port ${port}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info(`Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
      logger.info(`CORS Origin: ${process.env.CORS_ORIGIN}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();