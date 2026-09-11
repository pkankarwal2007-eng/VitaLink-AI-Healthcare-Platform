# 🩺 VitaLink — AI-Powered Healthcare Platform

> **SMARTER HEALTHCARE. CONNECTED.**

VitaLink is a full-stack AI-powered healthcare platform connecting **patients, verified doctors, AI-assisted health guidance, appointments, consultations, prescriptions, medical records, medicine orders, and shipping workflows** in one connected system.

## ✨ Core Features

- 🤖 **AI Health Assistant** — conversational symptom understanding, contextual follow-up questions, general guidance, warning signs, and specialty recommendations.
- 👨‍⚕️ **Verified Doctor Discovery** — search and explore approved doctors by specialization, location, experience, fee, availability, and rating.
- 🛡️ **Doctor Verification** — doctors submit professional information and verification documents for admin review.
- 📅 **Appointment Booking** — book Chat, Video, or Physical consultations with eligible verified doctors.
- 💬 **Chat Consultation** — doctor-patient consultation messaging.
- 🎥 **Video Consultation** — WebRTC-compatible consultation architecture.
- 🏥 **Physical Consultation** — hospital/clinic-based appointment workflow.
- 💊 **Digital Prescriptions** — doctors create prescriptions after consultation.
- 📋 **Digital Medical Records** — centralized healthcare history, consultations, prescriptions, appointments, and documents.
- 🧪 **Test Reports** — patient test-report management.
- 🚚 **Medicine Orders & Delivery** — prescription/medicine ordering with shipping workflow.
- 🚛 **Shipping Partner Dashboard** — authorized order assignment and delivery-status updates.
- 🔔 **Notifications** — appointment, prescription, verification, order, and shipping notifications.
- ⭐ **Reviews & Ratings** — patient feedback for doctors.
- 🛡️ **Private Admin Dashboard** — user, doctor verification, appointment, order, delivery, analytics, and platform management.

## 🔄 Complete Healthcare Journey

```text
Patient Registration
        ↓
AI Health Assistant
        ↓
Understand Health Concern
        ↓
Verified Doctor Discovery
        ↓
Appointment Booking
        ↓
Chat / Video / Physical Consultation
        ↓
Digital Prescription
        ↓
Medical Records / Test Reports
        ↓
Medicine / Prescription Order
        ↓
Shipping Assignment
        ↓
Out for Delivery
        ↓
Delivered
```

## 🤖 AI Health Assistant

The AI is designed as a real conversational LLM workflow rather than fixed symptom if/else responses.

Example:

```text
Patient: I have pain in my back.

AI: Which side is the pain on?

Patient: Mostly the right side.

AI: How long have you had it?
    Is it sharp, dull, burning, or aching?
    Did it begin after an injury or physical activity?
```

The backend can request structured responses such as:

```json
{
  "summary": "",
  "possibleConcerns": [],
  "generalGuidance": [],
  "warningSigns": [],
  "recommendedSpecialty": "",
  "needsDoctor": false,
  "urgent": false
}
```

AI safety principles:

- General health information only
- No definitive diagnosis
- Ask clarifying questions when needed
- Identify warning signs
- Recommend professional evaluation when appropriate
- Recommend emergency care for emergencies
- Do not fabricate medical records
- Do not claim certainty without evidence
- AI does not replace a qualified healthcare professional

## 👨‍⚕️ Doctor Verification Workflow

```text
Doctor Registration
       ↓
Doctor Profile
       ↓
Verification Documents
       ↓
Submit Request
       ↓
Admin Review
       ↓
Approve / Reject / Request Changes
       ↓
Verified Doctor
       ↓
Public Doctor Discovery
```

Only approved and verified doctors are intended to be publicly discoverable/bookable.

## 📅 Appointment Workflow

Patients select:

1. Doctor
2. Date
3. Available time
4. Consultation type
5. Reason for consultation
6. Confirmation

Consultation types:

- Chat
- Video
- Physical

Appointment states:

```text
Pending
Confirmed
Cancelled
Rejected
Completed
No-show
```

The appointment workflow is designed to prevent past-slot booking, double booking, overlapping appointments, and booking with an ineligible doctor.

## 👥 Platform Roles

| Feature | Patient | Doctor | Shipping | Admin |
|---|:---:|:---:|:---:|:---:|
| Register / Login | ✅ | ✅ | ✅ | Private |
| AI Health Assistant | ✅ | — | — | — |
| Find Doctors | ✅ | — | — | Manage |
| Doctor Verification | — | Submit | — | Review |
| Appointments | ✅ | Manage | — | Manage |
| Chat Consultation | ✅ | ✅ | — | — |
| Video Consultation | ✅ | ✅ | — | — |
| Physical Consultation | ✅ | ✅ | — | — |
| Prescriptions | View | Create | — | Manage |
| Medical Records | View | Manage | — | Manage |
| Test Reports | View | Manage | — | Manage |
| Orders / Delivery | Track | — | Handle | Manage |
| Reviews | Create | View | — | Manage |
| Notifications | ✅ | ✅ | ✅ | ✅ |

## 🛡️ Private Admin

There is **no public Admin registration** and private Admin functionality is not exposed through the public navigation.

Admin authorization is based on the authenticated user's role, not email-only checks.

Admin capabilities include:

- User management
- Doctor verification
- Approve / reject / request changes
- Appointment management
- Order management
- Shipping/delivery management
- Contact inquiries
- Analytics
- Platform workflow management
- Audit-related platform operations

## 🏗️ Architecture

```text
                         ┌─────────────────────┐
                         │       Patient       │
                         └──────────┬──────────┘
                                    ↓
                         ┌─────────────────────┐
                         │ React + Vite        │
                         │ Frontend            │
                         └──────────┬──────────┘
                                    ↓
                              REST / Socket
                                    ↓
                         ┌─────────────────────┐
                         │ Node.js + Express   │
                         │ Backend API         │
                         └──────┬────────┬─────┘
                                ↓        ↓
                         ┌──────────┐  ┌──────────┐
                         │ MongoDB  │  │ Gemini   │
                         │ Atlas    │  │ AI API   │
                         └──────────┘  └──────────┘
```

### AI Architecture

```text
Patient Message
      ↓
Frontend
      ↓
AI Controller
      ↓
AI Safety / Validation
      ↓
AI Service
      ↓
Gemini API
      ↓
Structured Response
      ↓
Patient
```

The Gemini API key remains on the backend and is never exposed to the frontend.

Ollama/local LLM can be added as a future or local-development fallback. A production Render backend cannot automatically access Ollama running on a user's personal `localhost`.

## 🛠️ Technology Stack

### Frontend
- React.js
- Vite
- JavaScript
- React Router
- Axios
- CSS
- Responsive UI
- Icon library

### Backend
- Node.js
- Express.js
- REST APIs
- Mongoose
- JWT
- bcrypt
- dotenv
- Helmet
- CORS
- Morgan
- Validation middleware
- Centralized error handling
- Rate limiting
- File upload validation

### Database
- MongoDB
- MongoDB Atlas
- Mongoose

### AI
- Google Gemini API
- Generative AI
- Large Language Models
- Conversational AI
- Structured AI responses
- AI safety validation

### Communication
- Real-time chat architecture
- Socket.IO
- WebRTC-compatible video consultation architecture

### Deployment
- Vercel — Frontend
- Render — Backend
- MongoDB Atlas — Database

## 📂 Project Structure

```text
VitaLink-AI-Health/
│
├── frontend/
│   ├── public/
│   │   ├── images/
│   │   ├── favicon.png
│   │   └── logo.png
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── context/
│   │   ├── layouts/
│   │   ├── pages/
│   │   │   ├── admin/
│   │   │   ├── auth/
│   │   │   ├── common/
│   │   │   ├── consultation/
│   │   │   ├── doctor/
│   │   │   ├── patient/
│   │   │   ├── public/
│   │   │   └── shipping/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── scripts/
│   ├── tests/
│   ├── uploads/
│   ├── app.js
│   ├── server.js
│   └── package.json
│
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

## ⚙️ Installation

### Clone

```bash
git clone https://github.com/YOUR_USERNAME/VitaLink-AI-Health.git
cd VitaLink-AI-Health
```

### Install dependencies

```bash
npm install
cd frontend
npm install
cd ../backend
npm install
```

## 🔑 Environment Variables

Create the required environment configuration based on `.env.example`.

Example:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_long_random_secret
CLIENT_URL=your_frontend_url
GEMINI_API_KEY=your_gemini_api_key
```

Never commit `.env`, API keys, database credentials, passwords, JWT secrets, or private tokens.

## 🍃 MongoDB Atlas

1. Create a MongoDB Atlas project.
2. Create a cluster.
3. Create a database user.
4. Configure network access.
5. Copy the MongoDB connection string.
6. Add it to the backend environment.
7. Start the backend and verify the database connection.

## ▶️ Run Locally

### Backend

```bash
cd backend
node server.js
```

Backend:

```text
http://localhost:5000
```

### Frontend

Open another terminal:

```bash
cd frontend
npm run dev
```

Vite will display the local frontend URL in the terminal.

## 🔌 API Overview

### Authentication

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/me
```

### AI

```text
POST /api/v1/ai/chat
GET  /api/v1/ai/conversations
GET  /api/v1/ai/conversations/:id
```

### Doctors

```text
POST /api/v1/doctors/profile
GET  /api/v1/doctors
GET  /api/v1/doctors/:id
PUT  /api/v1/doctors/profile
POST /api/v1/doctors/verification
```

### Admin / Verification

```text
GET   /api/v1/admin/doctors/pending
PATCH /api/v1/admin/doctors/:id/approve
PATCH /api/v1/admin/doctors/:id/reject
```

### Appointments

```text
POST  /api/v1/appointments
GET   /api/v1/appointments
GET   /api/v1/appointments/:id
PATCH /api/v1/appointments/:id/status
```

### Prescriptions

```text
POST /api/v1/prescriptions
GET  /api/v1/prescriptions
GET  /api/v1/prescriptions/:id
```

### Medical Records

```text
GET  /api/v1/medical-records
POST /api/v1/medical-records
```

### Orders

```text
POST  /api/v1/orders
GET   /api/v1/orders
GET   /api/v1/orders/:id
PATCH /api/v1/orders/:id/status
```

### Shipping

```text
GET   /api/v1/shipping/assignments
PATCH /api/v1/shipping/assignments/:id
```

### Reviews

```text
POST /api/v1/reviews
GET  /api/v1/doctors/:id/reviews
```

### Contact

```text
POST /api/v1/contact
```

> The route files in `backend/routes/` are the source of truth for the current API surface as the project evolves.

## 🧪 Testing

Major workflows covered by the project include:

```text
✓ Patient registration and login
✓ Patient dashboard
✓ AI Health Assistant
✓ AI response handling
✓ Doctor registration
✓ Doctor profile completion
✓ Verification document upload
✓ Admin authentication
✓ Doctor approval / rejection / request changes
✓ Verified doctor visibility
✓ Doctor login
✓ Appointment booking
✓ Appointment status updates
✓ Chat consultation
✓ Video consultation architecture
✓ Physical consultation
✓ Prescription creation
✓ Patient prescription visibility
✓ Medical records
✓ Test reports
✓ Medicine orders
✓ Shipping partner login
✓ Shipping assignment
✓ Delivery updates
✓ Notifications
✓ Reviews
✓ Logout
✓ Role-based access control
```

Frontend production build:

```bash
npm --prefix frontend run build
```

## 🌐 Deployment

```text
                 Internet
                    ↓
          ┌──────────────────┐
          │ Vercel Frontend  │
          │ React + Vite     │
          └────────┬─────────┘
                   ↓
          ┌──────────────────┐
          │ Render Backend   │
          │ Node + Express   │
          └───────┬─────┬────┘
                  ↓     ↓
          ┌──────────┐ ┌──────────┐
          │ MongoDB  │ │ Gemini   │
          │ Atlas    │ │ API      │
          └──────────┘ └──────────┘
```

## 🏠 Public Home Page

The landing page communicates the platform's main value proposition:

> **SMARTER HEALTHCARE. CONNECTED.**

> Healthcare designed around you.

Main areas:

- AI Health Assistant
- Expert Doctors
- Doctor Appointments
- Online Consultation
- Medicine Delivery
- Digital Medical Records
- Health Monitoring
- Emergency Guidance
- Patient History
- Verified Doctors
- Patient Experience
- FAQ
- Contact

Demo/platform counters such as **10K+ patients, 200+ healthcare professionals, and 5K+ appointments** are configurable presentation values and should not be interpreted as verified production statistics.

## 🔒 Privacy & Medical Safety

VitaLink is a healthcare technology project and should be deployed with appropriate privacy, security, legal, and clinical safeguards before real-world clinical use.

Security principles include:

- JWT authentication
- bcrypt password hashing
- Role-based authorization
- Protected routes
- Server-side secrets
- Input validation
- File validation
- Sensitive endpoint protection
- Protected medical records
- Protected verification documents
- No password exposure
- Centralized error handling
- Environment-based configuration

## 🚧 Future Improvements

- Retrieval-Augmented Generation (RAG)
- AI medical document summarization
- Medical report analysis
- Voice-based AI Health Assistant
- More regional languages
- Dedicated mobile application
- Appointment reminders
- Online payments
- Hospital integration
- Pharmacy integration
- Advanced delivery tracking
- Personalized health history
- Patient analytics
- Emergency symptom escalation
- Advanced healthcare security
- Local LLM / Ollama fallback

## ⚠️ Medical Disclaimer

VitaLink is a technology project demonstrating AI-assisted healthcare workflows.

The AI Health Assistant is **not a doctor**. AI-generated information must not be treated as a medical diagnosis, prescription, or substitute for professional medical advice.

For serious or emergency symptoms, users should contact a qualified healthcare professional or appropriate emergency services.

## 👨‍💻 Author

**Pankaj Kankarwal**

Full-Stack Developer | AI/ML Enthusiast | ECE Student

---

⭐ **VitaLink — Smarter Healthcare. Connected.**
