## `README.md` (Backend – **IMPORTANT**)

```md
# SmartLivestock Connect – Backend API

This repository contains the **backend REST API** for the SmartLivestock Connect system.
It handles authentication, livestock records, disease reporting, geo-location services,
and integration with the ML diagnostic service.

---

## 🚀 Tech Stack

- Node.js
- Express.js
- TypeScript
- PostgreSQL / MySQL (via Knex or ORM)
- JWT Authentication
- REST API Architecture

---

## 🗄️ Database Schema

### Tables

#### `users`
- id (PK)
- name
- email
- password_hash
- role (`farmer | vet | agro`)
- created_at

#### `animals`
- id (PK)
- farmer_id (FK → users.id)
- species
- age
- weight
- created_at

#### `symptom_reports`
- id (PK)
- animal_id (FK → animals.id)
- symptom_text
- status (`received | reviewed | resolved`)
- created_at

#### `vets`
- id (PK)
- user_id (FK → users.id)
- latitude
- longitude
- phone

#### `agrovets`
- id (PK)
- user_id (FK → users.id)
- latitude
- longitude
- phone

#### `products`
- id (PK)
- agrovet_id (FK → agrovets.id)
- name
- price
- created_at

---

## 🔗 API Routes

### Auth
- `POST /api/auth/login`
- `POST /api/auth/register`

---

### Farmer
- `POST /api/symptoms/report`
- `GET /api/services/nearby?lat=&lng=`

---

### Vet
- `GET /api/vet/reports/pending`
- `GET /api/vet/reports/:id`
- `PUT /api/vet/reports/:id/status`

---

### Agro-vet
- `POST /api/agro/products`
- `GET /api/agro/products`

---

### ML Integration
- `POST /api/ml/predict`
  - Forwards symptoms to ML service
  - Receives predicted disease + confidence

---

## 🧠 ML Service Integration

The backend communicates with the ML service over HTTP.

Example:
```http
POST http://localhost:5000/predict
Payload:

json
Copy code
{
  "symptoms": "loss of appetite, fever"
}
Response:

json
Copy code
{
  "disease": "Foot and Mouth Disease",
  "confidence": 0.82
}
🔧 Setup Instructions
bash
Copy code
npm install
npm run migrate
npm run dev
📦 Environment Variables
env
Copy code
PORT=4000
DB_URL=postgres://...
JWT_SECRET=your_secret
ML_SERVICE_URL=http://localhost:5000
📌 Related Repositories
Frontend: smartlivestock-frontend

ML Service: smartlivestock-ml-service
here is update .evn file 
# Server Configuration
PORT=
NODE_ENV=development

# Database Configuration
# Option 1: Use individual DB variables
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=
DB_NAME=

# Option 2: Use DATABASE_URL (uncomment and adjust if using Docker/cloud DB)
# DATABASE_URL=postgres://postgres:postgres@localhost:5432

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production

# ML Service Integration
ML_SERVICE_URL=http://localhost:8001

# Optional: Debug mode
DEBUG=false
#communication
# PRIMARY PROVIDER
SMS_PRIMARY_PROVIDER=blessed_texts

# Umesikia
UMESIKIA_API_KEY=
UMESIKIA_APP_ID=UMSC618327
UMESIKIA_SENDER_ID=UMS_SMS
UMESIKIA_ENDPOINT=https://comms.umeskiasoftwares.com/api/v1/sms/send

# BlessedTexts
BLESSED_API_KEY=
BLESSED_SENDER_ID=FERRITE
BLESSED_ENDPOINT=https://sms.blessedtexts.com/api/sms/v1/sendsms

# Failover
SMS_ENABLE_FAILOVER=true
#gmail stmp credentials and also update
# Example for Gmail:
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your gmail account
SMTP_PASS=
SMTP_FROM=SmartLivestock <stevenkibet911@gmail.com>

#frontend end intergration
FRONTEND_ORIGIN=http://localhost:5173,http://localhost:5174
