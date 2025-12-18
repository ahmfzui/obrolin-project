'use client';

interface ChatBubbleProps {
  text: string;
  isUser: boolean;
}

// Komponen UI murni untuk menampilkan satu gelembung pesan
export default function ChatBubble({ text, isUser }: ChatBubbleProps) {
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className="flex max-w-xs items-start space-x-2 md:max-w-md lg:max-w-lg">
        {/* Avatar untuk Bot (kiri) */}
        {!isUser && (
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-md">
            <svg
              className="h-5 w-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Bubble */}
        <div
          className={`group relative rounded-2xl px-4 py-3 shadow-md transition-all duration-300 hover:shadow-lg ${
            isUser
              ? 'rounded-tr-sm bg-gradient-to-br from-blue-600 to-blue-700 text-white'
              : 'rounded-tl-sm bg-white text-gray-800 ring-1 ring-gray-200'
          }`}
        >
          {/* Text content with markdown-like formatting support */}
          <div className={`text-sm leading-relaxed ${isUser ? 'text-white' : 'text-gray-800'}`}>
            <p className="whitespace-pre-wrap break-words">{text}</p>
          </div>

          {/* Timestamp (optional, bisa diaktifkan nanti) */}
          <div
            className={`mt-1 text-xs opacity-0 transition-opacity group-hover:opacity-70 ${
              isUser ? 'text-blue-100' : 'text-gray-500'
            }`}
          >
            {new Date().toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>

          {/* Tail/ekor bubble */}
          <div
            className={`absolute top-0 h-3 w-3 ${
              isUser
                ? 'right-0 -mr-1 bg-gradient-to-br from-blue-600 to-blue-700'
                : 'left-0 -ml-1 bg-white ring-1 ring-gray-200'
            }`}
            style={{
              clipPath: isUser
                ? 'polygon(100% 0, 0 0, 100% 100%)'
                : 'polygon(0 0, 100% 0, 0 100%)',
            }}
          />
        </div>

        {/* Avatar untuk User (kanan) */}
        {isUser && (
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-teal-600 shadow-md">
            <svg
              className="h-5 w-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}