CREATE TABLE IF NOT EXISTS client_activity_logs (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  actor_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
  actor_name VARCHAR(160),
  actor_role VARCHAR(30),
  action_type VARCHAR(60) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_activity_logs_client_created_at
  ON client_activity_logs (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_activity_logs_action_type
  ON client_activity_logs (action_type);
