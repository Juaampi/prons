CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(80) NOT NULL DEFAULT 'unknown',
  signature_valid BOOLEAN,
  http_headers JSONB,
  raw_body JSONB,
  processing_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_created_at
  ON whatsapp_webhook_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_event_type
  ON whatsapp_webhook_events (event_type);
