-- COMKEY AFYA POA — Initial PostgreSQL Extensions & Setup
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Verify extensions
SELECT * FROM pg_extension WHERE extname IN ('uuid-ossp', 'pgcrypto', 'pg_trgm');
