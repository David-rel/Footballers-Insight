-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    image_url TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    email_code VARCHAR(10),
    onboarded BOOLEAN DEFAULT FALSE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'coach', 'parent', 'player')),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    password_reset_code VARCHAR(10),
    password_reset_expiration TIMESTAMP,
    logged_in_status BOOLEAN DEFAULT FALSE,
    last_online TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Company Table
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_logo TEXT,
    website_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_companies_owner_id ON companies(owner_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Curriculum Table
CREATE TABLE IF NOT EXISTS curriculums (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    tests JSONB DEFAULT '[]'::jsonb,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team Table
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    curriculum_id UUID REFERENCES curriculums(id) ON DELETE SET NULL,
    coach_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for teams and curriculums
CREATE INDEX IF NOT EXISTS idx_teams_company_id ON teams(company_id);
CREATE INDEX IF NOT EXISTS idx_teams_coach_id ON teams(coach_id);
CREATE INDEX IF NOT EXISTS idx_teams_curriculum_id ON teams(curriculum_id);
CREATE INDEX IF NOT EXISTS idx_curriculums_created_by ON curriculums(created_by);

-- Create triggers to automatically update updated_at
DROP TRIGGER IF EXISTS update_curriculums_updated_at ON curriculums;
CREATE TRIGGER update_curriculums_updated_at BEFORE UPDATE ON curriculums
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Players Table
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- The login account that supervises this player (parent/guardian or self-supervised player)
    parent_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    dob DATE,
    age_group VARCHAR(50),
    gender VARCHAR(20),
    dominant_foot VARCHAR(10) CHECK (dominant_foot IN ('left', 'right', 'both')),
    notes TEXT,
    -- If TRUE, the supervising account is the player themselves (still stored as a 'parent' role user)
    self_supervised BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for players
CREATE INDEX IF NOT EXISTS idx_players_parent_user_id ON players(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_players_team_id ON players(team_id);

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_players_updated_at ON players;
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Evaluations Table
CREATE TABLE IF NOT EXISTS evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    one_v_one_rounds INTEGER DEFAULT 5,
    skill_moves_count INTEGER DEFAULT 6,
    scores JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for evaluations
CREATE INDEX IF NOT EXISTS idx_evaluations_team_id ON evaluations(team_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_created_by ON evaluations(created_by);

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_evaluations_updated_at ON evaluations;
CREATE TRIGGER update_evaluations_updated_at BEFORE UPDATE ON evaluations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Player Evaluations (per-player snapshot of an evaluation)
CREATE TABLE IF NOT EXISTS player_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    coach_id UUID REFERENCES users(id) ON DELETE SET NULL,
    coach_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_id, evaluation_id)
);

CREATE INDEX IF NOT EXISTS idx_player_evaluations_player_id ON player_evaluations(player_id);
CREATE INDEX IF NOT EXISTS idx_player_evaluations_team_id ON player_evaluations(team_id);
CREATE INDEX IF NOT EXISTS idx_player_evaluations_evaluation_id ON player_evaluations(evaluation_id);

DROP TRIGGER IF EXISTS update_player_evaluations_updated_at ON player_evaluations;
CREATE TRIGGER update_player_evaluations_updated_at BEFORE UPDATE ON player_evaluations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Test Scores: raw scores captured in the evaluation UI (per player evaluation)
CREATE TABLE IF NOT EXISTS test_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_evaluation_id UUID NOT NULL REFERENCES player_evaluations(id) ON DELETE CASCADE,
    scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_evaluation_id)
);

CREATE INDEX IF NOT EXISTS idx_test_scores_player_evaluation_id ON test_scores(player_evaluation_id);

DROP TRIGGER IF EXISTS update_test_scores_updated_at ON test_scores;
CREATE TRIGGER update_test_scores_updated_at BEFORE UPDATE ON test_scores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Overall Scores: computed (raw + extras) from compute-all route (per player evaluation)
CREATE TABLE IF NOT EXISTS overall_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_evaluation_id UUID NOT NULL REFERENCES player_evaluations(id) ON DELETE CASCADE,
    scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_evaluation_id)
);

CREATE INDEX IF NOT EXISTS idx_overall_scores_player_evaluation_id ON overall_scores(player_evaluation_id);

DROP TRIGGER IF EXISTS update_overall_scores_updated_at ON overall_scores;
CREATE TRIGGER update_overall_scores_updated_at BEFORE UPDATE ON overall_scores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Player DNA: normalized values (per player evaluation)
CREATE TABLE IF NOT EXISTS player_dna (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_evaluation_id UUID NOT NULL REFERENCES player_evaluations(id) ON DELETE CASCADE,
    dna JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_evaluation_id)
);

CREATE INDEX IF NOT EXISTS idx_player_dna_player_evaluation_id ON player_dna(player_evaluation_id);

DROP TRIGGER IF EXISTS update_player_dna_updated_at ON player_dna;
CREATE TRIGGER update_player_dna_updated_at BEFORE UPDATE ON player_dna
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Player Cluster: 4D cluster vector values (per player evaluation)
-- Stores: { ps, tc, ms, dc, vector: [ps, tc, ms, dc] }
CREATE TABLE IF NOT EXISTS player_cluster (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_evaluation_id UUID NOT NULL REFERENCES player_evaluations(id) ON DELETE CASCADE,
    cluster JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_evaluation_id)
);

CREATE INDEX IF NOT EXISTS idx_player_cluster_player_evaluation_id ON player_cluster(player_evaluation_id);

DROP TRIGGER IF EXISTS update_player_cluster_updated_at ON player_cluster;
CREATE TRIGGER update_player_cluster_updated_at BEFORE UPDATE ON player_cluster
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

