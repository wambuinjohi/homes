import React from 'react';

interface EnhancedReportModalProps {
  reportData?: any;
  isOpen: boolean;
  onClose: () => void;
  reportType?: string;
}

export function EnhancedReportModal({ isOpen, onClose }: EnhancedReportModalProps) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Reports feature temporarily under maintenance</p>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}