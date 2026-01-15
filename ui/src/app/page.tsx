import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth-helper';
import ModernNavbar from '@/components/ModernNavbar';

import Image from 'next/image';

// Server component: if authenticated -> /chat, otherwise show a landing page
export default async function Home() {
  const session = await getAuthSession();

  if (session?.user) {
    redirect('/chat');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-cyan-50">
      {/* ModernNavbar is a client component */}
      <ModernNavbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-20">
        {/* Hero Section */}
        <section className="grid md:grid-cols-2 gap-8 sm:gap-16 items-center mb-16 sm:mb-24">
          <div className="space-y-4 sm:space-y-6">
            <div className="inline-block">
              <span className="bg-cyan-100 text-cyan-700 text-xs sm:text-sm font-medium px-3 sm:px-4 py-1.5 sm:py-2 rounded-full">
                AI-Powered Academic Assistant
              </span>
            </div>
            
            <div className="relative w-full h-24 sm:h-32 md:h-40 -ml-2 sm:-ml-4">
              <Image
                src="https://i.ibb.co.com/zHhWc18h/Obrol-In.png"
                alt="Obrolin Logo"
                fill
                className="object-contain object-left"
                priority
              />
            </div>
            
            <p className="text-base sm:text-xl text-gray-600 leading-relaxed">
              Dapatkan jawaban cepat tentang pendaftaran, magang, program MBKM, dan panduan akademik kampus Anda. Berbicaralah dengan asisten cerdas yang paham aturan dan proses kampus.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-2 sm:pt-4">
              <a 
                href="/login" 
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-105 text-sm sm:text-base"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Mulai Sekarang
              </a>
              <a 
                href="/register" 
                className="inline-flex items-center justify-center gap-2 border-2 border-gray-300 hover:border-cyan-500 hover:bg-gray-50 text-gray-700 px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-medium transition-all text-sm sm:text-base"
              >
                Daftar Gratis
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
            </div>


          </div>

          <div className="relative mt-8 md:mt-0">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-300 to-blue-300 rounded-2xl sm:rounded-3xl blur-3xl opacity-20" />
            <div className="relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-8 border border-gray-100">
              <div className="flex items-center gap-2 mb-4 sm:mb-6">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500" />
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-yellow-500" />
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500" />
                <span className="ml-auto text-xs sm:text-sm text-gray-500 font-medium">Live Demo</span>
              </div>
              
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-800">Contoh Percakapan</h3>
              <div className="space-y-3 sm:space-y-4">
                <div className="flex gap-2 sm:gap-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0 flex items-center justify-center text-white text-xs sm:text-sm font-bold">
                    U
                  </div>
                  <div className="flex-1">
                    <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl sm:rounded-2xl rounded-tl-sm p-3 sm:p-4 shadow-sm">
                      <p className="text-xs sm:text-sm text-gray-800">Saya mau daftar Mata Kuliah X, bagaimana caranya?</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 sm:gap-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex-shrink-0 flex items-center justify-center">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-100 rounded-xl sm:rounded-2xl rounded-tl-sm p-3 sm:p-4 shadow-sm">
                      <p className="text-xs sm:text-sm text-gray-800">Berikut langkah pendaftaran mata kuliah:</p>
                      <ul className="mt-2 space-y-1 text-xs sm:text-sm text-gray-700">
                        <li className="flex items-start gap-2">
                          <span className="text-cyan-600">•</span>
                          <span>Login ke portal akademik</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-cyan-600">•</span>
                          <span>Pilih menu KRS</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-cyan-600">•</span>
                          <span>Tambahkan mata kuliah yang diinginkan</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 sm:gap-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0 flex items-center justify-center text-white text-xs sm:text-sm font-bold">
                    U
                  </div>
                  <div className="flex-1">
                    <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl sm:rounded-2xl rounded-tl-sm p-3 sm:p-4 shadow-sm">
                      <p className="text-xs sm:text-sm text-gray-800">Terima kasih! 🙏</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="mb-16 sm:mb-24">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">Kenapa Memilih Obrolin?</h2>
            <p className="text-sm sm:text-lg text-gray-600 max-w-2xl mx-auto">Solusi terbaik untuk kebutuhan informasi akademik Anda</p>
          </div>
          
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-8">
            <div className="group bg-white rounded-xl sm:rounded-2xl p-5 sm:p-8 shadow-lg border border-gray-100 hover:shadow-2xl hover:border-cyan-200 transition-all hover:-translate-y-1">
              <div className="w-11 h-11 sm:w-14 sm:h-14 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-5 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5 sm:w-7 sm:h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h4 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-gray-800">Akurat & Cepat</h4>
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed">Menjawab pertanyaan administratif dan akademik dengan referensi kebijakan kampus yang terpercaya dalam hitungan detik.</p>
            </div>

            <div className="group bg-white rounded-xl sm:rounded-2xl p-5 sm:p-8 shadow-lg border border-gray-100 hover:shadow-2xl hover:border-cyan-200 transition-all hover:-translate-y-1">
              <div className="w-11 h-11 sm:w-14 sm:h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-5 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5 sm:w-7 sm:h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                </svg>
              </div>
              <h4 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-gray-800">Mudah Digunakan</h4>
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed">Antarmuka sederhana dan intuitif: pilih kategori, ketik pertanyaan, dan dapatkan jawaban langsung tanpa ribet.</p>
            </div>

            <div className="group bg-white rounded-xl sm:rounded-2xl p-5 sm:p-8 shadow-lg border border-gray-100 hover:shadow-2xl hover:border-cyan-200 transition-all hover:-translate-y-1 sm:col-span-2 md:col-span-1">
              <div className="w-11 h-11 sm:w-14 sm:h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-5 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5 sm:w-7 sm:h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h4 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-gray-800">Terintegrasi</h4>
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed">Upload dokumen pendukung untuk membantu pencarian dan mendapatkan referensi jawaban yang lebih lengkap.</p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-gradient-to-r from-cyan-600 to-blue-600 rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center shadow-2xl">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4">Siap Memulai?</h2>
          <p className="text-cyan-50 text-sm sm:text-lg mb-6 sm:mb-8 max-w-2xl mx-auto">
            Bergabunglah dengan mahasiswa lain yang sudah menggunakan Obrolin untuk kemudahan akademik
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <a 
              href="/login" 
              className="inline-flex items-center justify-center gap-2 bg-white text-cyan-600 px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all transform hover:scale-105 text-sm sm:text-base"
            >
              Mulai Chat Sekarang
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          </div>
        </section>

        <footer className="mt-12 sm:mt-20 pt-6 sm:pt-8 border-t border-gray-200 text-center text-xs sm:text-sm text-gray-500">
          <p>© {new Date().getFullYear()} Obrolin — Sistem Informasi Akademik Berbasis AI</p>
        </footer>
      </main>
    </div>
  )
}
