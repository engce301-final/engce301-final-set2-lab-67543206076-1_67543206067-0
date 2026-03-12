# 🔐 Task Board Set 2 — Cloud Deploy (Railway)

## 👥 ทีมผู้พัฒนา

| ชื่อ | รหัสนักศึกษา |
|------|--------------|
| นักศึกษาคนที่ 1 | 67543206076 |
| นักศึกษาคนที่ 2 | 67543206067 |

---

## 🌐 Railway Service URLs

| Service | URL |
|---------|-----|
| Auth Service | `auth-service-production-c333.up.railway.app` |
| Task Service | `task-service-production-f51c.up.railway.app` |
| User Service | `user-service-production-c4d4.up.railway.app` |

> อัปเดต URL จริงหลัง deploy บน Railway

---

## 🏗️ Architecture Diagram (Cloud)

```
                    ┌──────────────────────────────────────┐
                    │           CLIENT (Browser)            │
                    └──────────────┬───────────────────────┘
                                   │ HTTPS
                    ┌──────────────▼───────────────────────┐
                    │     Gateway Strategy: Option A        │
                    │   Frontend เรียก URL แต่ละ service    │
                    │   โดยตรง (ง่าย ไม่ต้อง config Nginx) │
                    └───┬──────────────┬────────────────────┘
                        │              │              │
              HTTPS     ▼    HTTPS     ▼    HTTPS     ▼
        ┌─────────────────┐ ┌──────────────┐ ┌──────────────┐
        │  auth-service   │ │task-service  │ │user-service  │
        │    Railway      │ │   Railway    │ │   Railway    │
        │   port 3001     │ │  port 3002   │ │  port 3003   │
        │                 │ │              │ │              │
        │ POST /register  │ │ GET  /tasks  │ │ GET /profile │
        │ POST /login     │ │ POST /tasks  │ │ PUT /profile │
        │ GET  /verify    │ │ PUT  /tasks  │ │              │
        └───────┬─────────┘ └──────┬───────┘ └──────┬───────┘
                │                  │                 │
                ▼                  ▼                 ▼
        ┌───────────┐      ┌───────────┐     ┌───────────┐
        │  auth-db  │      │  task-db  │     │  user-db  │
        │ Railway   │      │ Railway   │     │ Railway   │
        │ PostgreSQL│      │ PostgreSQL│     │ PostgreSQL│
        └───────────┘      └───────────┘     └───────────┘

  JWT_SECRET เหมือนกันทุก service ← สำคัญมาก!
```

---

## 🎯 Gateway Strategy: Option A

**เลือก Option A — Frontend เรียก URL ของแต่ละ service โดยตรง**

**เหตุผล:**
- ง่ายที่สุดสำหรับ Lab นี้ — ไม่ต้อง deploy Nginx เพิ่ม
- ลด complexity ในการ config
- Railway ทำ HTTPS และ Load Balance ให้อยู่แล้ว
- เหมาะสำหรับ microservices ที่ scale แยกกัน

**ข้อจำกัด:**
- Frontend ต้องรู้ URL ของทุก service (แก้ด้วย environment variables)
- ไม่มี Single Entry Point

---

## 🚀 วิธีรัน Local Test

```bash
# 1. สร้าง init.sql แต่ละ service (ถ้ายังไม่มี)
# 2. รัน local environment
docker compose -f docker-compose.local.yml down -v
docker compose -f docker-compose.local.yml up --build
```

## ☁️ วิธี Deploy บน Railway

### Phase 1: Auth Service
```
1. railway.app → New Project → Deploy from GitHub
2. Root Directory = auth-service
3. Add PostgreSQL Plugin → ชื่อ auth-db
4. Environment Variables:
   DATABASE_URL = ${{auth-db.DATABASE_URL}}
   JWT_SECRET   = engce301-super-secret-change-me
   JWT_EXPIRES  = 1h
   PORT         = 3001
   NODE_ENV     = production
```

### Phase 2: Task Service
```
1. New Service ใน Project เดียวกัน
2. Root Directory = task-service
3. Add PostgreSQL Plugin → ชื่อ task-db
4. Environment Variables:
   DATABASE_URL = ${{task-db.DATABASE_URL}}
   JWT_SECRET   = engce301-super-secret-change-me  ← ต้องเหมือน Auth!
   PORT         = 3002
   NODE_ENV     = production
```

### Phase 3: User Service
```
1. New Service → Root Directory = user-service
2. Add PostgreSQL Plugin → ชื่อ user-db
3. Environment Variables:
   DATABASE_URL = ${{user-db.DATABASE_URL}}
   JWT_SECRET   = engce301-super-secret-change-me  ← ต้องเหมือนทุก service!
   PORT         = 3003
   NODE_ENV     = production
```

---

## 👤 Seed Users

| Username | Email | Password | Role |
|----------|-------|----------|------|
| alice | alice@lab.local | alice123 | member |
| bob | bob@lab.local | bob456 | member |
| admin | admin@lab.local | adminpass | admin |

---

## 🧪 Test Commands (แทน URL จริงจาก Railway)

```bash
AUTH_URL="https://[auth-service].railway.app"
TASK_URL="https://[task-service].railway.app"
USER_URL="https://[user-service].railway.app"

# T2: Register
curl -X POST $AUTH_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"test123"}'

# T3: Login → เก็บ token
TOKEN=$(curl -s -X POST $AUTH_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@lab.local","password":"alice123"}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo $TOKEN

# T4: Create Task (มี JWT)
curl -X POST $TASK_URL/api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"My first cloud task","priority":"high"}'

# T5: Get Tasks (มี JWT)
curl $TASK_URL/api/tasks \
  -H "Authorization: Bearer $TOKEN"

# T6: Get Profile (มี JWT)
curl $USER_URL/api/users/profile \
  -H "Authorization: Bearer $TOKEN"

# T7: Update Profile
curl -X PUT $USER_URL/api/users/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bio":"Hello from Railway!"}'

# T8: No JWT → 401
curl $TASK_URL/api/tasks
```

---

## 📁 โครงสร้างโปรเจกต์

```
engce301-final-lab2/
├── auth-service/
│   ├── src/
│   │   ├── routes/auth.js        # register, login, verify, me
│   │   └── middleware/jwtUtils.js
│   ├── init.sql                  # users table + seed
│   ├── Dockerfile
│   └── package.json
├── task-service/
│   ├── src/
│   │   ├── routes/task.js        # CRUD tasks
│   │   ├── middleware/authMiddleware.js
│   │   └── jwtUtils.js
│   ├── init.sql                  # tasks table + seed
│   ├── Dockerfile
│   └── package.json
├── user-service/          ← ใหม่ใน Set 2
│   ├── src/
│   │   ├── routes/users.js       # profile GET/PUT
│   │   ├── middleware/authMiddleware.js
│   │   └── jwtUtils.js
│   ├── init.sql                  # users table + seed
│   ├── Dockerfile
│   └── package.json
├── frontend/
├── nginx/
├── docker-compose.yml            # production (1 DB)
├── docker-compose.local.yml      # local test (3 DBs)
└── README.md
```

---

## 🐛 ปัญหาที่เจอและวิธีแก้

| ปัญหา | สาเหตุ | วิธีแก้ |
|-------|--------|---------|
| `pool is not defined` | comment out require db | เพิ่ม `new Pool()` ใน route โดยตรง |
| `verifyToken is not a function` | require จาก `jsonwebtoken` แทน jwtUtils | สร้าง `src/jwtUtils.js` แยกแต่ละ service |
| `init.sql: Is a directory` | mount folder แทนไฟล์ | สร้าง `init.sql` ใน folder ของแต่ละ service |
| `401 หลัง login` | JWT payload ใช้ `sub` แต่ middleware ต้องการ `id` | เพิ่ม `id: decoded.sub \|\| decoded.id` |
| `DB ไม่ init` | volume เก่าค้าง | `docker compose down -v` ก่อน up |