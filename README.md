# 🔐 Task Board — ENGCE301 Final Lab (Security Architecture)

## 👥 ทีมผู้พัฒนา

| ชื่อ | รหัสนักศึกษา |
|------|--------------|
| นายศราวุฒิ ข่ายแก้ว | 67543206076-1 |
| นายพิธาน กันปาน | 67543206067-0 |

---

## 🏗️ Architecture Diagram

```
                        ┌─────────────────────────────────────────────────┐
                        │               CLIENT (Browser)                   │
                        │         https://localhost (port 443)             │
                        └─────────────────────┬───────────────────────────┘
                                              │ HTTPS (TLS 1.2/1.3)
                                              │ Self-signed Certificate
                                              ▼
                        ┌─────────────────────────────────────────────────┐
                        │              NGINX (API Gateway)                 │
                        │         Port 80 → redirect → 443                │
                        │         Port 443 (TLS termination)               │
                        │                                                  │
                        │  Rate Limit: /api/auth/login → 5 req/min        │
                        │  Rate Limit: /api/*          → 30 req/min       │
                        └──────┬──────────┬──────────┬────────────────────┘
                               │          │          │
                HTTP (internal)│          │          │
                               ▼          ▼          ▼
              ┌────────────────┐  ┌───────────────┐  ┌───────────────┐
              │  auth-service  │  │ task-service  │  │  log-service  │
              │   port 3001    │  │   port 3002   │  │   port 3003   │
              │                │  │               │  │               │
              │ POST /login    │  │ GET    /tasks │  │ GET  /logs    │
              │ GET  /verify   │  │ POST   /tasks │  │ POST /internal│
              │ GET  /me       │  │ PUT    /tasks │  │ GET  /stats   │
              └───────┬────────┘  └───────┬───────┘  └───────┬───────┘
                      │                   │                   │
                      └───────────────────┴───────────────────┘
                                          │
                                          ▼
                        ┌─────────────────────────────────────────────────┐
                        │              PostgreSQL (port 5432)              │
                        │                                                  │
                        │  tables: users │ tasks │ logs                   │
                        └─────────────────────────────────────────────────┘

                        ┌─────────────────────────────────────────────────┐
                        │            frontend (Static Files)               │
                        │         nginx:alpine — port 80 (internal)        │
                        │         index.html │ logs.html                   │
                        └─────────────────────────────────────────────────┘

  Network: taskboard-net (Docker bridge — services คุยกันด้วยชื่อ container)
```

---

## 🚀 วิธีรัน

### 1. สร้าง Self-signed Certificate (ครั้งแรกเท่านั้น)
```bash
chmod +x ./scripts/gen-certs.sh
./scripts/gen-certs.sh
```

### 2. ตั้งค่า Environment Variables
```bash
cp .env.example .env
# แก้ไข .env ถ้าต้องการเปลี่ยน password หรือ JWT_SECRET
```

### 3. Build และ Start ทุก Container
```bash
docker compose up --build
```

### 4. เข้าใช้งาน
- **Web UI:** https://localhost (กด Advanced → Proceed เพราะใช้ self-signed cert)
- **API:** https://localhost/api/auth/login

### หยุดระบบ
```bash
docker compose down        # หยุด containers
docker compose down -v     # หยุด + ลบ database volume (reset ข้อมูล)
```

---

## 👤 Seed Users

| Username | Email | Password | Role |
|----------|-------|----------|------|
| alice | alice@lab.local | alice123 | member |
| bob | bob@lab.local | bob456 | member |
| admin | admin@lab.local | adminpass | admin |

> ⚠️ passwords ถูก hash ด้วย bcrypt (saltRounds=10) ก่อนเก็บใน DB

---

## 🔒 HTTPS ทำงานอย่างไรในระบบนี้

### ภาพรวม
ระบบนี้ใช้ **TLS Termination ที่ Nginx** หมายความว่า HTTPS ถูกจัดการทั้งหมดที่ Nginx ส่วน services ด้านหลัง (auth, task, log) คุยกันด้วย HTTP ปกติภายใน Docker network ที่ปลอดภัย

### ขั้นตอนการทำงาน

```
Browser ──HTTPS──▶ Nginx ──HTTP──▶ auth-service
                  (TLS จบที่นี่)   task-service
                                   log-service
```

1. **Certificate Generation** — `scripts/gen-certs.sh` สร้าง self-signed certificate (`cert.pem` + `key.pem`) ด้วย OpenSSL สำหรับ `localhost`

2. **HTTP → HTTPS Redirect** — Nginx รับ request ที่ port 80 แล้ว redirect ด้วย `301` ไปที่ port 443 ทุกครั้ง

3. **TLS Termination** — Nginx ถอดรหัส HTTPS และส่งต่อเป็น HTTP ไปยัง services ภายใน Docker network (`taskboard-net`)

4. **TLS Configuration** ที่ใช้:
   - Protocol: `TLSv1.2` และ `TLSv1.3` เท่านั้น (ปิด TLS 1.0/1.1)
   - `ssl_prefer_server_ciphers on` — ให้ server เลือก cipher ที่ปลอดภัยกว่า
   - `ssl_session_cache shared:SSL:10m` — cache TLS session เพื่อประสิทธิภาพ

5. **Security Headers** ที่ส่งทุก response:
   - `Strict-Transport-Security` — บังคับ HTTPS ต่อไปอีก 1 ปี
   - `X-Frame-Options: DENY` — ป้องกัน clickjacking
   - `X-Content-Type-Options: nosniff` — ป้องกัน MIME sniffing
   - `X-XSS-Protection` — เปิด XSS filter ของ browser

6. **Rate Limiting** ที่ Nginx:
   - `/api/auth/login` → 5 requests/นาที (ป้องกัน brute force)
   - `/api/*` → 30 requests/นาที (ป้องกัน DDoS)
   - เกิน limit → ตอบ `429 Too Many Requests`

### ทำไมถึง Self-signed?
เนื่องจากเป็น development environment บน `localhost` จึงไม่สามารถใช้ Certificate Authority จริง (เช่น Let's Encrypt) ได้ Browser จะแสดง warning ว่า "Not Secure" ซึ่งเป็นเรื่องปกติสำหรับ local dev

---

## 📁 โครงสร้างโปรเจกต์

```
engce301_final/
├── auth-service/          # JWT Authentication Service (port 3001)
│   ├── src/
│   │   ├── routes/auth.js     # POST /login, GET /verify, GET /me
│   │   ├── middleware/
│   │   │   └── jwtUtils.js    # generateToken, verifyToken
│   │   └── db/db.js           # PostgreSQL connection pool
│   └── Dockerfile
├── task-service/          # Task CRUD Service (port 3002)
│   ├── src/
│   │   ├── routes/task.js     # GET/POST/PUT/DELETE /tasks
│   │   ├── middleware/
│   │   │   └── authMiddleware.js  # JWT verification middleware
│   │   └── jwtUtils.js        # verifyToken
│   └── Dockerfile
├── log-service/           # Logging Service (port 3003)
│   ├── src/
│   │   └── index.js           # GET /logs, POST /internal
│   └── Dockerfile
├── frontend/              # Static Web UI
│   ├── index.html             # Task Board UI
│   ├── logs.html              # Log Dashboard
│   └── Dockerfile
├── nginx/                 # API Gateway + TLS
│   ├── nginx.conf
│   ├── Dockerfile
│   └── certs/
│       ├── cert.pem
│       └── key.pem
├── db/
│   └── init.sql           # Schema + Seed users
├── scripts/
│   └── gen-certs.sh       # สร้าง self-signed certificate
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🧪 Test Cases

| Test | คำสั่ง | Expected |
|------|--------|----------|
| T3 Login สำเร็จ | `POST /api/auth/login` (alice/alice123) | 200 + JWT token |
| T4 Login ผิด | `POST /api/auth/login` (wrong password) | 401 |
| T5 Create Task | `POST /api/tasks/` (มี JWT) | 201 Created |
| T6 Get Tasks | `GET /api/tasks/` (มี JWT) | 200 + list |
| T7 Update Task | `PUT /api/tasks/:id` (มี JWT) | 200 Updated |
| T8 Delete Task | `DELETE /api/tasks/:id` (มี JWT) | 200 Deleted |
| T9 No JWT | `GET /api/tasks/` (ไม่มี JWT) | 401 Unauthorized |
| T10 View Logs | `GET /api/logs/` (มี JWT) | 200 + log entries |
| T11 Rate Limit | POST login ผิด > 5 ครั้ง/นาที | 429 Too Many Requests |