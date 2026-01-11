import React, { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ComplaintFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/**
 * A reusable modal wrapper component for displaying content in a modal dialog.
 * This is purely presentational - all logic should be handled by the parent component.
 */
const ComplaintFormModal: React.FC<ComplaintFormModalProps> = ({ 
  isOpen, 
  onClose, 
  title = 'File a Complaint',
  children 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 xs:p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full my-2 xs:my-4 md:my-8 max-h-[95vh] xs:max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 xs:p-4 md:p-6 flex justify-between items-center z-10 gap-2">
          <h2 className="text-xl xs:text-2xl md:text-3xl font-bold text-gray-800 dark:text-white truncate">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0 active:scale-95"
            aria-label="Close modal"
          >
            <X className="w-5 xs:w-6 h-5 xs:h-6" />
          </button>
        </div>
        <div className="p-3 xs:p-4 md:p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default ComplaintFormModal;
