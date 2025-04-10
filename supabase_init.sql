-- Pitches table
CREATE TABLE IF NOT EXISTS pitches (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL,
  telegram_username TEXT,
  raw_pitch TEXT NOT NULL,
  summary TEXT,
  status TEXT DEFAULT 'pending_review',
  announced BOOLEAN DEFAULT FALSE,
  eth_address TEXT,
  eth_amount NUMERIC(20, 18) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Proposals table
CREATE TABLE IF NOT EXISTS proposals (
  id SERIAL PRIMARY KEY,
  pitch_id INTEGER REFERENCES pitches(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'voting',
  created_by BIGINT,
  tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  pitch_id INTEGER REFERENCES pitches(id),
  telegram_id BIGINT NOT NULL,
  telegram_username TEXT,
  comment TEXT NOT NULL,
  type TEXT DEFAULT 'feedback',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Votes table
CREATE TABLE IF NOT EXISTS votes (
  id SERIAL PRIMARY KEY,
  proposal_id INTEGER REFERENCES proposals(id),
  telegram_id BIGINT NOT NULL,
  telegram_username TEXT,
  vote TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(proposal_id, telegram_id)
);

-- Members table
CREATE TABLE IF NOT EXISTS members (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  telegram_username TEXT,
  points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Points transactions table
CREATE TABLE IF NOT EXISTS points_transactions (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL,
  points INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE pitches ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies (public read access, authenticated write access)
CREATE POLICY "Public read access" ON pitches FOR SELECT USING (true);
CREATE POLICY "Public read access" ON proposals FOR SELECT USING (true);
CREATE POLICY "Public read access" ON feedback FOR SELECT USING (true);
CREATE POLICY "Public read access" ON votes FOR SELECT USING (true);
CREATE POLICY "Public read access" ON members FOR SELECT USING (true);
CREATE POLICY "Public read access" ON points_transactions FOR SELECT USING (true);

CREATE POLICY "Authenticated insert access" ON pitches FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated insert access" ON proposals FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated insert access" ON feedback FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated insert access" ON votes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated insert access" ON members FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated insert access" ON points_transactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated update access" ON pitches FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated update access" ON proposals FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated update access" ON feedback FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated update access" ON votes FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated update access" ON members FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated update access" ON points_transactions FOR UPDATE USING (auth.role() = 'authenticated');

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON pitches
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON proposals
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON feedback
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON votes
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON members
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON points_transactions
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp(); 