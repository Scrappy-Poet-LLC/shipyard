-- Release Environment Dashboard Schema

-- GitHub App installations
CREATE TABLE github_installations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  installation_id BIGINT NOT NULL UNIQUE,
  org_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Environments (controlled enum: production, staging, sandbox)
CREATE TABLE environments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  commit_ceiling INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Services (repositories tracked by the dashboard)
CREATE TABLE services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  display_name TEXT NOT NULL,
  github_repo TEXT NOT NULL UNIQUE,
  default_branch TEXT NOT NULL DEFAULT 'main',
  installation_id UUID REFERENCES github_installations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Maps each service to its deploy workflow per environment
CREATE TABLE service_environments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  workflow_file TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(service_id, environment_id)
);

-- Indexes
CREATE INDEX idx_services_installation ON services(installation_id);
CREATE INDEX idx_service_environments_env ON service_environments(environment_id);
CREATE INDEX idx_service_environments_service ON service_environments(service_id);

-- Seed the three supported environments
INSERT INTO environments (name, slug, commit_ceiling) VALUES
  ('Production', 'production', 30),
  ('Staging', 'staging', 30),
  ('Sandbox', 'sandbox', 30);

-- Row Level Security
ALTER TABLE github_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_environments ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all tables
CREATE POLICY "Authenticated users can read installations"
  ON github_installations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read environments"
  ON environments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read services"
  ON services FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read service_environments"
  ON service_environments FOR SELECT TO authenticated USING (true);

-- Service role (used by API routes) has full access via bypassing RLS
