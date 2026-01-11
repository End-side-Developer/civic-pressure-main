import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThumbsUp, Flame, CheckCircle, Search, ChevronDown } from 'lucide-react';
import { useComplaints } from '../../context/ComplaintsContext';
import { useAuth } from '../../context/AuthContext';
import backgroundImage from '../../assets/images/image1.jpg';

const sectors = [
  'All Sectors',
  'TRANSPORT',
  'UTILITIES',
  'MUNICIPAL',
  'INFRASTRUCTURE',
  'ELECTRICITY',
  'WATER SUPPLY',
  'SANITATION',
  'EDUCATION',
  'HEALTHCARE',
  'ENVIRONMENT',
  'PUBLIC SAFETY',
  'HOUSING',
  'LAW & ORDER',
  'DIGITAL SERVICES',
  'WASTE MANAGEMENT',
  'TRAFFIC',
  'ANIMAL WELFARE',
  'EMPLOYMENT'
];

const HOT_TOPIC_THRESHOLD = 500;

const getSectorColor = (sector: string): { bg: string; text: string } => {
  const colors: { [key: string]: { bg: string; text: string } } = {
    TRANSPORT: { bg: 'bg-blue-100', text: 'text-blue-700' },
    UTILITIES: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
    MUNICIPAL: { bg: 'bg-purple-100', text: 'text-purple-700' },
    INFRASTRUCTURE: { bg: 'bg-orange-100', text: 'text-orange-700' },
    ELECTRICITY: { bg: 'bg-amber-100', text: 'text-amber-700' },
    'WATER SUPPLY': { bg: 'bg-cyan-100', text: 'text-cyan-700' },
    SANITATION: { bg: 'bg-red-100', text: 'text-red-700' },
    EDUCATION: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
    HEALTHCARE: { bg: 'bg-pink-100', text: 'text-pink-700' },
    ENVIRONMENT: { bg: 'bg-green-100', text: 'text-green-700' },
    'PUBLIC SAFETY': { bg: 'bg-blue-100', text: 'text-blue-700' },
    HOUSING: { bg: 'bg-teal-100', text: 'text-teal-700' },
    'LAW & ORDER': { bg: 'bg-slate-100', text: 'text-slate-700' },
    'DIGITAL SERVICES': { bg: 'bg-violet-100', text: 'text-violet-700' },
    'WASTE MANAGEMENT': { bg: 'bg-lime-100', text: 'text-lime-700' },
    TRAFFIC: { bg: 'bg-rose-100', text: 'text-rose-700' },
    'ANIMAL WELFARE': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    EMPLOYMENT: { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700' },
  };
  return colors[sector] || { bg: 'bg-gray-100', text: 'text-gray-700' };
};

const getStatusColor = (status: string): { bg: string; text: string; label: string } => {
  const normalizedStatus = status?.toUpperCase() || '';
  switch (normalizedStatus) {
    case 'SOLVED':
    case 'RESOLVED':
      return { bg: 'bg-green-100', text: 'text-green-600', label: 'Solved' };
    case 'IN PROGRESS':
    case 'IN-PROGRESS':
      return { bg: 'bg-yellow-100', text: 'text-yellow-600', label: 'In Progress' };
    case 'PENDING REVIEW':
      return { bg: 'bg-blue-100', text: 'text-blue-600', label: 'Pending' };
    case 'REJECTED':
      return { bg: 'bg-red-100', text: 'text-red-600', label: 'Rejected' };
    default:
      return { bg: 'bg-orange-100', text: 'text-orange-600', label: 'Open' };
  }
};

const formatVotes = (votes: number): string => {
  if (votes >= 1000) {
    return `${(votes / 1000).toFixed(1)}k`;
  }
  return votes.toString();
};

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { complaints, fetchComplaints, voteComplaint, loading } = useComplaints();
  const { currentUser } = useAuth();
  const [activeFilter, setActiveFilter] = useState<'hot' | 'solved' | null>(null);
  const [selectedSector, setSelectedSector] = useState('All Sectors');
  const [sortBy, setSortBy] = useState('most-voted');
  const [showSectorDropdown, setShowSectorDropdown] = useState(false);
  const [visibleCount, setVisibleCount] = useState(16);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch complaints on mount
  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const filteredComplaints = useMemo(() => {
    let filtered = [...complaints];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.title.toLowerCase().includes(query) ||
          c.description.toLowerCase().includes(query) ||
          c.category.toLowerCase().includes(query)
      );
    }

    // Apply sector filter
    if (selectedSector !== 'All Sectors') {
      filtered = filtered.filter((c) => c.category === selectedSector);
    }

    // Apply status filter
    if (activeFilter === 'hot') {
      filtered = filtered.filter((c) => c.votes >= HOT_TOPIC_THRESHOLD);
    } else if (activeFilter === 'solved') {
      filtered = filtered.filter((c) => c.status?.toUpperCase() === 'RESOLVED' || c.status?.toLowerCase() === 'solved');
    }

    // Sort
    if (sortBy === 'most-voted') {
      filtered.sort((a, b) => b.votes - a.votes);
    }

    return filtered;
  }, [complaints, activeFilter, selectedSector, sortBy, searchQuery]);

  const visibleComplaints = filteredComplaints.slice(0, visibleCount);
  const hasMore = filteredComplaints.length > visibleCount;

  const handleVote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      alert('Please login to vote');
      return;
    }
    try {
      await voteComplaint(id);
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  };

  const handleSeeMore = () => {
    setVisibleCount((prev) => prev + 8);
  };

  // Show loading state
  if (loading && complaints.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading complaints...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      {/* Hero Section */}
      <div className="container mx-auto px-3 xs:px-4 md:px-6 py-3 xs:py-4 md:py-6">
        <div className="relative bg-gradient-to-br from-gray-600 via-gray-700 to-gray-800 overflow-hidden rounded-xl md:rounded-2xl">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-50"
            style={{
              backgroundImage: `url(${backgroundImage})`,
            }}
          />
          <div className="relative container mx-auto px-3 xs:px-4 md:px-8 py-8 xs:py-10 md:py-16 lg:py-20 text-center text-white">
            <h1 className="text-xl xs:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold mb-2 md:mb-3 leading-tight">
              Voice your concerns.
              <br />
              Make a change.
            </h1>
            <p className="text-xs xs:text-sm md:text-base lg:text-lg opacity-90 max-w-2xl mx-auto leading-relaxed mb-4 xs:mb-6 md:mb-8 px-2">
              Join the community in solving local issues. Vote on complaints or report new ones to improve your neighborhood.
            </p>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto px-1 xs:px-2 md:px-0">
              <div className="flex flex-col xs:flex-row items-stretch bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <div className="hidden md:flex pl-4 text-gray-400 dark:text-gray-500 items-center">
                  <Search className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search complaints..."
                  className="flex-1 px-3 xs:px-4 py-3 text-gray-800 dark:text-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none text-sm w-full"
                />
                <button className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 xs:px-6 py-3 font-semibold transition text-sm flex-shrink-0">
                  Search
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="container mx-auto px-3 xs:px-4 md:px-6 py-3 xs:py-4 md:py-6">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-4">
          {/* Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Hot Topics Filter */}
            <button
              onClick={() => setActiveFilter(activeFilter === 'hot' ? null : 'hot')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all active:scale-95 ${activeFilter === 'hot'
                  ? 'bg-[#E2E8F7] text-blue-600 border border-blue-200 shadow-sm'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                }
                md:px-3 md:py-2 md:text-sm
                `}
            >
              <Flame
                className={`w-3.5 h-3.5 ${activeFilter === 'hot' ? 'text-blue-600' : 'text-gray-400'
                  }`}
              />
              <span>Hot</span>
            </button>

            {/* Solved Topics Filter */}
            <button
              onClick={() => setActiveFilter(activeFilter === 'solved' ? null : 'solved')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all active:scale-95 ${activeFilter === 'solved'
                  ? 'bg-[#E2E8F7] text-blue-600 border border-blue-200 shadow-sm'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                }
                md:px-3 md:py-2 md:text-sm
                `}
            >
              <CheckCircle
                className={`w-3.5 h-3.5 ${activeFilter === 'solved' ? 'text-blue-600' : 'text-gray-400'
                  }`}
              />
              <span>Solved</span>
            </button>

            {/* Sector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSectorDropdown(!showSectorDropdown)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm border border-gray-200 dark:border-gray-700 active:scale-95 md:px-3 md:py-2 md:text-sm"
              >
                Sector
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSectorDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showSectorDropdown && (
                <div className="absolute top-full left-0 mt-2 w-56 xs:w-64 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 z-20 py-2 max-h-64 overflow-y-auto">
                  {sectors.map((sector) => (
                    <button
                      key={sector}
                      onClick={() => {
                        setSelectedSector(sector);
                        setShowSectorDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition ${selectedSector === sector ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300'
                        }`}
                    >
                      {sector}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <span className="text-xs font-medium uppercase tracking-wider">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent font-semibold text-sm text-gray-800 dark:text-gray-200 cursor-pointer focus:outline-none appearance-none pr-6"
              style={{ 
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right center',
              }}
            >
              <option value="most-voted" className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200">Most Voted</option>
              <option value="newest" className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200">Newest</option>
              <option value="oldest" className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200">Oldest</option>
            </select>
          </div>
        </div>

        {/* Selected Sector Badge */}
        {selectedSector !== 'All Sectors' && (
          <div className="mt-4">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm">
              {selectedSector}
              <button
                onClick={() => setSelectedSector('All Sectors')}
                className="hover:text-blue-900 dark:hover:text-blue-300"
              >
                ×
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Complaints Grid */}
      <div className="container mx-auto px-3 xs:px-4 md:px-6 pb-6 md:pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
          {visibleComplaints.map((complaint) => {
            const status = getStatusColor(complaint.status);
            // Check if current user has voted for this complaint using votedBy array
            const isVoted = currentUser && complaint.votedBy?.includes(currentUser.uid);

            return (
              <div
                key={complaint.id}
                className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden border border-gray-100 dark:border-gray-700 cursor-pointer flex flex-col h-full"
                onClick={() => navigate(`/complaint/${complaint.id}`)}
              >
                {/* Card Content */}
                <div className="p-4 md:p-5 flex-1 flex flex-col">
                  {/* Category Badge */}
                  <div className="mb-3">
                    <span
                      className={`${getSectorColor(complaint.category).bg} ${getSectorColor(complaint.category).text} inline-block text-[10px] xs:text-xs px-2.5 py-1 rounded-md font-semibold uppercase tracking-wider`}
                    >
                      {complaint.category}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-bold text-gray-900 dark:text-white text-base leading-snug mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {complaint.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2 flex-1">
                    {complaint.description}
                  </p>
                </div>

                {/* Card Footer */}
                <div className="px-4 md:px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3 bg-gray-50/50 dark:bg-gray-900/30">
                  <button
                    onClick={(e) => handleVote(complaint.id, e)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all active:scale-95 ${isVoted
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                      }`}
                  >
                    <ThumbsUp className={`w-4 h-4 ${isVoted ? 'fill-current' : ''}`} />
                    <span>{formatVotes(complaint.votes)}</span>
                  </button>

                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${status.bg} ${status.text}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${complaint.status === 'solved' ? 'bg-green-500' :
                        complaint.status === 'in-progress' ? 'bg-yellow-500' : 'bg-orange-500'
                      }`}></span>
                    {status.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {visibleComplaints.length === 0 && (
          <div className="text-center py-10 xs:py-12 md:py-16 px-4">
            <div className="text-4xl xs:text-5xl md:text-6xl mb-3 xs:mb-4">📭</div>
            <h3 className="text-base xs:text-lg md:text-xl font-semibold text-gray-800 dark:text-white mb-2">No complaints found</h3>
            <p className="text-sm xs:text-base text-gray-600 dark:text-gray-400">Try adjusting your filters to see more results.</p>
          </div>
        )}

        {/* See More Button */}
        {hasMore && (
          <div className="text-center mt-6 xs:mt-8">
            <button
              onClick={handleSeeMore}
              className="px-6 xs:px-8 py-2.5 xs:py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full font-medium text-sm xs:text-base text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 hover:border-gray-300 dark:hover:border-gray-600 transition shadow-sm"
            >
              See more
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
