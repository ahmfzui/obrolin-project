"use client";

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

const categories = [
  { id: 'Capstone', name: 'Capstone' },
  { id: 'Internship', name: 'Internship' },
  { id: 'MBKM', name: 'MBKM' },
  { id: 'Registration', name: 'Registration' },
];

export default function DocumentUpload() {
  const { data: session } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>('Capstone');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoadingDocs(true);
      try {
        const res = await fetch('/api/documents/upload');
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        if (mounted) setDocuments(data.documents || []);
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setLoadingDocs(false);
      }
    };
    load();
    return () => { mounted = false };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
      setUploadResult(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Pilih file terlebih dahulu');
      return;
    }

    setIsUploading(true);
    setError('');
    setUploadProgress('Memulai upload...');
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);

      setUploadProgress('Mengupload dokumen...');
      
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload gagal');
      }

      const result = await response.json();
      setUploadResult(result);
      // refresh documents list after upload
      try {
        const listRes = await fetch('/api/documents/upload');
        if (listRes.ok) {
          const data = await listRes.json();
          setDocuments(data.documents || []);
        }
      } catch (e) {
        // ignore
      }
      setUploadProgress('Upload berhasil!');
      setFile(null);
      
      // Reset file input
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Terjadi kesalahan saat upload');
      setUploadProgress('');
    } finally {
      setIsUploading(false);
    }
  };

  if (!session) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <div className="flex items-center gap-4 p-6 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl">
          <svg className="w-12 h-12 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="font-semibold text-yellow-800 mb-1">Authentication Required</h3>
            <p className="text-yellow-700 text-sm">Silakan login terlebih dahulu untuk upload dokumen.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Upload Form Section */}
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-6 text-white">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-xl font-bold">Upload Dokumen Baru</h2>
          </div>
        </div>

        <form onSubmit={handleUpload} className="p-6 space-y-6">
          {/* Category Selection */}
          <div>
            <label htmlFor="category" className="block text-sm font-semibold text-gray-700 mb-2">
              Kategori Dokumen
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all bg-white text-gray-900"
              disabled={isUploading}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* File Selection */}
          <div>
            <label htmlFor="file-input" className="block text-sm font-semibold text-gray-700 mb-2">
              Pilih File
            </label>
            <div className="relative">
              <input
                id="file-input"
                type="file"
                onChange={handleFileChange}
                disabled={isUploading}
                accept=".pdf,.doc,.docx,.txt,.md"
                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-cyan-500 file:to-blue-600 file:text-white hover:file:from-cyan-600 hover:file:to-blue-700 file:cursor-pointer cursor-pointer bg-gray-50 hover:bg-gray-100"
              />
            </div>
            {file && (
              <div className="mt-3 p-3 bg-cyan-50 border border-cyan-200 rounded-lg flex items-center gap-3">
                <svg className="w-5 h-5 text-cyan-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-cyan-900 truncate">{file.name}</p>
                  <p className="text-xs text-cyan-700">{(file.size / 1024).toFixed(2)} KB</p>
                </div>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <button
            type="submit"
            disabled={!file || isUploading}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-3 px-6 rounded-xl hover:from-cyan-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all font-semibold shadow-lg disabled:shadow-none flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Mengupload...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload Dokumen
              </>
            )}
          </button>

          {/* Progress/Status */}
          {uploadProgress && (
            <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-xl flex items-center gap-3">
              <svg className="w-5 h-5 text-cyan-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-cyan-800 font-medium">{uploadProgress}</p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-800 font-medium">{error}</p>
            </div>
          )}

          {/* Success Result */}
          {uploadResult && uploadResult.success && (
            <div className="p-5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="font-bold text-green-800 text-lg">Upload Berhasil!</h3>
              </div>
              {uploadResult.message && (
                <p className="text-green-700 text-sm mb-3 ml-13">{uploadResult.message}</p>
              )}
              {uploadResult.stats && (
                <div className="ml-13 bg-white rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total chunks:</span>
                    <span className="font-semibold text-gray-900">{uploadResult.stats.total_chunks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">New chunks:</span>
                    <span className="font-semibold text-green-600">{uploadResult.stats.new_chunks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duplicates skipped:</span>
                    <span className="font-semibold text-gray-900">{uploadResult.stats.duplicates_skipped}</span>
                  </div>
                  {uploadResult.stats.total_points_in_collection && (
                    <div className="flex justify-between pt-2 border-t border-gray-200">
                      <span className="text-gray-600">Total di database:</span>
                      <span className="font-bold text-cyan-600">{uploadResult.stats.total_points_in_collection}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Supported Formats Info */}
          <div className="p-4 bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-xl">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-gray-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">Format yang Didukung</h3>
                <p className="text-sm text-gray-600">PDF, DOC, DOCX, TXT, MD</p>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Documents List Section */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden sticky top-6">
          <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-5 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-bold">Dokumen</h3>
              </div>
              <span className="text-xs bg-white/20 px-2 py-1 rounded-full backdrop-blur-sm font-semibold">
                {documents.length}
              </span>
            </div>
          </div>

          <div className="p-5">
            {loadingDocs && (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <svg className="animate-spin h-10 w-10 text-cyan-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-sm text-gray-600 font-medium">Loading...</p>
                </div>
              </div>
            )}
            {!loadingDocs && documents.length === 0 && (
              <div className="py-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500 font-medium">Belum ada dokumen</p>
                <p className="text-xs text-gray-400 mt-1">Upload dokumen pertama Anda</p>
              </div>
            )}
            <ul className="space-y-2 max-h-[600px] overflow-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
              {documents.slice(0, 50).map((d: any, i: number) => (
                <li key={i} className="group p-3 bg-gradient-to-r from-white to-gray-50 rounded-xl border border-gray-100 hover:border-cyan-200 hover:from-cyan-50/30 hover:to-blue-50/30 transition-all duration-200 cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate group-hover:text-cyan-700 transition-colors">
                        {d.filename || d.name || d.id || 'Untitled'}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded-md font-medium">
                          {d.payload?.category || d.category || 'No category'}
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// load documents on mount
// (placed after component to keep top-level hook usage unchanged)
// NOTE: using a small effect here would require moving it into the component; we'll instead add effect inside component above.
