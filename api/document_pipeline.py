import os
import hashlib
from typing import Dict, List, Set
from dotenv import load_dotenv
from qdrant_client import QdrantClient, models
from qdrant_client.models import Distance, VectorParams, PointStruct
from openai import OpenAI
from langchain_text_splitters import RecursiveCharacterTextSplitter
from fastembed import SparseTextEmbedding
import logging

from document_extractor import DocumentExtractor

load_dotenv()

logger = logging.getLogger(__name__)

QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

COLLECTION_NAME = os.getenv("QDRANT_COLLECTION", "knowledge_base")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-large")
EMBEDDING_DIMENSION = int(os.getenv("EMBEDDING_DIMENSION", "3072"))
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "800"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "200"))

EMBEDDING_BATCH_SIZE = 20
UPLOAD_BATCH_SIZE = 10


class DocumentPipeline:
    
    def __init__(self):
        self.qdrant_client = QdrantClient(
            url=QDRANT_URL,
            api_key=QDRANT_API_KEY,
            timeout=120
        )
        self.openai_client = OpenAI(api_key=OPENAI_API_KEY)
        self.sparse_model = SparseTextEmbedding(model_name="Qdrant/minicoil-v1")
        self.document_extractor = DocumentExtractor(use_ocr=True, ocr_languages=['id', 'en'])
        
        self._ensure_collection()
    
    def check_health(self):
        """Check connectivity to Qdrant"""
        try:
            self.qdrant_client.get_collections()
            return True
        except Exception as e:
            logger.error(f"Qdrant health check failed: {e}")
            raise Exception(f"Vector DB Connection Failed: {str(e)}")

    def _ensure_collection(self):
        try:
            collections = self.qdrant_client.get_collections()
            existing = [col.name for col in collections.collections]
            
            if COLLECTION_NAME not in existing:
                self.qdrant_client.create_collection(
                    collection_name=COLLECTION_NAME,
                    vectors_config={
                        "dense": VectorParams(size=EMBEDDING_DIMENSION, distance=Distance.COSINE)
                    },
                    sparse_vectors_config={
                        "sparse": models.SparseVectorParams()
                    }
                )
                logger.info(f"Created collection: {COLLECTION_NAME}")
            
            # Create index for category
            try:
                self.qdrant_client.create_payload_index(
                    collection_name=COLLECTION_NAME,
                    field_name="category",
                    field_schema=models.PayloadSchemaType.KEYWORD
                )
            except Exception:
                pass
            
            # Create index for content_hash
            try:
                self.qdrant_client.create_payload_index(
                    collection_name=COLLECTION_NAME,
                    field_name="content_hash",
                    field_schema=models.PayloadSchemaType.KEYWORD
                )
            except Exception:
                pass
            
            # Create index for filename
            try:
                self.qdrant_client.create_payload_index(
                    collection_name=COLLECTION_NAME,
                    field_name="filename",
                    field_schema=models.PayloadSchemaType.KEYWORD
                )
                logger.info("Created index for filename")
            except Exception as e:
                logger.warning(f"Could not create index for filename: {e}")
            
            # Create index for chunk_index
            try:
                self.qdrant_client.create_payload_index(
                    collection_name=COLLECTION_NAME,
                    field_name="chunk_index",
                    field_schema=models.PayloadSchemaType.INTEGER
                )
                logger.info("Created index for chunk_index")
            except Exception as e:
                logger.warning(f"Could not create index for chunk_index: {e}")
                
        except Exception as e:
            logger.error(f"Error ensuring collection: {e}")
            raise
    
    def _chunk_text(self, text: str) -> List[str]:
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
            length_function=len,
            separators=["\n\n", "\n", ". ", " ", ""],
            keep_separator=True
        )
        return text_splitter.split_text(text)
    
    def _compute_hash(self, text: str) -> str:
        normalized = text.strip().lower()
        return hashlib.sha256(normalized.encode('utf-8')).hexdigest()
    
    def _get_existing_hashes(self) -> Set[str]:
        existing_hashes = set()
        
        try:
            offset = None
            while True:
                result = self.qdrant_client.scroll(
                    collection_name=COLLECTION_NAME,
                    limit=100,
                    with_payload=["content_hash"],
                    with_vectors=False,
                    offset=offset
                )
                
                points, next_offset = result
                
                if not points:
                    break
                
                for point in points:
                    if point.payload and "content_hash" in point.payload:
                        existing_hashes.add(point.payload["content_hash"])
                
                if next_offset is None:
                    break
                    
                offset = next_offset
                
        except Exception as e:
            logger.warning(f"Error retrieving existing hashes: {e}")
        
        return existing_hashes
    
    def _generate_embeddings(self, texts: List[str]):
        dense_resp = self.openai_client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=texts,
            dimensions=EMBEDDING_DIMENSION,
            encoding_format="float"
        )
        dense_embeddings = [item.embedding for item in dense_resp.data]
        
        sparse_results = list(self.sparse_model.embed(texts))
        sparse_vectors = [
            models.SparseVector(
                indices=result.indices.tolist(),
                values=result.values.tolist()
            )
            for result in sparse_results
        ]
        
        return dense_embeddings, sparse_vectors
    
    def _retry_upsert(self, points: List[PointStruct], max_retries: int = 5):
        import time
        for attempt in range(1, max_retries + 1):
            try:
                self.qdrant_client.upsert(
                    collection_name=COLLECTION_NAME,
                    points=points
                )
                return
            except Exception as e:
                if attempt == max_retries:
                    raise
                time.sleep(2 ** attempt)
    
    def process_document(self, file_content: bytes, filename: str, category: str = "General") -> Dict:
        
        extraction_result = self.document_extractor.extract_text(file_content, filename)
        
        if not extraction_result['success']:
            return {
                'success': False,
                'error': extraction_result['error'],
                'stats': {}
            }
        
        text_content = extraction_result['text']
        
        if not text_content or len(text_content.strip()) < 50:
            return {
                'success': False,
                'error': 'Extracted text is too short or empty',
                'stats': {}
            }
        
        chunks = self._chunk_text(text_content)
        
        if not chunks:
            return {
                'success': False,
                'error': 'Failed to create chunks from text',
                'stats': {}
            }
        
        existing_hashes = self._get_existing_hashes()
        
        chunks_to_process = []
        chunk_hashes = []
        duplicates_found = 0
        
        for chunk_text in chunks:
            chunk_hash = self._compute_hash(chunk_text)
            
            if chunk_hash in existing_hashes:
                duplicates_found += 1
                continue
            
            chunks_to_process.append(chunk_text)
            chunk_hashes.append(chunk_hash)
            existing_hashes.add(chunk_hash)
        
        if not chunks_to_process:
            return {
                'success': True,
                'message': 'All chunks already exist in database',
                'stats': {
                    'total_chunks': len(chunks),
                    'duplicates_skipped': duplicates_found,
                    'new_chunks': 0
                }
            }
        
        points = []
        
        for start in range(0, len(chunks_to_process), EMBEDDING_BATCH_SIZE):
            end = min(start + EMBEDDING_BATCH_SIZE, len(chunks_to_process))
            batch_texts = chunks_to_process[start:end]
            batch_hashes = chunk_hashes[start:end]
            
            dense_embs, sparse_vecs = self._generate_embeddings(batch_texts)
            
            for idx, (chunk_text, chunk_hash, dense_emb, sparse_vec) in enumerate(
                zip(batch_texts, batch_hashes, dense_embs, sparse_vecs)
            ):
                point_id = hashlib.sha256(f"{filename}_{chunk_hash}".encode()).hexdigest()[:16]
                point_id_int = int(point_id, 16) % (2**63)
                
                point = PointStruct(
                    id=point_id_int,
                    vector={
                        "dense": dense_emb,
                        "sparse": sparse_vec
                    },
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
                
                if len(points) >= UPLOAD_BATCH_SIZE:
                    self._retry_upsert(points)
                    points = []
        
        if points:
            self._retry_upsert(points)
        
        collection_info = self.qdrant_client.get_collection(COLLECTION_NAME)
        
        return {
            'success': True,
            'stats': {
                'total_chunks': len(chunks),
                'duplicates_skipped': duplicates_found,
                'new_chunks': len(chunks_to_process),
                'total_points_in_collection': collection_info.points_count,
                'text_length': len(text_content),
                'extraction_metadata': extraction_result.get('metadata', {})
            }
        }
    
    def search(self, query: str, category_filter: str = None, limit: int = 5, window_after: int = 9, window_before: int = 2) -> List[Dict]:
        """
        Search for documents and retrieve surrounding context chunks.
        
        Args:
            query: Search query
            category_filter: Optional category filter
            limit: Number of top results to find
            context_window: Number of chunks before and after each result to include
        """
        # Generate embeddings
        dense_resp = self.openai_client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=query,
            dimensions=EMBEDDING_DIMENSION,
            encoding_format="float"
        )
        dense_emb = dense_resp.data[0].embedding
        
        sparse_res = list(self.sparse_model.embed([query]))[0]
        sparse_vec = models.SparseVector(
            indices=sparse_res.indices.tolist(),
            values=sparse_res.values.tolist()
        )
        
        # Build filter
        query_filter = None
        if category_filter:
            query_filter = models.Filter(
                must=[
                    models.FieldCondition(
                        key="category",
                        match=models.MatchValue(value=category_filter)
                    )
                ]
            )
        
        # Get initial search results
        results = self.qdrant_client.query_points(
            collection_name=COLLECTION_NAME,
            prefetch=[
                models.Prefetch(
                    query=dense_emb,
                    using="dense",
                    limit=limit * 2
                ),
                models.Prefetch(
                    query=sparse_vec,
                    using="sparse",
                    limit=limit * 2
                ),
            ],
            query=models.FusionQuery(fusion=models.Fusion.RRF),
            limit=limit,
            query_filter=query_filter,
            with_payload=True
        )
        
        # Get top result
        if not results.points:
            return []
        
        top_result = results.points[0]
        filename = top_result.payload.get('filename', '')
        category = top_result.payload.get('category', '')
        top_chunk_index = top_result.payload.get('chunk_index', 0)
        
        # Calculate chunk range
        start_index = max(0, top_chunk_index - window_before)
        end_index = top_chunk_index + window_after

        # Build filter for surrounding chunks
        context_filter = models.Filter(
            must=[
                models.FieldCondition(
                    key="filename",
                    match=models.MatchValue(value=filename)
                ),
                models.FieldCondition(
                    key="category",
                    match=models.MatchValue(value=category)
                ),
                models.FieldCondition(
                    key="chunk_index",
                    range=models.Range(
                        gte=start_index,
                        lte=end_index
                    )
                )
            ]
        )
        
        # Fetch surrounding chunks
        context_results = self.qdrant_client.scroll(
            collection_name=COLLECTION_NAME,
            scroll_filter=context_filter,
            limit=window_before + window_after + 1,
            with_payload=True,
            with_vectors=False
        )
        
        # Sort by chunk_index to maintain order
        chunks = sorted(
            context_results[0],
            key=lambda p: p.payload.get('chunk_index', 0)
        )
        
        return [
            {
                'score': top_result.score if point.id == top_result.id else 0.0,
                'text': point.payload.get('text', ''),
                'filename': point.payload.get('filename', ''),
                'category': point.payload.get('category', ''),
                'chunk_index': point.payload.get('chunk_index', 0),
                'is_top_result': point.id == top_result.id
            }
            for point in chunks
        ]
    
    def list_documents(self, category_filter: str = None) -> List[Dict]:
        try:
            documents = {}
            
            query_filter = None
            if category_filter:
                query_filter = models.Filter(
                    must=[
                        models.FieldCondition(
                            key="category",
                            match=models.MatchValue(value=category_filter)
                        )
                    ]
                )
            
            offset = None
            while True:
                result = self.qdrant_client.scroll(
                    collection_name=COLLECTION_NAME,
                    limit=100,
                    with_payload=["filename", "category", "extraction_metadata"],
                    with_vectors=False,
                    offset=offset,
                    scroll_filter=query_filter
                )
                
                points, next_offset = result
                
                if not points:
                    break
                
                for point in points:
                    filename = point.payload.get('filename', 'Unknown')
                    category = point.payload.get('category', 'Unknown')
                    key = f"{filename}_{category}"
                    
                    if key not in documents:
                        metadata = point.payload.get('extraction_metadata', {})
                        documents[key] = {
                            'filename': filename,
                            'category': category,
                            'file_type': metadata.get('file_type', 'unknown'),
                            'chunk_count': 0
                        }
                    
                    documents[key]['chunk_count'] += 1
                
                if next_offset is None:
                    break
                    
                offset = next_offset
            
            return sorted(documents.values(), key=lambda x: x['filename'])
            
        except Exception as e:
            logger.error(f"Error listing documents: {e}")
            return []
    
    def delete_document(self, filename: str, category: str = None) -> Dict:
        try:
            filter_conditions = [
                models.FieldCondition(
                    key="filename",
                    match=models.MatchValue(value=filename)
                )
            ]
            
            if category:
                filter_conditions.append(
                    models.FieldCondition(
                        key="category",
                        match=models.MatchValue(value=category)
                    )
                )
            
            query_filter = models.Filter(must=filter_conditions)
            
            point_ids = []
            offset = None
            
            while True:
                result = self.qdrant_client.scroll(
                    collection_name=COLLECTION_NAME,
                    limit=100,
                    with_payload=False,
                    with_vectors=False,
                    offset=offset,
                    scroll_filter=query_filter
                )
                
                points, next_offset = result
                
                if not points:
                    break
                
                point_ids.extend([point.id for point in points])
                
                if next_offset is None:
                    break
                    
                offset = next_offset
            
            if not point_ids:
                return {
                    'success': False,
                    'error': 'Document not found',
                    'deleted_count': 0
                }
            
            self.qdrant_client.delete(
                collection_name=COLLECTION_NAME,
                points_selector=models.PointIdsList(points=point_ids)
            )
            
            return {
                'success': True,
                'deleted_count': len(point_ids)
            }
            
        except Exception as e:
            logger.error(f"Error deleting document: {e}")
            return {
                'success': False,
                'error': str(e),
                'deleted_count': 0
            }

    def get_unique_categories(self) -> List[str]:
        """
        Retrieve unique categories from the Qdrant collection.
        """
        try:
            categories = set()
            next_offset = None
            
            while True:
                records, next_offset = self.qdrant_client.scroll(
                    collection_name=COLLECTION_NAME,
                    scroll_filter=None,
                    limit=100,
                    with_payload=["category"],
                    with_vectors=False,
                    offset=next_offset
                )
                
                for record in records:
                    if record.payload and "category" in record.payload:
                        categories.add(record.payload["category"])
                
                if next_offset is None:
                    break
            
            return sorted(list(categories))
        except Exception as e:
            logger.error(f"Error retrieving categories: {e}")
            return []

