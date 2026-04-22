CREATE TABLE IF NOT EXISTS admin_users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(160),
  username VARCHAR(80),
  password_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'seller',
  display_name VARCHAR(120),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_users_role_check CHECK (role IN ('admin', 'seller'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_email_unique
  ON admin_users ((LOWER(email)))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_username_unique
  ON admin_users ((LOWER(username)))
  WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id BIGSERIAL PRIMARY KEY,
  customer_phone VARCHAR(30) NOT NULL,
  customer_name VARCHAR(160),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_text TEXT,
  unread_count INTEGER NOT NULL DEFAULT 0,
  assigned_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone_unique
  ON whatsapp_conversations (customer_phone);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_last_message_at
  ON whatsapp_conversations (last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_unread_count
  ON whatsapp_conversations (unread_count DESC);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  wa_message_id VARCHAR(255),
  direction VARCHAR(20) NOT NULL,
  message_type VARCHAR(40) NOT NULL DEFAULT 'text',
  text_body TEXT,
  status VARCHAR(40),
  raw_payload JSONB,
  sent_by_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT whatsapp_messages_direction_check CHECK (direction IN ('inbound', 'outbound'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_wa_message_id_unique
  ON whatsapp_messages (wa_message_id)
  WHERE wa_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation_created_at
  ON whatsapp_messages (conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status
  ON whatsapp_messages (status);
