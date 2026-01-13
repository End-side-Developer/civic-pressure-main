# 🏛️ Civic Pressure

A modern web platform that empowers citizens to report and track civic issues in their communities. Built with React, Node.js, Firebase, and AI-powered features for intelligent complaint management.

## 📖 Overview

**Civic Pressure** is a citizen complaint management system that bridges the gap between communities and local governance. Citizens can report civic issues (like garbage problems, road damage, water supply issues, etc.), track their resolution status, and engage with their community through voting and support mechanisms.

### Key Features

- 📝 **Report Civic Issues** - Easy-to-use complaint submission with location mapping
- 🤖 **AI-Powered Duplicate Detection** - Automatically identifies similar complaints using semantic embeddings
- ✨ **AI Description Enhancement** - Improves complaint descriptions using Google Gemini AI
- 🗺️ **Interactive Maps** - Visualize complaint locations using Google Maps
- 👍 **Community Voting** - Vote on complaints to increase their priority
- 🔔 **Real-time Notifications** - Stay updated on complaint status changes
- 📊 **User Dashboard** - Track your complaints and community engagement
- 🔐 **Secure Authentication** - Firebase-based user authentication
- 📸 **Multi-Image Upload** - Attach multiple photos to complaints
- 🌓 **Dark/Light Mode** - Customizable theme support

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────────┐  │
│  │   React    │  │  Firebase  │  │  Google Maps         │  │
│  │ TypeScript │  │    Auth    │  │                      │  │
│  │  Tailwind  │  │  Firestore │  │                      │  │
│  └────────────┘  └────────────┘  └──────────────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │ REST API (Axios)
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                   Backend (Node.js/Express)                  │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────────┐  │
│  │  Express   │  │  Firebase  │  │   Google Gemini AI   │  │
│  │ TypeScript │  │   Admin    │  │   TensorFlow.js      │  │
│  │   Multer   │  │  Firestore │  │ Semantic Embeddings  │  │
│  └────────────┘  └────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                     Firebase Services                        │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │  Firestore  │ │   Storage    │ │   Authentication     │ │
│  │  (Database) │ │  (Images)    │ │    (Auth)            │ │
│  └─────────────┘ └──────────────┘ └──────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Tech Stack

### Frontend
- **React 18** with **TypeScript** - Component-based UI
- **Tailwind CSS** - Utility-first styling
- **Firebase SDK** - Authentication and Firestore client
- **React Router v7** - Client-side routing
- **Axios** - HTTP client
- **@react-google-maps/api** - Interactive mapping
- **Lucide React** - Icon library

### Backend
- **Node.js** with **Express.js** - REST API server
- **TypeScript** - Type-safe backend development
- **Firebase Admin SDK** - Server-side Firebase integration
- **Google Generative AI (Gemini)** - AI description improvement
- **TensorFlow.js + Universal Sentence Encoder** - Semantic similarity
- **Multer** - File upload handling
- **Express Rate Limit** - API protection
- **Zod** - Runtime validation

### Database & Services
- **Firebase Firestore** - NoSQL document database
- **Firebase Storage** - Image storage
- **Firebase Authentication** - User management

## 📦 Project Structure

```
civic-pressure/
├── frontend/                # React frontend application
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── context/         # Context providers (Auth, Complaints, Notifications)
│   │   ├── services/        # API services
│   │   └── config/          # Firebase config
│   └── package.json
│
├── backend/                 # Node.js backend API
│   ├── src/
│   │   ├── controllers/     # Request handlers
│   │   ├── routes/          # API routes
│   │   ├── middleware/      # Auth & upload middleware
│   │   ├── services/        # AI & embedding services
│   │   ├── config/          # Firebase admin config
│   │   └── types/           # TypeScript types
│   └── package.json
│
├── firebase.json            # Firebase configuration
├── firestore.rules          # Firestore security rules
├── firestore.indexes.json   # Firestore indexes
└── storage.rules            # Storage security rules
```

## 🎯 Getting Started

### Prerequisites

- **Node.js** v16 or higher
- **npm** or **yarn**
- **Firebase account** with a project created
- **Google AI API key** (for AI features)

### Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/civic-pressure.git
cd civic-pressure
```

#### 2. Set Up Backend

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` folder:

```env
PORT=5000
NODE_ENV=development
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
GOOGLE_API_KEY=your-google-ai-api-key
FRONTEND_URL=http://localhost:3000
```

Download your Firebase service account key and save it as `serviceAccountKey.json` in the `backend/` folder.

Start the backend server:

```bash
npm run dev
```

The backend will run at `http://localhost:5000`

#### 3. Set Up Frontend

```bash
cd frontend
npm install
```

Configure Firebase in `src/config/firebase.ts` with your Firebase project credentials.

Start the frontend:

```bash
npm start
```

The frontend will open at `http://localhost:3000`

### Quick Start Guide

1. **Backend**: Follow [backend/README.md](backend/README.md) for detailed setup
2. **Frontend**: Follow [frontend/README.md](frontend/README.md) for detailed setup
3. **Firebase**: Configure Firestore rules and indexes from the root `firestore.rules` and `firestore.indexes.json`

## 📚 Documentation

- 📘 [Frontend Documentation](frontend/README.md) - React app setup, structure, and features
- 📗 [Backend Documentation](backend/README.md) - API endpoints, services, and configuration
- 📙 [API Reference](backend/README.md#-api-endpoints) - Complete API documentation

## 🔌 API Endpoints

### Core Features

- **Complaints API** - CRUD operations, voting, duplicate detection
- **User API** - Profile management, statistics
- **Notifications API** - Real-time notification system
- **AI API** - Description enhancement, duplicate detection
- **Contact API** - Contact form submissions

### Example Request

```bash
# Get all complaints
curl http://localhost:5000/api/complaints

# Create a complaint (requires authentication)
curl -X POST http://localhost:5000/api/complaints \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Broken Street Light",
    "description": "Street light on Main St is not working",
    "category": "INFRASTRUCTURE",
    "location": "Main Street, City",
    "coordinates": {"latitude": 40.7128, "longitude": -74.0060}
  }'
```

See [Backend API Documentation](backend/README.md#-api-endpoints) for complete endpoint details.

## 🤖 AI Features

### 1. Duplicate Detection
Uses **TensorFlow Universal Sentence Encoder** to generate semantic embeddings and identify similar complaints based on:
- Title similarity
- Description similarity
- Location proximity
- Category matching

### 2. Description Enhancement
Leverages **Google Gemini AI** to:
- Improve grammar and clarity
- Maintain original intent
- Format professionally
- Preserve key details

## 🔒 Security

- **Firebase Authentication** - Secure user authentication
- **JWT Token Verification** - Protected API endpoints
- **Firestore Security Rules** - Database-level security
- **Storage Rules** - Secure file uploads
- **Rate Limiting** - API abuse prevention
- **Input Validation** - Zod schema validation

## 🚢 Deployment

### Frontend Deployment

**Firebase Hosting:**
```bash
cd frontend
npm run build
firebase deploy --only hosting
```

**Other Platforms:** Vercel, Netlify, AWS S3 + CloudFront

### Backend Deployment

**Google Cloud Run:**
```bash
cd backend
gcloud run deploy civic-pressure-api --source .
```

**Other Platforms:** Heroku, AWS EC2, DigitalOcean

See individual README files for detailed deployment instructions.

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
```

### Frontend Tests
```bash
cd frontend
npm test
```

## 🛠️ Development Scripts

### Backend
- `npm run dev` - Development server with hot-reload
- `npm run build` - Build for production
- `npm start` - Run production server
- `npm run lint` - Lint code

### Frontend
- `npm start` - Development server
- `npm run build` - Production build
- `npm test` - Run tests

## 📊 Database Schema

### Collections

**complaints**
- User-submitted civic issues with location, images, voting, and status tracking

**users**
- User profiles with statistics and preferences

**notifications**
- Real-time notifications for complaint updates

**embeddings** (optional)
- Cached semantic embeddings for duplicate detection

See [Backend Documentation](backend/README.md#️-firestore-collections) for detailed schema.

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Firebase for backend infrastructure
- Google Generative AI for AI capabilities
- TensorFlow.js for semantic embeddings
- React and the open-source community

## 📞 Support

For issues and questions:
- Create an issue in the GitHub repository

---

**Built with ❤️ for better civic engagement**
