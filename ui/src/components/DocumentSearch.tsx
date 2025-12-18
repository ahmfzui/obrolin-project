'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

const categories = [
  { id: '', name: 'Semua Category' },
  { id: 'Capstone', name: 'Capstone (Tugas Akhir)' },
  { id: 'KP', name: 'KP (Kerja Praktek)' },
  { id: 'MBKM', name: 'MBKM' },
  { id: 'Registrasi MK', name: 'Registrasi MK' },
  { id: 'General', name: 'General' },
];

interface SearchResult {
  text: string;
  filename: string;
  category: string;
  score: number;
  chunk_index?: number;
}

export default function DocumentSearch() {
  const { data: session } = useSession();
  const [query, setQuery] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string>('');
  const [searchPerformed, setSearchPerformed] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      setError('Masukkan query pencarian');
      return;
    }

    setIsSearching(true);
    setError('');
    setSearchPerformed(false);

    try {
      const response = await fetch('/api/documents/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          category: category || undefined,
          limit: 10,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Search gagal');
      }

      const data = await response.json();
      setResults(data.results || []);
      setSearchPerformed(true);

    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Terjadi kesalahan saat search');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  if (!session) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">Silakan login terlebih dahulu untuk mencari dokumen.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Cari Dokumen</h2>
      
      <form onSubmit={handleSearch} className="space-y-4 mb-6">
        {/* Category Filter */}
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
            Filter Category (Opsional)
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSearching}
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Search Input */}
        <div>
          <label htmlFor="search-query" className="block text-sm font-medium text-gray-700 mb-2">
            Query Pencarian
          </label>
          <div className="flex gap-2">
            <input
              id="search-query"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Masukkan kata kunci pencarian..."
              disabled={isSearching}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={isSearching || !query.trim()}
              className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isSearching ? 'Mencari...' : 'Cari'}
            </button>
          </div>
        </div>
      </form>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Search Results */}
      {searchPerformed && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-lg font-semibold text-gray-800">
              Hasil Pencarian: {results.length} dokumen ditemukan
            </h3>
          </div>

          {results.length === 0 ? (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-md text-center">
              <p className="text-gray-600">Tidak ada dokumen yang cocok dengan pencarian Anda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((result, index) => (
                <div
                  key={index}
                  className="p-4 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-gray-800">{result.filename}</h4>
                      <div className="flex gap-2 mt-1">
                        <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                          {result.category}
                        </span>
                        <span className="inline-block px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                          Score: {(result.score * 100).toFixed(1)}%
                        </span>
                        {result.chunk_index !== undefined && (
                          <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
                            Chunk #{result.chunk_index}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-3">
                    {result.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      {!searchPerformed && !isSearching && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h3 className="font-semibold text-blue-800 mb-2">Tips Pencarian:</h3>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>Gunakan kata kunci yang spesifik untuk hasil lebih akurat</li>
            <li>Filter berdasarkan category untuk mempersempit hasil</li>
            <li>Pencarian menggunakan semantic search (AI-powered)</li>
          </ul>
        </div>
      )}
    </div>
  );
}
