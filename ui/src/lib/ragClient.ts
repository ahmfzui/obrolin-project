// Helper client to call the external RAG FastAPI service
// Provides complete wrappers for all FastAPI endpoints
const RAG_API_URL = process.env.RAG_API_URL || 'http://localhost:5000';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type CreateConversationResp = {
  conversation_id: string;
  created_at?: string;
};

export type ChatResp = {
  response: string;
  conversation_id: string;
  timestamp?: string;
  success?: boolean;
};

export type ConversationItem = {
  conversation_id: string;
  created_at: string;
  last_activity: string;
};

export type ConversationListResp = {
  conversations: ConversationItem[];
};

export type HistoryMessage = {
  type: 'user' | 'ai';
  content: string;
  timestamp: string;
};

export type HistoryResp = {
  conversation_id: string;
  messages: HistoryMessage[];
};

export type DocumentStats = {
  total_chunks: number;
  duplicates_skipped: number;
  new_chunks: number;
  total_points_in_collection?: number;
  text_length?: number;
  extraction_metadata?: Record<string, any>;
};

export type DocumentUploadResp = {
  success: boolean;
  message?: string;
  stats: DocumentStats;
  error?: string;
};

export type SearchResult = {
  text: string;
  filename: string;
  category: string;
  score: number;
  chunk_index?: number;
};

export type SearchResp = {
  results: SearchResult[];
  total: number;
};

export type DocumentItem = {
  filename: string;
  category: string;
  chunk_count: number;
  last_updated?: string;
};

export type CategoriesResp = {
  categories: string[];
  total: number;
};

export type HealthResp = {
  status: string;
  chatbot: string;
  document_pipeline: string;
  timestamp: string;
};

// ============================================
// HELPER FUNCTIONS
// ============================================

async function handleJsonResponse(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(text || res.statusText);
  }
}

// ============================================
// CONVERSATION ENDPOINTS
// ============================================

export async function createConversation(): Promise<CreateConversationResp> {
  const res = await fetch(`${RAG_API_URL}/conversations/create/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`createConversation failed: ${res.status} ${body}`);
  }
  return handleJsonResponse(res) as Promise<CreateConversationResp>;
}

export async function listConversations(): Promise<ConversationListResp> {
  const res = await fetch(`${RAG_API_URL}/conversations/list/`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`listConversations failed: ${res.status} ${body}`);
  }
  return handleJsonResponse(res) as Promise<ConversationListResp>;
}

export async function deleteConversation(conversation_id: string): Promise<{ message: string }> {
  const res = await fetch(`${RAG_API_URL}/conversations/delete/`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation_id }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`deleteConversation failed: ${res.status} ${body}`);
  }
  return handleJsonResponse(res);
}

export async function getConversationHistory(conversation_id: string): Promise<HistoryResp> {
  const res = await fetch(`${RAG_API_URL}/conversations/history/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation_id }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`getConversationHistory failed: ${res.status} ${body}`);
  }
  return handleJsonResponse(res) as Promise<HistoryResp>;
}

export async function chatWithRag(
  conversation_id: string,
  content: string,
  category?: string
): Promise<ChatResp> {
  const res = await fetch(`${RAG_API_URL}/conversations/chat/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation_id, content, category }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`chatWithRag failed: ${res.status} ${body}`);
  }
  return handleJsonResponse(res) as Promise<ChatResp>;
}

// ============================================
// DOCUMENT ENDPOINTS
// ============================================

export async function uploadDocument(
  file: File,
  category: string = 'General'
): Promise<DocumentUploadResp> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);

  const res = await fetch(`${RAG_API_URL}/documents/upload/`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`uploadDocument failed: ${res.status} ${body}`);
  }
  return handleJsonResponse(res) as Promise<DocumentUploadResp>;
}

export async function uploadDocumentStream(
  file: File,
  category: string = 'General',
  onProgress?: (data: any) => void
): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);

  const res = await fetch(`${RAG_API_URL}/documents/upload-stream?category=${category}`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`uploadDocumentStream failed: ${res.status}`);
  }

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) throw new Error('No response body');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split('\n\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          onProgress?.(data);
        } catch (e) {
          console.error('Failed to parse SSE data:', e);
        }
      }
    }
  }
}

export async function searchDocuments(
  query: string,
  category?: string,
  limit: number = 5
): Promise<SearchResp> {
  const res = await fetch(`${RAG_API_URL}/documents/search/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, category, limit }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`searchDocuments failed: ${res.status} ${body}`);
  }
  return handleJsonResponse(res) as Promise<SearchResp>;
}

export async function listDocuments(category?: string): Promise<{ documents: DocumentItem[]; total: number }> {
  const url = category
    ? `${RAG_API_URL}/documents/list/?category=${encodeURIComponent(category)}`
    : `${RAG_API_URL}/documents/list/`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`listDocuments failed: ${res.status} ${body}`);
  }
  return handleJsonResponse(res);
}

export async function getCategories(): Promise<CategoriesResp> {
  const res = await fetch(`${RAG_API_URL}/documents/categories/`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`getCategories failed: ${res.status} ${body}`);
  }
  return handleJsonResponse(res) as Promise<CategoriesResp>;
}

export async function deleteDocument(filename: string, category?: string): Promise<{ message: string; deleted_count: number }> {
  const res = await fetch(`${RAG_API_URL}/documents/delete/`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, category }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`deleteDocument failed: ${res.status} ${body}`);
  }
  return handleJsonResponse(res);
}

export async function getSupportedFormats(): Promise<{ formats: string[]; ocr_support: boolean; ocr_languages: string[] }> {
  const res = await fetch(`${RAG_API_URL}/documents/formats/`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`getSupportedFormats failed: ${res.status} ${body}`);
  }
  return handleJsonResponse(res);
}

// ============================================
// HEALTH CHECK
// ============================================

export async function healthCheck(): Promise<HealthResp> {
  const res = await fetch(`${RAG_API_URL}/health/`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`healthCheck failed: ${res.status} ${body}`);
  }
  return handleJsonResponse(res) as Promise<HealthResp>;
}

export default {
  createConversation,
  chatWithRag,
};
