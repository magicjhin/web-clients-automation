-- Leadgen DB schema
-- Выполняется автоматически при первом запуске postgres контейнера

CREATE TABLE IF NOT EXISTS niches (
    id SERIAL PRIMARY KEY,
    name_lt VARCHAR(255) NOT NULL,
    name_ru VARCHAR(255),
    url_slug VARCHAR(255) UNIQUE NOT NULL,
    total_companies INT DEFAULT 0,
    ai_score INT,
    ai_reasoning TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    parsed_at TIMESTAMP,
    companies_found INT DEFAULT 0,
    companies_qualified INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    website VARCHAR(512),
    email VARCHAR(255),
    phone VARCHAR(50),
    niche_id INT REFERENCES niches(id) ON DELETE SET NULL,

    company_status VARCHAR(50),
    has_tax_debt BOOLEAN,
    reports_submitted BOOLEAN,
    registered_years INT,
    is_active BOOLEAN,
    google_maps_rating DECIMAL(2,1),
    google_maps_reviews INT,
    last_site_update DATE,

    status VARCHAR(50) DEFAULT 'raw',
    vip_score INT DEFAULT 0,
    is_vip BOOLEAN DEFAULT false,
    pagespeed_score INT,
    design_score INT,

    processing_step VARCHAR(50),
    processing_error TEXT,
    retry_count INT DEFAULT 0,

    audit JSONB,
    audit_confidence INT,
    letter_first TEXT,
    letter_second TEXT,

    first_email_sent_at TIMESTAMP,
    second_email_sent_at TIMESTAMP,
    call_required BOOLEAN DEFAULT false,
    called_at TIMESTAMP,
    call_result TEXT,
    replied_at TIMESTAMP,
    reply_text TEXT,
    reply_count INT DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_niche ON companies(niche_id);
CREATE INDEX IF NOT EXISTS idx_companies_vip ON companies(is_vip) WHERE is_vip = true;
CREATE INDEX IF NOT EXISTS idx_companies_email ON companies(email);
CREATE INDEX IF NOT EXISTS idx_companies_processing ON companies(processing_step) WHERE processing_step IS NOT NULL;

CREATE TABLE IF NOT EXISTS parse_history (
    id SERIAL PRIMARY KEY,
    niche_id INT REFERENCES niches(id) ON DELETE CASCADE,
    started_at TIMESTAMP DEFAULT NOW(),
    finished_at TIMESTAMP,
    companies_found INT DEFAULT 0,
    companies_new INT DEFAULT 0,
    companies_skipped INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'running',
    error TEXT
);

CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20) NOT NULL,
    module VARCHAR(50),
    message TEXT NOT NULL,
    stack_trace TEXT,
    company_id INT,
    niche_id INT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_module ON logs(module);
CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at DESC);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_companies_updated ON companies;
CREATE TRIGGER trg_companies_updated
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
