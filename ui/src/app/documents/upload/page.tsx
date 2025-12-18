import DocumentUpload from '@/components/DocumentUpload';
import ModernNavbar from '@/components/ModernNavbar';

export const metadata = {
  title: 'Upload Document',
  description: 'Upload documents to RAG backend',
};

export default function UploadPage() {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-br from-gray-50 via-white to-cyan-50">
      <ModernNavbar />

      <main className="flex-1 overflow-auto py-8">
        <div className="max-w-7xl mx-auto px-6">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">Upload Document</h1>
                <p className="text-sm text-gray-600 mt-1">Upload dokumen untuk indexing RAG system</p>
              </div>
            </div>
          </div>

          <DocumentUpload />
        </div>
      </main>
    </div>
  );
}
