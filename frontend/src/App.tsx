import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ComplaintsProvider } from './context/ComplaintsContext';
import { AuthProvider } from './context/AuthContext';
import { NotificationsProvider } from './context/NotificationsContext';
import Layout from './components/Layout';
import HomePage from './components/homepage/HomePage';
import ComplaintFormPage from './components/complaintPage/ComplaintFormPage';
import ComplaintDetailPage from './components/homepage/ComplaintDetailPage';
import AboutPage from './components/AboutPage';
import ProfilePage from './components/profile/ProfilePage';
import ProfileComplaintDetailPage from './components/profile/ProfileComplaintDetailPage';
import EditComplaintPage from './components/profile/EditComplaintPage';
import SignupPage from './components/auth/SignupPage';
import LoginPage from './components/auth/LoginPage';
import ForgotPasswordPage from './components/auth/ForgotPasswordPage';
import { NotificationsPage } from './components/notifications';

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationsProvider>
          <ComplaintsProvider>
            <Router>
              <Routes>
                {/* Auth Routes - No Layout */}
                <Route path="/" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                
                {/* Main Routes - With Layout */}
                <Route path="/home" element={<Layout><HomePage /></Layout>} />
                <Route path="/complaint" element={<Layout><ComplaintFormPage /></Layout>} />
                <Route path="/complaint/:id" element={<Layout><ComplaintDetailPage /></Layout>} />
                <Route path="/about" element={<Layout><AboutPage /></Layout>} />
                <Route path="/profile" element={<Layout><ProfilePage /></Layout>} />
                <Route path="/profile/complaint/:id" element={<Layout><ProfileComplaintDetailPage /></Layout>} />
                <Route path="/profile/complaint/:id/edit" element={<Layout><EditComplaintPage /></Layout>} />
                <Route path="/notifications" element={<Layout><NotificationsPage /></Layout>} />
              </Routes>
            </Router>
          </ComplaintsProvider>
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
