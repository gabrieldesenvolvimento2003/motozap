-- Schema do banco Postgres para MotoBoyApp
-- Aplicado automaticamente em server/db.js → migrate() no boot

CREATE TABLE IF NOT EXISTS usuarios (
  id           TEXT PRIMARY KEY,
  nome         TEXT NOT NULL,
  email        TEXT UNIQUE NOT NULL,
  senha_hash   TEXT NOT NULL,
  tipo         TEXT NOT NULL CHECK (tipo IN ('motoboy','lojista')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lojas (
  id           TEXT PRIMARY KEY,
  lojista_id   TEXT REFERENCES usuarios(id) ON DELETE CASCADE,
  motoboy_id   TEXT REFERENCES usuarios(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  code         TEXT UNIQUE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lojas_lojista ON lojas(lojista_id);
CREATE INDEX IF NOT EXISTS idx_lojas_motoboy ON lojas(motoboy_id);

CREATE TABLE IF NOT EXISTS pedidos (
  id                 TEXT PRIMARY KEY,
  motoboy_id         TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  motoboy_nome       TEXT NOT NULL,
  loja_code          TEXT REFERENCES lojas(code) ON DELETE SET NULL,
  comanda_numero     TEXT NOT NULL DEFAULT '',
  cliente_nome       TEXT NOT NULL DEFAULT '',
  cliente_endereco   TEXT NOT NULL DEFAULT '',
  cliente_telefone   TEXT NOT NULL DEFAULT '',
  cliente_referencia TEXT NOT NULL DEFAULT '',
  valor_total        NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_pedido       NUMERIC(10,2) NOT NULL DEFAULT 0,
  formas_pagamento   JSONB NOT NULL DEFAULT '[]'::jsonb,
  foto_comanda       TEXT,
  distancia          NUMERIC(6,2),
  cliente_lat        NUMERIC(10,7),
  cliente_lon        NUMERIC(10,7),
  status             TEXT NOT NULL DEFAULT 'pendente'
                       CHECK (status IN ('pendente','saiu','a_caminho','cheguei','entregue','cancelado')),
  sub_status         TEXT
                       CHECK (sub_status IS NULL OR sub_status IN ('contatando','contato_ok','cobrando')),
  historico          JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pedidos_motoboy ON pedidos(motoboy_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_loja ON pedidos(loja_code);
-- Códigos de motoboy gerados pelo lojista
-- Motoboy ativa a conta colocando o código + criando senha
CREATE TABLE IF NOT EXISTS codigos_motoboy (
  id             TEXT PRIMARY KEY,
  lojista_id     TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  motoboy_nome   TEXT NOT NULL,
  motoboy_telefone TEXT,
  codigo         TEXT UNIQUE NOT NULL,
  usado          BOOLEAN NOT NULL DEFAULT false,
  motoboy_id     TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '30 days'
);
CREATE INDEX IF NOT EXISTS idx_codigos_codigo ON codigos_motoboy(codigo);
CREATE INDEX IF NOT EXISTS idx_codigos_lojista ON codigos_motoboy(lojista_id);

-- Vincula motoboy a lojas (um motoboy pode trabalhar em várias lojas)
CREATE TABLE IF NOT EXISTS motoboy_lojas (
  id          TEXT PRIMARY KEY,
  motoboy_id  TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  loja_id     TEXT NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  linked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(motoboy_id, loja_id)
);
CREATE INDEX IF NOT EXISTS idx_mb_lojas_motoboy ON motoboy_lojas(motoboy_id);
CREATE INDEX IF NOT EXISTS idx_mb_lojas_loja ON motoboy_lojas(loja_id);

CREATE INDEX IF NOT EXISTS idx_pedidos_created ON pedidos(created_at DESC);
