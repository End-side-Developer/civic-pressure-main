# Civic Pressure - Frontend

A modern React TypeScript application for civic engagement and community complaint management. Citizens can report civic issues, track their status, vote on similar complaints, and engage with their community.

## 🚀 Tech Stack

- **React 18** - UI library with functional components and hooks
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Firebase Authentication** - User authentication and authorization
- **Firebase Firestore** - Real-time database
- **React Router v7** - Client-side routing
- **Axios** - HTTP client for API requests
- **Google Maps** - Interactive maps for complaint locations
- **Lucide React** - Modern icon library

## 📋 Features

- 🔐 **User Authentication** - Sign up, login, password reset with Firebase
- 📝 **Complaint Management** - Create, edit, delete, and track civic complaints
- 🗺️ **Location Mapping** - Interactive maps to pinpoint complaint locations
- 🔍 **Duplicate Detection** - AI-powered similarity check to avoid duplicate complaints
- 👍 **Voting System** - Vote for complaints to increase their priority
- 🔔 **Real-time Notifications** - Get notified about complaint status updates
- 📊 **User Dashboard** - Track your complaints and activity
- 🌓 **Dark/Light Mode** - Theme switching support
- 📱 **Responsive Design** - Works seamlessly on mobile and desktop

## 🏗️ Getting Started

### Prerequisites

- **Node.js** v16 or higher
- **npm** or **yarn**
- Firebase project configured (see backend README)

### Installation

1. **Clone the repository** (if not already done):
```bash
git clone <repository-url>
cd civic-pressure/frontend
```

2. **Install dependencies**:
```bash
npm install
```

3. **Configure Firebase**:

Create or update `src/config/firebase.ts` with your Firebase configuration:

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
```

4. **Set Backend API URL**:

Update `src/services/api.ts` to point to your backend:

```typescript
const API_BASE_URL = 'http://localhost:5000/api';
```

5. **Start the development server**:
```bash
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000)

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Runs the app in development mode at localhost:3000 |
| `npm build` | Builds the app for production to the `build/` folder |
| `npm test` | Runs the test suite |
| `npm eject` | Ejects from Create React App (⚠️ one-way operation) |

## 📁 Project Structure

```
frontend/
├── public/
│   └── index.html                 # HTML template
├── src/
│   ├── assets/
│   │   └── images/                # Image assets
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx      # Login page
│   │   │   ├── SignupPage.tsx     # Registration page
│   │   │   └── ForgotPasswordPage.tsx
│   │   ├── complaintPage/
│   │   │   ├── ComplaintFormPage.tsx      # Complaint creation
│   │   │   ├── ComplaintFormModal.tsx     # Edit modal
│   │   │   ├── GoogleMapPicker.tsx        # Location picker
│   │   │   ├── ComplaintLocationMap.tsx   # Location display
│   │   │   └── DuplicateCheckPanel.tsx    # Duplicate detection UI
│   │   ├── homepage/
│   │   │   ├── HomePage.tsx               # Main feed
│   │   │   └── ComplaintDetailPage.tsx    # Single complaint view
│   │   ├── profile/
│   │   │   ├── ProfilePage.tsx            # User profile
│   │   │   ├── EditComplaintPage.tsx      # Edit user complaints
│   │   │   └── ProfileComplaintDetailPage.tsx
│   │   ├── notifications/
│   │   │   ├── NotificationBell.tsx       # Notification icon
│   │   │   ├── NotificationsPage.tsx      # Notifications list
│   │   │   └── NotificationSettings.tsx   # Settings
│   │   ├── Layout.tsx                     # Main layout wrapper
│   │   └── AboutPage.tsx
│   ├── context/
│   │   ├── AuthContext.tsx                # Authentication state
│   │   ├── ComplaintsContext.tsx          # Complaints state
│   │   ├── NotificationsContext.tsx       # Notifications state
│   │   └── ThemeContext.tsx               # Theme state
│   ├── services/
│   │   └── api.ts                         # API client with Axios
│   ├── config/
│   │   └── firebase.ts                    # Firebase configuration
│   ├── App.tsx                            # Root component
│   ├── index.tsx                          # App entry point
│   └── index.css                          # Global styles
├── build/                                 # Production build output
├── package.json
├── tsconfig.json
├── tailwind.config.js                     # Tailwind configuration
└── postcss.config.js
```

## 🎨 Environment Variables

The frontend uses Firebase configuration directly in `src/config/firebase.ts`. No `.env` file is required, but you can optionally use one:

```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id
```

## 🔧 Customization

### Tailwind Configuration

Edit `tailwind.config.js` to customize colors, fonts, and other design tokens:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6',
        secondary: '#8B5CF6',
        accent: '#10B981',
      },
    },
  },
}
```

### API Configuration

Update the backend URL in `src/services/api.ts`:

```typescript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
```

## 🌐 Deployment

### Build for Production

```bash
npm run build
```

This creates an optimized production build in the `build/` folder.

### Deploy to Firebase Hosting

```bash
firebase deploy --only hosting
```

### Deploy to Other Platforms

The `build/` folder can be deployed to:
- Vercel
- Netlify
- AWS S3 + CloudFront
- Any static hosting service

## 📖 Usage

1. **Sign Up / Login** - Create an account or login with existing credentials
2. **Report a Complaint** - Click "New Complaint", fill details, and select location on map
3. **Check for Duplicates** - The system will show similar complaints to avoid duplicates
4. **Vote for Complaints** - Support existing complaints by voting
5. **Track Progress** - View status updates and notifications on your complaints
6. **Manage Profile** - Update your profile and view your complaint history

## 🔗 Related Documentation

- [Backend README](../backend/README.md)
- [Main README](../README.md)

## 📄 License

MIT
