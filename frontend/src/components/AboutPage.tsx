import React, { useEffect, useState } from 'react';
import { Eye, TrendingUp, Users, FileText, Vote, CheckCircle, Github, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { complaintsAPI, contactAPI } from '../services/api';
import logo from '../assets/images/logo.png';

const AboutPage: React.FC = () => {
  const [stats, setStats] = useState({
    totalComplaints: 0,
    resolvedComplaints: 0,
    uniqueVoters: 0,
    sectorsCovered: 0,
  });
  const [loading, setLoading] = useState(true);

  // Contact form state
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [submittingContact, setSubmittingContact] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await complaintsAPI.getPlatformStats();
        if (response.success && response.data) {
          setStats(response.data);
        }
      } catch (error) {
        console.error('Error fetching platform stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Handle contact form submission
  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingContact(true);
    setContactError('');
    setContactSuccess(false);

    try {
      const response = await contactAPI.submitContactForm(contactForm);
      if (response.success) {
        setContactSuccess(true);
        setContactForm({ name: '', email: '', subject: '', message: '' });
        setTimeout(() => setContactSuccess(false), 5000);
      }
    } catch (error: any) {
      setContactError(error.message || 'Failed to send message. Please try again.');
      setTimeout(() => setContactError(''), 5000);
    } finally {
      setSubmittingContact(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return `${num}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-gray-500 via-gray-600 to-gray-700 overflow-hidden rounded-xl xs:rounded-2xl mx-3 xs:mx-4 md:mx-6 my-3 xs:my-4 md:my-6">
        <div className="relative container mx-auto px-4 xs:px-6 py-12 xs:py-16 md:py-24 text-center text-white">
          <h1 className="text-2xl xs:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 xs:mb-4 leading-tight">
            Democratizing
            <br />
            Accountability
          </h1>
          <p className="text-sm xs:text-base opacity-95 max-w-2xl mx-auto mb-6 xs:mb-8 leading-relaxed px-2">
            Civic Pressure turns individual complaints into collective action. Report issues,
            rally support with votes, and track responses transparently.
          </p>
          <Link
            to="/complaint"
            className="inline-block bg-blue-600 text-white px-6 xs:px-8 py-3 xs:py-3.5 rounded-lg font-semibold hover:bg-blue-700 transition shadow-md text-xs xs:text-sm active:scale-95 min-h-[44px]"
          >
            Join the Cause
          </Link>
        </div>
      </div>

      {/* Mission & Values Section */}
      <div className="py-12 xs:py-16 md:py-20 bg-white dark:bg-gray-800">
        <div className="container mx-auto px-3 xs:px-4 md:px-6">
          <div className="text-center mb-10 xs:mb-12 md:mb-16">
            <span className="text-blue-600 dark:text-blue-400 font-bold text-[10px] xs:text-xs uppercase tracking-widest">
              OUR PURPOSE
            </span>
            <h2 className="text-2xl xs:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mt-2 xs:mt-3 mb-3 xs:mb-4">Mission & Values</h2>
            <p className="text-sm xs:text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed px-2">
              Our mission is simple: make it effortless for citizens to surface local problems and
              impossible for institutions to ignore them. Every voice counts; together, voices turn
              into measurable pressure.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 xs:gap-6 max-w-6xl mx-auto">
            {/* Transparency */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl xs:rounded-2xl p-5 xs:p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-600">
              <div className="w-10 xs:w-12 h-10 xs:h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4 xs:mb-5">
                <Eye className="w-5 xs:w-6 h-5 xs:h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg xs:text-xl font-bold text-gray-900 dark:text-white mb-2 xs:mb-3">Transparency</h3>
              <p className="text-gray-600 dark:text-gray-400 text-xs xs:text-sm leading-relaxed">
                Public voting on issues ensures that the most critical problems rise to the top
                without bias.
              </p>
            </div>

            {/* Impact */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl xs:rounded-2xl p-5 xs:p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-600">
              <div className="w-10 xs:w-12 h-10 xs:h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4 xs:mb-5">
                <TrendingUp className="w-5 xs:w-6 h-5 xs:h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg xs:text-xl font-bold text-gray-900 dark:text-white mb-2 xs:mb-3">Impact</h3>
              <p className="text-gray-600 dark:text-gray-400 text-xs xs:text-sm leading-relaxed">
                Aggregating data from thousands of users forces legitimate and timely responses from
                institutions.
              </p>
            </div>

            {/* Community */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl xs:rounded-2xl p-5 xs:p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-600">
              <div className="w-10 xs:w-12 h-10 xs:h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4 xs:mb-5">
                <Users className="w-5 xs:w-6 h-5 xs:h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg xs:text-xl font-bold text-gray-900 dark:text-white mb-2 xs:mb-3">Community</h3>
              <p className="text-gray-600 dark:text-gray-400 text-xs xs:text-sm leading-relaxed">
                Connecting users with shared concerns creates a powerful collective voice that cannot
                be ignored.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="py-12 xs:py-16 md:py-20 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-3 xs:px-4 md:px-6">
          <div className="text-center mb-10 xs:mb-12 md:mb-16">
            <h2 className="text-2xl xs:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3 xs:mb-4">How It Works</h2>
            <p className="text-sm xs:text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed px-2">
              We've simplified the process of civic engagement into three powerful steps.
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-start justify-center gap-8 xs:gap-10 md:gap-12 lg:gap-16 max-w-5xl mx-auto">
            {/* Step 1 */}
            <div className="text-center flex-1">
              <div className="w-14 xs:w-16 h-14 xs:h-16 bg-blue-100 dark:bg-blue-900/30 rounded-xl xs:rounded-2xl flex items-center justify-center mx-auto mb-4 xs:mb-5">
                <FileText className="w-7 xs:w-8 h-7 xs:h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-base xs:text-lg font-bold text-gray-900 dark:text-white mb-2 xs:mb-3">1. Submit Complaint</h3>
              <p className="text-gray-600 dark:text-gray-400 text-xs xs:text-sm leading-relaxed px-2">
                Detail your issue with photos and location data to create a public record.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center flex-1">
              <div className="w-14 xs:w-16 h-14 xs:h-16 bg-blue-100 dark:bg-blue-900/30 rounded-xl xs:rounded-2xl flex items-center justify-center mx-auto mb-4 xs:mb-5">
                <Vote className="w-7 xs:w-8 h-7 xs:h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-base xs:text-lg font-bold text-gray-900 dark:text-white mb-2 xs:mb-3">2. Vote & Support</h3>
              <p className="text-gray-600 dark:text-gray-400 text-xs xs:text-sm leading-relaxed px-2">
                The community votes on urgent issues, boosting their visibility and priority.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center flex-1">
              <div className="w-14 xs:w-16 h-14 xs:h-16 bg-blue-600 rounded-xl xs:rounded-2xl flex items-center justify-center mx-auto mb-4 xs:mb-5">
                <CheckCircle className="w-7 xs:w-8 h-7 xs:h-8 text-white" />
              </div>
              <h3 className="text-base xs:text-lg font-bold text-gray-900 dark:text-white mb-2 xs:mb-3">3. Resolution</h3>
              <p className="text-gray-600 dark:text-gray-400 text-xs xs:text-sm leading-relaxed px-2">
                Authorities respond to high-pressure tickets, and resolution is verified by users.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-12 xs:py-16 md:py-20 bg-white dark:bg-gray-800">
        <div className="container mx-auto px-3 xs:px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 xs:gap-6 max-w-5xl mx-auto">
            <div className="bg-white dark:bg-gray-700 rounded-xl xs:rounded-2xl p-6 xs:p-8 md:p-10 shadow-sm border border-gray-100 dark:border-gray-600">
              <span className="text-blue-600 dark:text-blue-400 font-bold text-[10px] xs:text-xs uppercase tracking-widest block mb-2 xs:mb-3">
                COMPLAINTS RESOLVED
              </span>
              <div className="text-3xl xs:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
                {loading ? (
                  <div className="animate-pulse bg-gray-200 dark:bg-gray-600 h-10 xs:h-12 md:h-14 w-24 xs:w-28 md:w-32 rounded"></div>
                ) : (
                  formatNumber(stats.resolvedComplaints)
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-700 rounded-xl xs:rounded-2xl p-6 xs:p-8 md:p-10 shadow-sm border border-gray-100 dark:border-gray-600">
              <span className="text-blue-600 dark:text-blue-400 font-bold text-[10px] xs:text-xs uppercase tracking-widest block mb-2 xs:mb-3">
                ACTIVE VOTERS
              </span>
              <div className="text-3xl xs:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
                {loading ? (
                  <div className="animate-pulse bg-gray-200 dark:bg-gray-600 h-10 xs:h-12 md:h-14 w-24 xs:w-28 md:w-32 rounded"></div>
                ) : (
                  formatNumber(stats.uniqueVoters)
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-700 rounded-xl xs:rounded-2xl p-6 xs:p-8 md:p-10 shadow-sm border border-gray-100 dark:border-gray-600">
              <span className="text-blue-600 dark:text-blue-400 font-bold text-[10px] xs:text-xs uppercase tracking-widest block mb-2 xs:mb-3">
                SECTORS COVERED
              </span>
              <div className="text-3xl xs:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
                {loading ? (
                  <div className="animate-pulse bg-gray-200 dark:bg-gray-600 h-10 xs:h-12 md:h-14 w-16 xs:w-18 md:w-20 rounded"></div>
                ) : (
                  stats.sectorsCovered
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Why Civic Pressure */}
      <section className="py-12 xs:py-16 md:py-20 bg-grey-50 dark:bg-gray-900">
        <div className="container mx-auto px-3 xs:px-4 md:px-6 max-w-6xl">
          <div className="text-center mb-10 xs:mb-12 md:mb-14">
            <h2 className="text-2xl xs:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2 xs:mb-3">Why Civic Pressure?</h2>
            <p className="text-sm xs:text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto px-2">
              Built with citizens and for citizens — focused on speed, clarity, and accountability.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 xs:gap-6">
            <div className="p-4 xs:p-6 rounded-xl xs:rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-sm xs:text-base text-gray-900 dark:text-white mb-1.5 xs:mb-2">Real-time visibility</h3>
              <p className="text-xs xs:text-sm text-gray-600 dark:text-gray-400">Live voting and status updates keep the community informed and authorities accountable.</p>
            </div>
            <div className="p-4 xs:p-6 rounded-xl xs:rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-sm xs:text-base text-gray-900 dark:text-white mb-1.5 xs:mb-2">Location-aware reporting</h3>
              <p className="text-xs xs:text-sm text-gray-600 dark:text-gray-400">Pin issues on the map to help responders prioritize by area and severity.</p>
            </div>
            <div className="p-4 xs:p-6 rounded-xl xs:rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-sm xs:text-base text-gray-900 dark:text-white mb-1.5 xs:mb-2">Smart duplicate checks</h3>
              <p className="text-xs xs:text-sm text-gray-600 dark:text-gray-400">We suggest similar complaints so support concentrates on a single, stronger ticket.</p>
            </div>
            <div className="p-4 xs:p-6 rounded-xl xs:rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-sm xs:text-base text-gray-900 dark:text-white mb-1.5 xs:mb-2">Clear resolution tracking</h3>
              <p className="text-xs xs:text-sm text-gray-600 dark:text-gray-400">Statuses move from Open to In‑Progress to Resolved — with proof from the community.</p>
            </div>
            <div className="p-4 xs:p-6 rounded-xl xs:rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-sm xs:text-base text-gray-900 dark:text-white mb-1.5 xs:mb-2">Sector coverage</h3>
              <p className="text-xs xs:text-sm text-gray-600 dark:text-gray-400">Transport, Utilities, Municipal, Education, Environment, Public Safety, and more.</p>
            </div>
            <div className="p-4 xs:p-6 rounded-xl xs:rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-sm xs:text-base text-gray-900 dark:text-white mb-1.5 xs:mb-2">Privacy-first</h3>
              <p className="text-xs xs:text-sm text-gray-600 dark:text-gray-400">Report anonymously if you prefer — we protect your identity while your issue gets heard.</p>
            </div>
          </div>
          <div className="text-center mt-8 xs:mt-10">
            <Link to="/complaint" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-5 xs:px-6 py-2.5 xs:py-3 rounded-lg font-medium text-sm xs:text-base shadow-sm active:scale-95 min-h-[44px]">
              Report an Issue
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 py-3">
        <div className="container mx-auto px-3 xs:px-4 md:px-6">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 xs:gap-12 md:gap-16">
              {/* Left Side - Info & GitHub */}
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-4 xs:mb-6">
                  <img src={logo} alt="Civic Pressure Logo" className="w-8 xs:w-10 h-8 xs:h-10 rounded-xl" />
                  <span className="text-xl xs:text-2xl font-bold text-gray-900 dark:text-white">Civic Pressure</span>
                </div>
                <p className="text-sm xs:text-base text-gray-600 dark:text-gray-400 mb-6 xs:mb-8 leading-relaxed">
                  Empowering citizens to reclaim their neighborhoods through transparent, data-driven
                  advocacy and collective action.
                </p>
                
                {/* GitHub Button */}
                <a
                  href="https://github.com/End-side-Developer/civic-pressure-main"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 xs:gap-3 px-4 xs:px-6 py-3 xs:py-3.5 bg-gray-900 dark:bg-gray-700 text-white rounded-xl font-semibold text-sm xs:text-base hover:bg-gray-800 dark:hover:bg-gray-600 transition shadow-lg hover:shadow-xl active:scale-95 min-h-[44px]"
                >
                  <Github className="w-4 xs:w-5 h-4 xs:h-5 flex-shrink-0" />
                  <span>View on GitHub</span>
                </a>
              </div>

              {/* Right Side - Contact Form */}
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-4 xs:mb-6 text-xl xs:text-2xl text-center">Get in Touch</h4>
                
                {contactSuccess && (
                  <div className="mb-3 xs:mb-4 p-3 xs:p-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-xl text-xs xs:text-sm font-medium border border-green-200 dark:border-green-800">
                    ✓ Your message has been sent successfully! We'll get back to you soon.
                  </div>
                )}

                {contactError && (
                  <div className="mb-3 xs:mb-4 p-3 xs:p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl text-xs xs:text-sm font-medium border border-red-200 dark:border-red-800">
                    {contactError}
                  </div>
                )}

                <form onSubmit={handleContactSubmit} className="space-y-3 xs:space-y-4">
                  <div>
                    <input
                      type="text"
                      placeholder="Your Name"
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      required
                      className="w-full px-3 xs:px-4 py-2.5 xs:py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-xs xs:text-sm min-h-[44px]"
                    />
                  </div>
                  <div>
                    <input
                      type="email"
                      placeholder="Your Email"
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      required
                      className="w-full px-3 xs:px-4 py-2.5 xs:py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-xs xs:text-sm min-h-[44px]"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Subject (Optional)"
                      value={contactForm.subject}
                      onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                      className="w-full px-3 xs:px-4 py-2.5 xs:py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-xs xs:text-sm min-h-[44px]"
                    />
                  </div>
                  <div>
                    <textarea
                      placeholder="Your Message"
                      value={contactForm.message}
                      onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                      required
                      rows={4}
                      className="w-full px-3 xs:px-4 py-2.5 xs:py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition text-xs xs:text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submittingContact}
                    className="w-full py-3 xs:py-3.5 bg-blue-600 text-white rounded-xl font-semibold text-sm xs:text-base hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-[0.98] min-h-[48px]"
                  >
                    {submittingContact ? (
                      <>
                        <div className="w-4 xs:w-5 h-4 xs:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 xs:w-5 h-4 xs:h-5 flex-shrink-0" />
                        <span>Send Message</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 mt-4 pt-2 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-xs xs:text-sm">
              © 2025 Civic Pressure. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AboutPage;
