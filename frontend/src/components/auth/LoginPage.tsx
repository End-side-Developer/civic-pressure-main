import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, AlertTriangle, ArrowRight, Sparkles, TrendingUp, Bell, Heart, Info } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/images/logo.png';
import heroImage from '../../assets/images/Image.png';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, signInWithGoogle, isConfigured } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [linkWithGoogleMessage, setLinkWithGoogleMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLinkWithGoogleMessage('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/home');
    } catch (err: any) {
      const message = err.message || 'Failed to sign in';
      // Check if this is a link-with-google message
      if (message.startsWith('LINK_WITH_GOOGLE:')) {
        setLinkWithGoogleMessage(message.replace('LINK_WITH_GOOGLE:', ''));
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLinkWithGoogleMessage('');
    setLoading(true);

    try {
      await signInWithGoogle();
      navigate('/home');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: TrendingUp, text: 'Track your complaint progress' },
    { icon: Bell, text: 'Get real-time notifications' },
    { icon: Heart, text: 'Support community issues' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40"
          style={{ backgroundImage: `url(${heroImage})` }}
        />

        {/* Content */}
        <div className="relative z-20 flex flex-col p-12 w-full justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center p-2">
              <img src={logo} alt="Civic Pressure Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-2xl font-bold text-white">Civic Pressure</span>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-6 w-fit">
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <span className="text-white/90 text-sm font-medium">Welcome back!</span>
            </div>
            <h1 className="text-5xl font-bold text-white leading-tight mb-4">
              Your Voice,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-purple-200">
                Amplified.
              </span>
            </h1>
            <p className="text-blue-100 text-lg leading-relaxed max-w-md mb-8">
              Continue making an impact. Your community needs your voice now more than ever.
            </p>

            {/* Features */}
            <div className="space-y-4">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center">
                    <feature.icon className="w-5 h-5 text-blue-200" />
                  </div>
                  <span className="text-white/90 font-medium">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 xs:p-6 bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 xs:gap-3 mb-6 xs:mb-8">
            <div className="w-9 xs:w-10 h-9 xs:h-10 bg-blue-600 rounded-xl flex items-center justify-center p-1.5 flex-shrink-0">
              <img src={logo} alt="Civic Pressure Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-lg xs:text-xl font-bold text-gray-900 dark:text-white">Civic Pressure</span>
          </div>

          {/* Header */}
          <div className="text-center mb-6 xs:mb-8">
            <h2 className="text-2xl xs:text-3xl font-bold text-gray-900 dark:text-white mb-1.5 xs:mb-2">Welcome back</h2>
            <p className="text-sm xs:text-base text-gray-500 dark:text-gray-400">
              Don't have an account?{' '}
              <Link to="/signup" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                Sign up
              </Link>
            </p>
          </div>

          {/* Firebase Warning */}
          {!isConfigured && (
            <div className="mb-4 xs:mb-6 p-3 xs:p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl xs:rounded-2xl flex items-start gap-2 xs:gap-3">
              <AlertTriangle className="w-4 xs:w-5 h-4 xs:h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-amber-800 dark:text-amber-200 text-xs xs:text-sm font-semibold">Firebase not configured</p>
                <p className="text-amber-700 dark:text-amber-300 text-xs mt-0.5">
                  Add your Firebase credentials to .env file to enable authentication.
                </p>
              </div>
            </div>
          )}

          {/* Link with Google Info */}
          {linkWithGoogleMessage && (
            <div className="mb-4 xs:mb-6 p-3 xs:p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl xs:rounded-2xl flex items-start gap-2 xs:gap-3">
              <Info className="w-4 xs:w-5 h-4 xs:h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-blue-800 dark:text-blue-200 text-xs xs:text-sm font-medium">{linkWithGoogleMessage}</p>
                <p className="text-blue-600 dark:text-blue-300 text-xs mt-1">
                  Your password will be linked automatically after signing in with Google.
                </p>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="mb-4 xs:mb-6 p-3 xs:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl xs:rounded-2xl flex items-center gap-2 xs:gap-3">
              <AlertCircle className="w-4 xs:w-5 h-4 xs:h-5 text-red-500 flex-shrink-0" />
              <p className="text-red-600 dark:text-red-400 text-xs xs:text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Google Sign In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 xs:gap-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 px-4 xs:px-6 py-3 xs:py-4 rounded-xl xs:rounded-2xl font-semibold text-sm xs:text-base text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-750 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 mb-4 xs:mb-6 disabled:opacity-50 group active:scale-[0.98] min-h-[48px]"
          >
            <svg className="w-4 xs:w-5 h-4 xs:h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span>Continue with Google</span>
            <ArrowRight className="w-3 xs:w-4 h-3 xs:h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 xs:gap-4 mb-4 xs:mb-6">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent"></div>
            <span className="text-gray-400 dark:text-gray-500 text-xs xs:text-sm font-medium whitespace-nowrap">or continue with email</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent"></div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3 xs:space-y-4">
            {/* Email Field */}
            <div className="relative">
              <div className={`absolute left-3 xs:left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focusedField === 'email' ? 'text-blue-500' : 'text-gray-400'}`}>
                <Mail className="w-4 xs:w-5 h-4 xs:h-5" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                placeholder="Email address"
                required
                className="w-full pl-10 xs:pl-12 pr-3 xs:pr-4 py-3 xs:py-4 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl xs:rounded-2xl text-sm xs:text-base text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-0 outline-none transition-all duration-200 min-h-[48px]"
              />
            </div>

            {/* Password Field */}
            <div className="relative">
              <div className={`absolute left-3 xs:left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focusedField === 'password' ? 'text-blue-500' : 'text-gray-400'}`}>
                <Lock className="w-4 xs:w-5 h-4 xs:h-5" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                placeholder="Password"
                required
                className="w-full pl-10 xs:pl-12 pr-10 xs:pr-12 py-3 xs:py-4 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl xs:rounded-2xl text-sm xs:text-base text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-0 outline-none transition-all duration-200 min-h-[48px]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 xs:right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                {showPassword ? <EyeOff className="w-4 xs:w-5 h-4 xs:h-5" /> : <Eye className="w-4 xs:w-5 h-4 xs:h-5" />}
              </button>
            </div>

            {/* Forgot Password */}
            <div className="text-right">
              <Link to="/forgot-password" className="text-xs xs:text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline py-1 inline-block">
                Forgot password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 xs:px-6 py-3 xs:py-4 rounded-xl xs:rounded-2xl font-semibold text-sm xs:text-base transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group active:scale-[0.98] min-h-[48px]"
            >
              {loading ? (
                <>
                  <div className="w-4 xs:w-5 h-4 xs:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 xs:w-5 h-4 xs:h-5 group-hover:translate-x-1 transition-transform duration-200" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-gray-400 dark:text-gray-500 text-xs mt-6 xs:mt-8">
            © 2025 Civic Pressure. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
