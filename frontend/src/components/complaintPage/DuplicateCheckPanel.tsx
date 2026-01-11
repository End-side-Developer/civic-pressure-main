import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Vote, ExternalLink, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export interface DuplicateMatch {
  id: string;
  title: string;
  similarity: number;
  category: string;
  status: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matches: DuplicateMatch[];
  stats: {
    checked: number;
    processingTimeMs: number;
  };
}

interface DuplicateCheckPanelProps {
  isChecking: boolean;
  result: DuplicateCheckResult | null;
  error: string | null;
  onCheckDuplicates: () => void;
  canCheck: boolean; // Whether form has enough data to check
}

const DuplicateCheckPanel: React.FC<DuplicateCheckPanelProps> = ({
  isChecking,
  result,
  error,
  onCheckDuplicates,
  canCheck,
}) => {
  const navigate = useNavigate();

  // Calculate similarity percentage for display
  const getSimilarityPercentage = (similarity: number): string => {
    return `${Math.round(similarity * 100)}%`;
  };

  // Get color based on similarity
  const getSimilarityColor = (similarity: number): string => {
    if (similarity >= 0.9) return 'text-red-600 dark:text-red-400';
    if (similarity >= 0.85) return 'text-orange-600 dark:text-orange-400';
    return 'text-yellow-600 dark:text-yellow-400';
  };

  // Get status badge color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'PENDING REVIEW':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'UNDER REVIEW':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'IN PROGRESS':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400';
      case 'RESOLVED':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const handleViewComplaint = (id: string) => {
    navigate(`/complaint/${id}`);
  };

  const handleVoteForComplaint = (id: string) => {
    navigate(`/complaint/${id}?action=vote`);
  };

  return (
    <div className="mt-4 xs:mt-6 p-3 xs:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
      <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 xs:gap-0 mb-3 xs:mb-4">
        <h3 className="text-xs xs:text-sm font-semibold text-gray-700 dark:text-gray-300">
          Duplicate Check
        </h3>
        <button
          type="button"
          onClick={onCheckDuplicates}
          disabled={isChecking || !canCheck}
          className={`px-3 xs:px-4 py-2 xs:py-2 rounded-lg text-xs xs:text-sm font-medium flex items-center justify-center gap-1.5 xs:gap-2 transition-colors min-h-[40px] xs:min-h-0 active:scale-95 ${
            isChecking || !canCheck
              ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isChecking ? (
            <>
              <Loader2 className="w-3.5 xs:w-4 h-3.5 xs:h-4 animate-spin flex-shrink-0" />
              <span>Checking...</span>
            </>
          ) : (
            'Check for Duplicates'
          )}
        </button>
      </div>

      {/* Helper text when not checked yet */}
      {!result && !error && !isChecking && (
        <p className="text-xs xs:text-sm text-gray-500 dark:text-gray-400">
          {canCheck
            ? 'Click "Check for Duplicates" to see if a similar complaint already exists.'
            : 'Fill in the title, category, and description to check for duplicates.'}
        </p>
      )}

      {/* Error state */}
      {error && (
        <div className="flex items-start gap-2 xs:gap-3 p-2.5 xs:p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <XCircle className="w-4 xs:w-5 h-4 xs:h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs xs:text-sm font-medium text-red-800 dark:text-red-300">Error checking duplicates</p>
            <p className="text-xs xs:text-sm text-red-600 dark:text-red-400 mt-1 break-words">{error}</p>
          </div>
        </div>
      )}

      {/* No duplicates found */}
      {result && !result.isDuplicate && (
        <div className="flex items-start gap-2 xs:gap-3 p-2.5 xs:p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <CheckCircle className="w-4 xs:w-5 h-4 xs:h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs xs:text-sm font-medium text-green-800 dark:text-green-300">No duplicates found</p>
            <p className="text-xs xs:text-sm text-green-600 dark:text-green-400 mt-1">
              Your complaint appears to be unique. You can proceed.
            </p>
            <p className="text-[10px] xs:text-xs text-green-500 dark:text-green-500 mt-2">
              Checked {result.stats.checked} complaints in {result.stats.processingTimeMs}ms
            </p>
          </div>
        </div>
      )}

      {/* Duplicates found */}
      {result && result.isDuplicate && (
        <div className="space-y-3 xs:space-y-4">
          {/* Warning banner */}
          <div className="flex items-start gap-2 xs:gap-3 p-2.5 xs:p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-4 xs:w-5 h-4 xs:h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs xs:text-sm font-medium text-amber-800 dark:text-amber-300">
                Similar complaints found
              </p>
              <p className="text-xs xs:text-sm text-amber-600 dark:text-amber-400 mt-1">
                We found {result.matches.length} existing complaint{result.matches.length > 1 ? 's' : ''} similar to yours.
                Consider voting instead.
              </p>
            </div>
          </div>

          {/* Matches list */}
          <div className="space-y-2 xs:space-y-3">
            {result.matches.map((match) => (
              <div
                key={match.id}
                className="p-3 xs:p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2 xs:gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs xs:text-sm font-medium text-gray-900 dark:text-white truncate">
                      {match.title}
                    </h4>
                    <div className="flex flex-wrap items-center gap-1.5 xs:gap-2 mt-1.5 xs:mt-2">
                      <span className={`text-[10px] xs:text-xs px-1.5 xs:px-2 py-0.5 xs:py-1 rounded-full ${getStatusColor(match.status)}`}>
                        {match.status}
                      </span>
                      <span className="text-[10px] xs:text-xs text-gray-500 dark:text-gray-400 truncate">
                        {match.category}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className={`text-sm xs:text-lg font-bold ${getSimilarityColor(match.similarity)}`}>
                      {getSimilarityPercentage(match.similarity)}
                    </span>
                    <p className="text-[10px] xs:text-xs text-gray-500 dark:text-gray-400">match</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2 xs:mt-3 pt-2 xs:pt-3 border-t border-gray-100 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => handleViewComplaint(match.id)}
                    className="flex-1 px-2 xs:px-3 py-2 text-xs xs:text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors flex items-center justify-center gap-1 min-h-[40px] active:scale-95"
                  >
                    <ExternalLink className="w-3.5 xs:w-4 h-3.5 xs:h-4 flex-shrink-0" />
                    <span>View</span>
                  </button>
                  {match.status !== 'RESOLVED' && match.status !== 'REJECTED' && (
                    <button
                      type="button"
                      onClick={() => handleVoteForComplaint(match.id)}
                      className="flex-1 px-2 xs:px-3 py-2 text-xs xs:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center gap-1 min-h-[40px] active:scale-95"
                    >
                      <Vote className="w-3.5 xs:w-4 h-3.5 xs:h-4 flex-shrink-0" />
                      <span>Vote</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <p className="text-[10px] xs:text-xs text-gray-500 dark:text-gray-400 text-center">
            Checked {result.stats.checked} complaints in {result.stats.processingTimeMs}ms
          </p>
        </div>
      )}
    </div>
  );
};

export default DuplicateCheckPanel;
