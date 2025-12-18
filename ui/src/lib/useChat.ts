// Simple React hook to send chat messages via Next.js API `/api/chat`.
// Returns the response and conversation_id (created automatically if not provided).
import { useState } from 'react';

type SendResult = {
  answer: string;
  conversation_id?: string;
};

export function useChat() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(question: string, category: string, conversation_id?: string): Promise<SendResult> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, category, conversation_id }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Request failed ${res.status}`);
      }
      const data = await res.json();
      return { answer: data.answer, conversation_id: data.conversation_id } as SendResult;
    } catch (err: any) {
      setError(err?.message ?? String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }

  return { send, loading, error } as const;
}

export default useChat;
