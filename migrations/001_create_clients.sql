CREATE TABLE IF NOT EXISTS clients (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL,
  telefono VARCHAR(30) NOT NULL,
  tipo_proyecto VARCHAR(120) NOT NULL,
  solucion VARCHAR(120) NOT NULL,
  datos_extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  source VARCHAR(120) NOT NULL DEFAULT 'formulario',
  status VARCHAR(40) NOT NULL DEFAULT 'nuevo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_nombre ON clients (nombre);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients (email);
