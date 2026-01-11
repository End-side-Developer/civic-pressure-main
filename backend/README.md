# Civic Pressure - Backend API

Node.js + Express + TypeScript backend with Firebase Firestore database.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Set Up Firebase Service Account

You need a Firebase service account to authenticate the backend with Firestore.

#### Option A: Download Service Account Key (Recommended)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **civic-pressure**
3. Go to **Project Settings** (gear icon) → **Service Accounts**
4. Click **"Generate new private key"**
5. Save the downloaded JSON file as `serviceAccountKey.json` in the `backend` folder

#### Option B: Use Environment Variables

1. Copy the credentials from the downloaded JSON file
2. Update the `.env` file:

```env
FIREBASE_PROJECT_ID=civic-pressure
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@civic-pressure.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...your key...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=civic-pressure.firebasestorage.app
GOOGLE_API_KEY=your-google-generative-ai-api-key
```

> **Note:** The `GOOGLE_API_KEY` is required for the AI-based duplicate detection feature and AI description improvement. Get it from [Google AI Studio](https://aistudio.google.com/app/apikey).

### 3. Start the Development Server

```bash
npm run dev
```

The server will start at `http://localhost:5000`

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── firebase.ts      # Firebase Admin initialization
│   ├── controllers/
│   │   ├── complaintController.ts  # Complaint CRUD operations
│   │   ├── userController.ts       # User profile operations
│   │   └── notificationController.ts
│   ├── middleware/
│   │   ├── auth.ts          # JWT token verification
│   │   └── upload.ts        # File upload with Multer
│   ├── routes/
│   │   ├── complaintRoutes.ts
│   │   ├── userRoutes.ts
│   │   └── notificationRoutes.ts
│   ├── types/
│   │   └── index.ts         # TypeScript interfaces
│   ├── app.ts               # Express app configuration
│   └── server.ts            # Server entry point
├── uploads/                 # Temporary file uploads
├── .env                     # Environment variables
├── package.json
└── tsconfig.json
```

## 🔌 API Endpoints

### Complaints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/complaints` | Get all complaints (with filters) | Optional |
| GET | `/api/complaints/:id` | Get complaint by ID | Optional |
| POST | `/api/complaints` | Create new complaint | Required |
| PUT | `/api/complaints/:id` | Update complaint | Required |
| DELETE | `/api/complaints/:id` | Delete complaint | Required |
| POST | `/api/complaints/:id/vote` | Vote for complaint | Required |
| POST | `/api/complaints/:id/support` | Support complaint (duplicate flow) | Required |
| POST | `/api/complaints/check-duplicate` | Check for similar complaints | Rate Limited |
| POST | `/api/complaints/:id/insights` | Add insight request | Required |
| POST | `/api/complaints/:id/insights/:insightId/reply` | Reply to insight | Required |
| POST | `/api/complaints/:id/photos` | Add photo to complaint | Required |
| GET | `/api/complaints/user/my-complaints` | Get user's complaints | Required |

### Users

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/users/profile` | Get current user profile | Required |
| PUT | `/api/users/profile` | Update user profile | Required |
| GET | `/api/users/stats` | Get user statistics | Required |
| GET | `/api/users/:userId/public` | Get public profile | Optional |
| DELETE | `/api/users/account` | Delete account | Required |

### Notifications

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/notifications` | Get notifications | Required |
| PUT | `/api/notifications/:id/read` | Mark as read | Required |
| PUT | `/api/notifications/read-all` | Mark all as read | Required |
| DELETE | `/api/notifications/:id` | Delete notification | Required |

### AI

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/ai/health` | Check AI service status | Optional |
| POST | `/api/ai/improve-description` | Improve complaint description using AI | Required |

#### POST /api/ai/improve-description

Request body:
```json
{
  "description": "garbage problem near my house pls clean fast",
  "title": "Garbage Issue",
  "sector": "SANITATION"
}
```

Response:
```json
{
  "success": true,
  "improvedDescription": "I would like to report an ongoing garbage accumulation issue in the vicinity of my residence. The uncollected waste is creating unsanitary conditions and requires urgent attention from the sanitation department. I kindly request prompt action to address this matter.",
  "processingTimeMs": 1234
}
```

**Rate Limit:** 10 requests per minute per user

## 📋 Query Parameters

### GET /api/complaints

| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 10) |
| status | string | Filter by status |
| category | string | Filter by category |
| sortBy | string | Sort field (createdAt, votes, views) |
| sortOrder | string | 'asc' or 'desc' |
| search | string | Search in title/description |

## 🔐 Authentication

The API uses Firebase Authentication. Include the Firebase ID token in the Authorization header:

```
Authorization: Bearer <firebase-id-token>
```

## 🗄️ Firestore Collections

### complaints
```javascript
{
  id: string,
  title: string,
  description: string,
  category: string,
  status: string,
  location: string,
  coordinates: { latitude: number, longitude: number },
  userId: string,
  userDisplayName: string,
  isAnonymous: boolean,
  images: string[],
  votes: number,
  votedBy: string[],
  views: number,
  priorityScore: string,
  statusHistory: StatusHistoryItem[],
  insightRequests: InsightRequest[],
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### users
```javascript
{
  uid: string,
  email: string,
  displayName: string,
  photoURL: string,
  phone: string,
  bio: string,
  address: string,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### notifications
```javascript
{
  id: string,
  userId: string,
  type: string,
  title: string,
  message: string,
  relatedId: string,
  read: boolean,
  createdAt: Timestamp
}
```

## 🛠️ Available Scripts

```bash
# Development with hot-reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## ⚙️ Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 5000 |
| NODE_ENV | Environment | development |
| FIREBASE_PROJECT_ID | Firebase project ID | civic-pressure |
| FIREBASE_CLIENT_EMAIL | Service account email | - |
| FIREBASE_PRIVATE_KEY | Service account private key | - |
| FIREBASE_STORAGE_BUCKET | Storage bucket URL | civic-pressure.firebasestorage.app |
| FRONTEND_URL | Frontend URL for CORS | http://localhost:3000 |
