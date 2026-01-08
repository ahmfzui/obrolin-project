"use client";

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';

const formatCategoryName = (name: string) => {
  return name.replace(/([a-z])([A-Z])/g, '$1 $2');
};

export default function DocumentUpload() {
  const { data: session } = useSession();
  
  // Upload State
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>('');
  const [categories, setCategories] = useState<{id: string, name: string}[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [uploadStage, setUploadStage] = useState<string>('');
  const [uploadProgressPercent, setUploadProgressPercent] = useState<number>(0);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [error, setError] = useState('');
  
  // List State
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);
  
  // UI State
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        // Fetch from DB for Admin Upload
        const res = await fetch('/api/documents/categories?source=db');
        if (res.ok) {
          const data = await res.json();
          // Expecting { categories: [{ id: 'val', name: 'Name' }, ...] }
          const fetchedCategories = data.categories || [];
          
          setCategories(fetchedCategories);
          if (fetchedCategories.length > 0) {
            setCategory(fetchedCategories[0].id);
          }
        }
      } catch (e) {
        console.error('Failed to fetch categories:', e);
      }
    };
    
    fetchCategories();
  }, []);

  const loadDocuments = async (categoryFilter = '') => {
    setLoadingDocs(true);
    try {
      const url = categoryFilter 
        ? `/api/documents/upload?category=${encodeURIComponent(categoryFilter)}`
        : '/api/documents/upload';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (e) {
      console.error('Load documents error:', e);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    loadDocuments(filterCategory);
  }, [filterCategory]);

  const handleDeleteDocument = async (filename: string, category: string) => {
    const displayCategory = getCategoryDisplay(category);
    if (!confirm(`Yakin ingin menghapus dokumen "${filename}" dari kategori "${displayCategory}"?`)) {
      return;
    }

    const deleteKey = `${filename}_${category}`;
    setDeletingDoc(deleteKey);

    try {
      const response = await fetch('/api/documents/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename, category }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Delete gagal');
      }

      const result = await response.json();
      // alert(`Berhasil menghapus ${result.deleted_count} chunks dari "${filename}"`);
      
      await loadDocuments(filterCategory);

    } catch (err: any) {
      console.error('Delete error:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setDeletingDoc(null);
    }
  };

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
    setUploadStage('starting');
    setUploadProgressPercent(0);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);

      const response = await fetch('/api/documents/upload-stream', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload gagal');
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported in this browser.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.error) {
                throw new Error(data.message || 'Upload failed');
              }

              setUploadStage(data.stage);
              setUploadProgress(data.message);
              if (data.progress) {
                setUploadProgressPercent(data.progress);
              }

              if (data.stage === 'complete') {
                setUploadResult({
                  success: true,
                  message: data.message,
                  stats: data.stats
                });
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }

      await loadDocuments(filterCategory);
      setFile(null);
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      // Close modal after short delay if successful
      // setTimeout(() => setShowUploadModal(false), 2000);

    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Terjadi kesalahan saat upload');
      setUploadProgress('');
    } finally {
      setIsUploading(false);
    }
  };

  const closeModal = () => {
    if (isUploading) return;
    setShowUploadModal(false);
    setFile(null);
    setError('');
    setUploadResult(null);
    setUploadProgress('');
    setUploadProgressPercent(0);
  };

  const filteredDocuments = documents.filter(doc => {
    const filename = doc.filename || doc.name || doc.id || '';
    const docCategory = doc.payload?.category || doc.category || '';
    
    const matchesSearch = filename.toLowerCase().includes(searchTerm.toLowerCase());
    // Category filter is already handled by API, but if we want client side filtering for search results:
    // const matchesCategory = filterCategory ? docCategory === filterCategory : true;
    
    return matchesSearch;
  });

  const getCategoryDisplay = (catId: string) => {
    if (!catId) return 'No category';
    const match = categories.find(c => c.id === catId);
    if (match) return match.name;
    return formatCategoryName(catId);
  };

  const totalChunks = documents.reduce((acc, doc) => acc + (doc.chunk_count || 0), 0);

  if (!session) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <div className="flex items-center gap-4 p-6 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl">
          <svg className="w-12 h-12 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="font-semibold text-yellow-800 mb-1">Authentication Required</h3>
            <p className="text-yellow-700 text-sm">Silakan login terlebih dahulu untuk mengelola dokumen.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Toolbar Section */}
      <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full">
          {/* Search */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Cari dokumen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-9 sm:pl-10 pr-3 py-2 sm:py-2.5 border border-gray-200 rounded-lg sm:rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all text-sm"
            />
          </div>

          {/* Category Filter */}
          <div className="w-full sm:w-48">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 sm:py-2.5 text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 rounded-lg sm:rounded-xl bg-white text-gray-900 shadow-sm"
            >
              <option value="">Semua Kategori</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => setShowUploadModal(true)}
          className="w-full flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg sm:rounded-xl hover:shadow-lg hover:shadow-cyan-200 transition-all duration-200 font-medium text-sm"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Upload Dokumen
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-cyan-100 flex items-center justify-center text-cyan-600">
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-xs sm:text-sm text-gray-500">Total Dokumen</p>
            <p className="text-lg sm:text-2xl font-bold text-gray-800">{documents.length}</p>
          </div>
        </div>
        
        <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <p className="text-xs sm:text-sm text-gray-500">Total Chunks</p>
            <p className="text-lg sm:text-2xl font-bold text-gray-800">{totalChunks}</p>
          </div>
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Nama Dokumen
                </th>
                <th scope="col" className="hidden sm:table-cell px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Kategori
                </th>
                <th scope="col" className="hidden sm:table-cell px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Chunks
                </th>
                <th scope="col" className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loadingDocs ? (
                <tr>
                  <td colSpan={4} className="px-3 sm:px-6 py-8 sm:py-12 text-center">
                    <div className="flex justify-center">
                      <svg className="animate-spin h-6 w-6 sm:h-8 sm:w-8 text-cyan-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                    <p className="mt-2 text-xs sm:text-sm text-gray-500">Memuat dokumen...</p>
                  </td>
                </tr>
              ) : filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 sm:px-6 py-8 sm:py-12 text-center">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 font-medium text-sm sm:text-base">Tidak ada dokumen ditemukan</p>
                    <p className="text-xs sm:text-sm text-gray-400">Coba ubah filter atau upload dokumen baru</p>
                  </td>
                </tr>
              ) : (
                filteredDocuments.map((doc, idx) => {
                  const filename = doc.filename || doc.name || doc.id || 'Untitled';
                  const category = doc.payload?.category || doc.category || 'No category';
                  const deleteKey = `${filename}_${category}`;
                  const isDeleting = deletingDoc === deleteKey;

                  return (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-cyan-100 flex items-center justify-center text-cyan-600">
                            <svg className="w-4 h-4 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="ml-2 sm:ml-4 min-w-0">
                            <div className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[120px] sm:max-w-none">{filename}</div>
                            {/* Show category on mobile below filename */}
                            <div className="sm:hidden mt-1">
                              <span className="px-2 py-0.5 inline-flex text-xs leading-4 font-medium rounded-full bg-blue-100 text-blue-800">
                                {getCategoryDisplay(category)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <span className="px-2 sm:px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {getCategoryDisplay(category)}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-500">
                        {doc.chunk_count || '-'}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleDeleteDocument(filename, category)}
                          disabled={isDeleting}
                          className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-colors disabled:opacity-50 text-xs sm:text-sm"
                        >
                          {isDeleting ? '...' : 'Hapus'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[100] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-gray-900/75 transition-opacity backdrop-blur-sm" aria-hidden="true" onClick={closeModal}></div>

          {/* Modal Panel */}
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
            <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4" id="modal-title">
                      Upload Dokumen Baru
                    </h3>
                    
                    <form onSubmit={handleUpload} className="space-y-4">
                      {/* Category Selection */}
                      <div>
                        <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                          Kategori
                        </label>
                        <select
                          id="category"
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white text-gray-900"
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
                        <label htmlFor="file-input" className="block text-sm font-medium text-gray-700 mb-1">
                          File
                        </label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl hover:bg-gray-50 transition-colors cursor-pointer relative">
                          <div className="space-y-1 text-center">
                            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <div className="flex text-sm text-gray-600 justify-center">
                              <label htmlFor="file-input" className="relative cursor-pointer bg-white rounded-md font-medium text-cyan-600 hover:text-cyan-500 focus-within:outline-none">
                                <span>Upload a file</span>
                                <input id="file-input" name="file-input" type="file" className="sr-only" onChange={handleFileChange} accept=".pdf,.doc,.docx,.txt,.md" disabled={isUploading} />
                              </label>
                              <p className="pl-1">or drag and drop</p>
                            </div>
                            <p className="text-xs text-gray-500">
                              PDF, DOC, DOCX, TXT up to 10MB
                            </p>
                          </div>
                        </div>
                        {file && (
                          <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 bg-cyan-50 p-2 rounded-lg">
                            <svg className="w-4 h-4 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="truncate font-medium">{file.name}</span>
                          </div>
                        )}
                      </div>

                      {/* Progress & Status */}
                      {(isUploading || uploadProgress) && (
                        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">{uploadProgress}</span>
                            <span className="font-medium text-cyan-600">{Math.round(uploadProgressPercent)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-cyan-500 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgressPercent}%` }}></div>
                          </div>
                        </div>
                      )}

                      {error && (
                        <div className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">
                          {error}
                        </div>
                      )}

                      {uploadResult && uploadResult.success && (
                        <div className="text-sm text-green-600 bg-green-50 p-2 rounded-lg">
                          Upload berhasil! {uploadResult.stats?.new_chunks} chunks baru ditambahkan.
                        </div>
                      )}

                      <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                        <button
                          type="submit"
                          disabled={!file || isUploading}
                          className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-base font-medium text-white hover:from-cyan-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isUploading ? 'Mengupload...' : 'Upload'}
                        </button>
                        <button
                          type="button"
                          onClick={closeModal}
                          className="mt-3 w-full inline-flex justify-center rounded-xl border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:mt-0 sm:w-auto sm:text-sm"
                        >
                          {uploadResult?.success ? 'Tutup' : 'Batal'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
