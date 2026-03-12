-- user-service/init.sql
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50)  UNIQUE NOT NULL,
  email         VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  DEFAULT 'member',
  bio           TEXT,
  created_at    TIMESTAMP    DEFAULT NOW(),
  last_login    TIMESTAMP,
  updated_at    TIMESTAMP    DEFAULT NOW()
);
 
INSERT INTO users (username, email, password_hash, role) VALUES
  ('alice', 'alice@lab.local', '$2a$10$KyA3h.7kwpbEigdHNyqa4ulEuLequOozZcxn/tzknnunFb.YS6oWa', 'member'),
  ('bob',   'bob@lab.local',   '$2a$10$OrVpNqPDFk3fG7Bd7yspsOxqGZkc/z2/jaccUvj8P/GoSZWC0FH5a', 'member'),
  ('admin', 'admin@lab.local', '$2a$10$GiZo.hPr1bhhR7WZj//Uc.0lpCEe1FgaDEcGZfzJsaoa890NIvDHu', 'admin')
ON CONFLICT DO NOTHING;
-- plain: alice123 / bob456 / adminpass