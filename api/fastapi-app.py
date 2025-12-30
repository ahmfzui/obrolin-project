from fastapi import FastAPI, HTTPException, File, UploadFile, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uuid
import os
import json
import asyncio
from datetime import datetime
from dotenv import load_dotenv
from document_pipeline import DocumentPipeline
import logging

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB Limit

app = FastAPI(
    title="Chatbot & Document Processing API",
    description="Unified API for chatbot conversations and document processing with vector storage",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Initializing main agent graph...")
from main_agent import MainAgentGraph
main_agent = MainAgentGraph()
graph = main_agent.graph
print("Main agent initialized.")

print("Initializing document pipeline...")
document_pipeline = DocumentPipeline()
print("Document pipeline initialized.")

class UserMessage(BaseModel):
    conversation_id: str
    content: str
    category: Optional[str] = None  # Added optional category parameter

class ConversationID(BaseModel):
    conversation_id: str

class ConversationResponse(BaseModel):
    conversation_id: str
    created_at: str

class ChatResponse(BaseModel):
    response: str
    conversation_id: str
    timestamp: str
    success: bool

class HistoryResponse(BaseModel):
    conversation_id: str
    messages: List[Dict[str, Any]]

class DocumentUpload(BaseModel):
    category: str = "General"

class DocumentResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    stats: Dict[str, Any]
    error: Optional[str] = None

class SearchRequest(BaseModel):
    query: str
    category: Optional[str] = None
    limit: int = 5

class SearchResponse(BaseModel):
    results: List[Dict[str, Any]]
    total: int

def get_db_connection():
    import psycopg
    DB_URI = os.getenv("MEMORY_DB_URL")
    return psycopg.connect(DB_URI, autocommit=True)


def save_conversation_to_db(thread_id):
    """Save conversation ID to database"""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO conversation_metadata (thread_id) 
                    VALUES (%s) 
                    ON CONFLICT (thread_id) 
                    DO UPDATE SET last_activity = CURRENT_TIMESTAMP
                """, (thread_id,))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving conversation: {str(e)}")

def delete_conversation_from_db(thread_id):
    """Delete conversation from database"""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM conversation_metadata WHERE thread_id = %s", (thread_id,))
                if cur.rowcount == 0:
                    raise HTTPException(status_code=404, detail=f"Conversation {thread_id} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting conversation: {str(e)}")

def check_conversation_exists(thread_id):
    """Check if conversation exists in database"""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT EXISTS(SELECT 1 FROM conversation_metadata WHERE thread_id = %s)", (thread_id,))
                return cur.fetchone()[0]
    except Exception:
        return False

def get_conversation_history(thread_id):
    """Get conversation history from the graph state"""
    try:
        from langchain_core.messages import SystemMessage
        state = graph.get_state(config={"configurable": {"thread_id": thread_id}})
        if state.values and "messages" in state.values:
            return [msg for msg in state.values["messages"] if not isinstance(msg, SystemMessage)]
        return []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving conversation history: {str(e)}")

def send_message_to_agent(user_input, thread_id, category=None):
    """Send message to the chatbot and get response with optional category filter"""
    try:
        from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
        state = graph.get_state(config={"configurable": {"thread_id": thread_id}})
        
        messages = []
        
        if len(state.values) == 0:
            messages.append(SystemMessage(content=main_agent.system_prompt))
        
        # Add timestamp to user message
        messages.append(HumanMessage(content=user_input, additional_kwargs={"timestamp": get_current_datetime_string()}))
        
        # Include category in the state
        invoke_state = {"user_prompt": user_input, "messages": messages}
        if category:
            invoke_state["category"] = category
        
        result = graph.invoke(
            invoke_state,
            config={"configurable": {"thread_id": thread_id}}
        )
        
        save_conversation_to_db(thread_id)
        
        # Update AI message with timestamp
        updated_state = graph.get_state(config={"configurable": {"thread_id": thread_id}})
        if updated_state.values and "messages" in updated_state.values:
            latest_message = updated_state.values["messages"][-1]
            if isinstance(latest_message, AIMessage):
                # Add timestamp to the AI message
                latest_message.additional_kwargs["timestamp"] = get_current_datetime_string()
                # Update the state with the modified message
                graph.update_state(config={"configurable": {"thread_id": thread_id}}, values={"messages": [latest_message]})
                return latest_message.content
        
        return "No response generated"
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error sending message: {str(e)}")

def get_current_datetime_string(with_day=False):
    """Get current datetime string"""
    if with_day:
        return datetime.now().strftime("%A %Y-%m-%d %H:%M:%S")
    else:
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

# API Endpoints

@app.post("/conversations/create/", response_model=ConversationResponse)
def create_conversation():
    """Create a new conversation"""
    thread_id = str(uuid.uuid4())
    save_conversation_to_db(thread_id)
    
    return ConversationResponse(
        conversation_id=thread_id,
        created_at=get_current_datetime_string(with_day=True)
    )

@app.get("/conversations/list/")
def list_conversations():
    """List all conversations"""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT thread_id, created_at, last_activity FROM conversation_metadata ORDER BY last_activity DESC")
                conversations = []
                for row in cur.fetchall():
                    conversations.append({
                        "conversation_id": row[0],
                        "created_at": row[1].strftime("%Y-%m-%d %H:%M:%S"),
                        "last_activity": row[2].strftime("%Y-%m-%d %H:%M:%S")
                    })
                return {"conversations": conversations}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading conversations: {str(e)}")

@app.delete("/conversations/delete/")
def delete_conversation(request: ConversationID):
    """Delete a conversation"""
    if not check_conversation_exists(request.conversation_id):
        raise HTTPException(status_code=404, detail=f"Conversation {request.conversation_id} not found")
    
    delete_conversation_from_db(request.conversation_id)
    
    return {"message": f"Conversation {request.conversation_id} has been deleted"}

@app.post("/conversations/chat/", response_model=ChatResponse)
def chat(input_payload: UserMessage):
    """Send a message to the chatbot with optional category filter"""
    thread_id = input_payload.conversation_id
    
    # Check if conversation exists
    if not check_conversation_exists(thread_id):
        raise HTTPException(status_code=404, detail=f"Conversation {thread_id} not found")
    
    if not input_payload.content.strip():
        raise HTTPException(status_code=400, detail="Message content cannot be empty")
    
    # Send message and get response with category filter if provided
    response_content = send_message_to_agent(
        input_payload.content, 
        thread_id,
        category=input_payload.category
    )
    
    return ChatResponse(
        response=response_content,
        conversation_id=thread_id,
        timestamp=get_current_datetime_string(with_day=True),
        success=True
    )

@app.post("/conversations/chat-stream/")
async def chat_stream(input_payload: UserMessage):
    """Stream chat responses with progress updates"""
    
    # 1. Check Connectivity (Fail Fast for 503)
    try:
        document_pipeline.check_health()
    except Exception as e:
        logger.error(f"Service unavailable: {e}")
        raise HTTPException(status_code=503, detail="Layanan database sedang tidak tersedia. Silakan coba beberapa saat lagi.")

    thread_id = input_payload.conversation_id
    
    if not check_conversation_exists(thread_id):
        raise HTTPException(status_code=404, detail=f"Conversation {thread_id} not found")
    
    if not input_payload.content.strip():
        raise HTTPException(status_code=400, detail="Message content cannot be empty")
    
    async def generate_stream():
        try:
            from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
            
            # Stage 1: Thinking (Immediate feedback)
            yield f"data: {json.dumps({'stage': 'thinking', 'message': 'Berpikir...', 'icon': '🤔'})}\n\n"
            
            # Prepare state
            state = graph.get_state(config={"configurable": {"thread_id": thread_id}})
            
            messages = []
            if len(state.values) == 0:
                messages.append(SystemMessage(content=main_agent.system_prompt))
            
            # Add timestamp to user message
            messages.append(HumanMessage(content=input_payload.content, additional_kwargs={"timestamp": get_current_datetime_string()}))
            
            invoke_state = {
                "user_prompt": input_payload.content, 
                "messages": messages
            }
            if input_payload.category:
                invoke_state["category"] = input_payload.category

            # Stream events from the graph
            full_response = ""
            async for event in graph.astream_events(
                invoke_state,
                config={"configurable": {"thread_id": thread_id}},
                version="v1"
            ):
                kind = event["event"]
                
                # Tool execution (Searching/Retrieving)
                if kind == "on_tool_start":
                    yield f"data: {json.dumps({'stage': 'searching', 'message': 'Mencari informasi...', 'icon': '🔍'})}\n\n"
                
                # LLM Streaming (Token by token)
                elif kind == "on_chat_model_stream":
                    chunk = event.get("data", {}).get("chunk")
                    if not chunk:
                        continue

                    # Extract content - OpenAI streaming returns string content directly
                    content_text = ""
                    if hasattr(chunk, "content"):
                        raw = chunk.content
                        if isinstance(raw, str):
                            content_text = raw
                        elif isinstance(raw, list):
                            # Rare: content as list of parts
                            for part in raw:
                                if isinstance(part, dict):
                                    content_text += part.get("text", "")
                                elif hasattr(part, "text"):
                                    content_text += part.text

                    # Only send if we have actual content
                    if content_text:
                        full_response += content_text
                        yield f"data: {json.dumps({'stage': 'streaming', 'content': content_text})}\n\n"

            # Update last activity
            save_conversation_to_db(thread_id)
            
            # Update AI message with timestamp
            updated_state = graph.get_state(config={"configurable": {"thread_id": thread_id}})
            if updated_state.values and "messages" in updated_state.values:
                latest_message = updated_state.values["messages"][-1]
                if isinstance(latest_message, AIMessage):
                    latest_message.additional_kwargs["timestamp"] = get_current_datetime_string()
                    graph.update_state(config={"configurable": {"thread_id": thread_id}}, values={"messages": [latest_message]})
            
            yield f"data: {json.dumps({'stage': 'complete', 'message': 'Selesai!', 'icon': '✅', 'full_content': full_response})}\n\n"
            
        except Exception as e:
            logger.error("Streaming error", exc_info=True)
            error_msg = str(e)
            # Graceful degradation for LLM Timeout/Errors
            if "timeout" in error_msg.lower() or "connection" in error_msg.lower() or "rate limit" in error_msg.lower():
                yield f"data: {json.dumps({'stage': 'error', 'message': 'Layanan sedang sibuk (Timeout/Busy). Silakan coba lagi nanti.', 'icon': '⏳'})}\n\n"
            else:
                yield f"data: {json.dumps({'stage': 'error', 'message': f'Terjadi kesalahan: {error_msg}', 'icon': '❌'})}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

def get_conversation_created_at(thread_id):
    """Get conversation creation time"""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT created_at FROM conversation_metadata WHERE thread_id = %s", (thread_id,))
                row = cur.fetchone()
                if row:
                    return row[0].strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        pass
    return get_current_datetime_string()

@app.post("/conversations/history/", response_model=HistoryResponse)
def get_conversation_history_endpoint(request: ConversationID):
    """Get conversation history"""
    if not check_conversation_exists(request.conversation_id):
        raise HTTPException(status_code=404, detail=f"Conversation {request.conversation_id} not found")
    
    from langchain_core.messages import HumanMessage, AIMessage
    messages = get_conversation_history(request.conversation_id)
    
    # Get conversation creation time as fallback for old messages
    fallback_timestamp = get_conversation_created_at(request.conversation_id)
    
    formatted_messages = []
    for message in messages:
        # Try to get timestamp from message metadata, fallback to conversation creation time
        timestamp = message.additional_kwargs.get("timestamp", fallback_timestamp)
        
        if isinstance(message, HumanMessage):
            formatted_messages.append({
                "type": "user",
                "content": message.content,
                "timestamp": timestamp
            })
        elif isinstance(message, AIMessage):
            if message.content:
                formatted_messages.append({
                    "type": "ai",
                    "content": message.content,
                    "timestamp": timestamp
                })
    
    return HistoryResponse(
        conversation_id=request.conversation_id,
        messages=formatted_messages
    )

@app.post("/documents/upload/", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    category: str = Form("General")
):
    """Upload and process document to vector database"""
    
    if not document_pipeline.document_extractor.is_supported_file(file.filename):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Supported: {document_pipeline.document_extractor.SUPPORTED_EXTENSIONS}"
        )
    
    try:
        content = await file.read()
        
        # Validate File Size (Max 100MB)
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File terlalu besar. Maksimal {MAX_FILE_SIZE // (1024*1024)}MB."
            )

        logger.info(f"Processing document: {file.filename}, category: {category}")
        
        result = document_pipeline.process_document(content, file.filename, category)
        
        if not result['success']:
            raise HTTPException(status_code=422, detail=result.get('error', 'Processing failed'))
        
        message = result.get('message', 'Document processed and indexed successfully')
        
        return DocumentResponse(
            success=True,
            message=message,
            stats=result.get('stats', {}),
            error=None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/documents/upload-stream")
async def upload_document_stream(
    file: UploadFile = File(...),
    category: str = Form("General")
):
    """Upload and process document with real-time progress streaming"""
    
    if not document_pipeline.document_extractor.is_supported_file(file.filename):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Supported: {document_pipeline.document_extractor.SUPPORTED_EXTENSIONS}"
        )
    
    content = await file.read()
    filename = file.filename
    
    async def generate_progress():
        try:
            yield f"data: {json.dumps({'stage': 'reading', 'progress': 5, 'message': 'Reading file...'})}\n\n"
            await asyncio.sleep(0.1)
            file_size_kb = len(content) / 1024
            
            yield f"data: {json.dumps({'stage': 'reading', 'progress': 10, 'message': f'File loaded ({file_size_kb:.2f} KB)'})}\n\n"
            await asyncio.sleep(0.1)
            
            yield f"data: {json.dumps({'stage': 'extracting', 'progress': 15, 'message': 'Extracting text from document...'})}\n\n"
            await asyncio.sleep(0.1)
            
            extraction_result = document_pipeline.document_extractor.extract_text(content, filename)
            
            if not extraction_result['success']:
                yield f"data: {json.dumps({'stage': 'error', 'progress': 0, 'message': extraction_result['error'], 'error': True})}\n\n"
                return
            
            text_content = extraction_result['text']
            text_length = len(text_content)
            
            yield f"data: {json.dumps({'stage': 'extracting', 'progress': 25, 'message': f'Text extracted ({text_length} characters)'})}\n\n"
            await asyncio.sleep(0.1)
            
            if text_length < 50:
                yield f"data: {json.dumps({'stage': 'error', 'progress': 0, 'message': 'Extracted text is too short', 'error': True})}\n\n"
                return
            
            yield f"data: {json.dumps({'stage': 'chunking', 'progress': 30, 'message': 'Splitting text into chunks...'})}\n\n"
            await asyncio.sleep(0.1)
            
            chunks = document_pipeline._chunk_text(text_content)
            chunk_count = len(chunks)
            
            yield f"data: {json.dumps({'stage': 'chunking', 'progress': 35, 'message': f'Created {chunk_count} chunks'})}\n\n"
            await asyncio.sleep(0.1)
            
            yield f"data: {json.dumps({'stage': 'deduplication', 'progress': 40, 'message': 'Checking for duplicates...'})}\n\n"
            await asyncio.sleep(0.1)
            
            existing_hashes = document_pipeline._get_existing_hashes()
            
            chunks_to_process = []
            chunk_hashes = []
            duplicates_found = 0
            
            for chunk_text in chunks:
                chunk_hash = document_pipeline._compute_hash(chunk_text)
                if chunk_hash in existing_hashes:
                    duplicates_found += 1
                    continue
                chunks_to_process.append(chunk_text)
                chunk_hashes.append(chunk_hash)
                existing_hashes.add(chunk_hash)
            
            yield f"data: {json.dumps({'stage': 'deduplication', 'progress': 45, 'message': f'Found {duplicates_found} duplicates, {len(chunks_to_process)} new chunks'})}\n\n"
            await asyncio.sleep(0.1)
            
            if not chunks_to_process:
                yield f"data: {json.dumps({'stage': 'complete', 'progress': 100, 'message': 'All chunks already exist', 'stats': {'total_chunks': chunk_count, 'duplicates_skipped': duplicates_found, 'new_chunks': 0}})}\n\n"
                return
            
            yield f"data: {json.dumps({'stage': 'embedding', 'progress': 50, 'message': 'Generating embeddings...'})}\n\n"
            await asyncio.sleep(0.1)
            
            points = []
            total_batches = (len(chunks_to_process) + 19) // 20
            
            for batch_idx, start in enumerate(range(0, len(chunks_to_process), 20)):
                end = min(start + 20, len(chunks_to_process))
                batch_texts = chunks_to_process[start:end]
                batch_hashes = chunk_hashes[start:end]
                
                progress = 50 + int((batch_idx / total_batches) * 25)
                yield f"data: {json.dumps({'stage': 'embedding', 'progress': progress, 'message': f'Embedding batch {batch_idx + 1}/{total_batches}...'})}\n\n"
                await asyncio.sleep(0.1)
                
                dense_embs, sparse_vecs = document_pipeline._generate_embeddings(batch_texts)
                
                for idx, (chunk_text, chunk_hash, dense_emb, sparse_vec) in enumerate(zip(batch_texts, batch_hashes, dense_embs, sparse_vecs)):
                    import hashlib
                    point_id = hashlib.sha256(f"{filename}_{chunk_hash}".encode()).hexdigest()[:16]
                    point_id_int = int(point_id, 16) % (2**63)
                    
                    from qdrant_client.models import PointStruct
                    point = PointStruct(
                        id=point_id_int,
                        vector={"dense": dense_emb, "sparse": sparse_vec},
                        payload={
                            "text": chunk_text,
                            "filename": filename,
                            "category": category,
                            "content_hash": chunk_hash,
                            "chunk_index": start + idx,
                            "extraction_metadata": extraction_result.get('metadata', {})
                        }
                    )
                    points.append(point)
            
            yield f"data: {json.dumps({'stage': 'embedding', 'progress': 75, 'message': f'Generated {len(points)} embeddings'})}\n\n"
            await asyncio.sleep(0.1)
            
            yield f"data: {json.dumps({'stage': 'storing', 'progress': 80, 'message': 'Storing vectors in database...'})}\n\n"
            await asyncio.sleep(0.1)
            
            total_store_batches = (len(points) + 9) // 10
            for store_idx in range(0, len(points), 10):
                batch_points = points[store_idx:store_idx + 10]
                document_pipeline._retry_upsert(batch_points)
                
                progress = 80 + int(((store_idx // 10) / total_store_batches) * 15)
                yield f"data: {json.dumps({'stage': 'storing', 'progress': progress, 'message': f'Storing batch {(store_idx // 10) + 1}/{total_store_batches}...'})}\n\n"
                await asyncio.sleep(0.1)
            
            yield f"data: {json.dumps({'stage': 'storing', 'progress': 95, 'message': 'Finalizing storage...'})}\n\n"
            await asyncio.sleep(0.1)
            
            from document_pipeline import COLLECTION_NAME
            collection_info = document_pipeline.qdrant_client.get_collection(COLLECTION_NAME)
            
            stats = {
                'total_chunks': chunk_count,
                'duplicates_skipped': duplicates_found,
                'new_chunks': len(chunks_to_process),
                'total_points_in_collection': collection_info.points_count,
                'text_length': text_length,
                'extraction_metadata': extraction_result.get('metadata', {})
            }
            
            yield f"data: {json.dumps({'stage': 'complete', 'progress': 100, 'message': 'Document processed successfully!', 'stats': stats})}\n\n"
            
        except Exception as e:
            logger.error(f"Streaming error: {str(e)}")
            yield f"data: {json.dumps({'stage': 'error', 'progress': 0, 'message': str(e), 'error': True})}\n\n"
    
    return StreamingResponse(generate_progress(), media_type="text/event-stream")

@app.get("/documents/categories/")
async def get_categories():
    """Get all unique categories from documents"""
    categories = document_pipeline.get_unique_categories()
    return {"categories": categories}

@app.post("/documents/search/", response_model=SearchResponse)
def search_documents(request: SearchRequest):
    """Search documents in vector database"""
    
    try:
        results = document_pipeline.search(
            query=request.query,
            category_filter=request.category,
            limit=request.limit
        )
        
        return SearchResponse(
            results=results,
            total=len(results)
        )
        
    except Exception as e:
        logger.error(f"Search error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/documents/formats/")
def get_supported_formats():
    """Get supported document formats"""
    return {
        "formats": document_pipeline.document_extractor.SUPPORTED_EXTENSIONS,
        "ocr_support": document_pipeline.document_extractor.use_ocr,
        "ocr_languages": document_pipeline.document_extractor.ocr_languages
    }

@app.get("/documents/list/")
def list_documents(category: Optional[str] = None):
    """List all documents in database"""
    try:
        documents = document_pipeline.list_documents(category_filter=category)
        return {"documents": documents, "total": len(documents)}
    except Exception as e:
        logger.error(f"List documents error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/documents/categories/")
def get_categories():
    """Get list of all unique categories from documents in database"""
    try:
        categories = set()
        offset = None
        
        while True:
            result = document_pipeline.qdrant_client.scroll(
                collection_name=document_pipeline.qdrant_client.get_collection(
                    os.getenv("QDRANT_COLLECTION", "knowledge_base")
                ).name,
                limit=100,
                with_payload=["category"],
                with_vectors=False,
                offset=offset
            )
            
            points, next_offset = result
            
            if not points:
                break
            
            for point in points:
                if point.payload and 'category' in point.payload:
                    categories.add(point.payload['category'])
            
            if next_offset is None:
                break
                
            offset = next_offset
        
        return {
            "categories": sorted(list(categories)),
            "total": len(categories)
        }
    except Exception as e:
        logger.error(f"Get categories error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/documents/delete/")
def delete_document(request: Dict[str, str]):
    """Delete document and all its chunks"""
    filename = request.get('filename')
    category = request.get('category')
    
    if not filename:
        raise HTTPException(status_code=400, detail="Filename is required")
    
    try:
        result = document_pipeline.delete_document(filename, category)
        
        if result['success']:
            return {
                "message": f"Deleted {result['deleted_count']} chunks from {filename}",
                "deleted_count": result['deleted_count']
            }
        else:
            raise HTTPException(status_code=404, detail=result.get('error', 'Document not found'))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete document error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health/")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "chatbot": "operational",
        "document_pipeline": "operational",
        "timestamp": get_current_datetime_string(with_day=True)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)