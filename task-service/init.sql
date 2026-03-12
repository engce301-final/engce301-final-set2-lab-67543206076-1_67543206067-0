CREATE TABLE IF NOT EXISTS tasks (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER      NOT NULL,
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  status      VARCHAR(20)  DEFAULT 'TODO' CHECK (status IN ('TODO','IN_PROGRESS','DONE')),
  priority    VARCHAR(10)  DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  created_at  TIMESTAMP    DEFAULT NOW(),
  updated_at  TIMESTAMP    DEFAULT NOW()
);
INSERT INTO tasks (user_id, title, description, status, priority) VALUES
  (1, 'ออกแบบ UI หน้า Login', 'ใช้ Figma', 'TODO', 'high'),
  (1, 'เขียน API Task CRUD', 'Express + PG', 'IN_PROGRESS', 'high'),
  (2, 'ทดสอบ JWT', 'ใช้ Postman', 'TODO', 'medium')
ON CONFLICT DO NOTHING;
