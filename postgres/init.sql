-- Create database (if not exists in docker-entrypoint-initdb.d)
-- This will run when PostgreSQL container starts

-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at DESC);

-- Add constraint for valid email (optional)
-- CREATE EXTENSION IF NOT EXISTS citext;
-- ALTER TABLE contacts ALTER COLUMN email TYPE CITEXT;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Sample data (optional for testing)
INSERT INTO contacts (name, email, message) VALUES
('John Doe', 'john@example.com', 'This is a test message from Docker'),
('Jane Smith', 'jane@example.com', 'Another test message for the contact form')
ON CONFLICT DO NOTHING;

-- Create view for reporting
CREATE OR REPLACE VIEW contacts_summary AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_contacts,
    COUNT(DISTINCT email) as unique_emails
FROM contacts
GROUP BY DATE(created_at)
ORDER BY date DESC;