 'use client';

import React from 'react';

interface QuotaModalProps {
  open: boolean;
  onClose: () => void;
  message?: string;
  // Accept a pre-formatted reset label (hours/minutes) instead of raw seconds
  resetLabel?: string;
}

export default function QuotaModal({ open, onClose, message, resetLabel }: QuotaModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-w-lg w-full mx-4 bg-white rounded-lg shadow-lg ring-1 ring-gray-200">
        <div className="flex items-start justify-between p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-100 text-yellow-800 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-yellow-900">Batas Harian Tercapai</h3>
              <p className="mt-1 text-sm text-gray-700">{message || 'Anda telah mencapai batas pertanyaan harian.'}</p>
              {resetLabel && (
                <p className="mt-1 text-xs text-gray-400">{resetLabel}</p>
              )}
            </div>
          </div>
          <div className="ml-4">
            <button onClick={onClose} className="inline-flex items-center justify-center rounded-md p-2 text-yellow-700 hover:bg-yellow-50">
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 8.586L15.95 2.636a1 1 0 111.414 1.414L11.414 10l5.95 5.95a1 1 0 01-1.414 1.414L10 11.414l-5.95 5.95a1 1 0 01-1.414-1.414L8.586 10 2.636 4.05A1 1 0 114.05 2.636L10 8.586z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
