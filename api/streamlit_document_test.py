import streamlit as st
import requests
from pathlib import Path
import json

API_URL = "http://localhost:5000"

st.set_page_config(
    page_title="Document Processing",
    layout="wide"
)

st.title("Ngetest Document Processing + Vector Storage")

with st.sidebar:
    st.header("Configuration")
    
    api_status = st.empty()
    
    try:
        response = requests.get(f"{API_URL}/health", timeout=2)
        if response.status_code == 200:
            health = response.json()
            api_status.success("API: Connected")
            st.json(health)
        else:
            api_status.error("API: Error")
    except:
        api_status.error("API: Not running")
        st.error("Start API with: uvicorn fastapi-app:app --reload")
    
    st.divider()
    
    try:
        response = requests.get(f"{API_URL}/documents/formats")
        if response.status_code == 200:
            formats = response.json()
            st.subheader("Supported Formats")
            for format_type, extensions in formats['formats'].items():
                st.text(f"{format_type}: {', '.join(extensions)}")
            if formats.get('ocr_support'):
                st.info(f"OCR: {', '.join(formats.get('ocr_languages', []))}")
    except:
        pass

st.divider()

tab1, tab2, tab3 = st.tabs(["Upload Document", "Search Documents", "Manage Documents"])

with tab1:
    st.subheader("Upload New Document")
    
    uploaded_file = st.file_uploader(
        "Choose a file",
        type=['pdf', 'docx', 'pptx', 'xlsx', 'txt', 'md'],
        help="Upload a document to extract text and store in vector database"
    )

    if uploaded_file:
        st.divider()
        st.markdown("#### File Information")
        
        col1, col2, col3 = st.columns(3)
        with col1:
            st.markdown(f"**Filename**")
            st.text(uploaded_file.name)
        with col2:
            st.markdown(f"**Type**")
            st.text(Path(uploaded_file.name).suffix.upper())
        with col3:
            st.markdown(f"**Size**")
            st.text(f"{uploaded_file.size / 1024:.2f} KB")
        
        st.divider()
        
        category = st.selectbox(
            "Select Category",
            options=["Capstone", "KP", "MBKM", "Registrasi MK"],
            help="Categorize this document for easier searching"
        )
        
        st.write("")
        
        if st.button("📤 Process & Store Document", type="primary", use_container_width=True):
            progress_bar = st.progress(0)
            status_text = st.empty()
            stage_info = st.empty()
            
            try:
                files = {"file": (uploaded_file.name, uploaded_file.getvalue())}
                params = {"category": category}
                
                response = requests.post(
                    f"{API_URL}/documents/upload-stream",
                    files=files,
                    params=params,
                    stream=True,
                    timeout=300
                )
                
                final_stats = None
                has_error = False
                error_message = ""
                
                for line in response.iter_lines():
                    if line:
                        line_str = line.decode('utf-8')
                        if line_str.startswith('data: '):
                            data = json.loads(line_str[6:])
                            
                            stage = data.get('stage', '')
                            progress = data.get('progress', 0)
                            message = data.get('message', '')
                            
                            progress_bar.progress(progress / 100)
                            status_text.text(message)
                            
                            stage_icons = {
                                'reading': '📁',
                                'extracting': '📄',
                                'chunking': '✂️',
                                'deduplication': '🔍',
                                'embedding': '🧠',
                                'storing': '💾',
                                'complete': '✅',
                                'error': '❌'
                            }
                            
                            icon = stage_icons.get(stage, '⏳')
                            stage_info.markdown(f"**{icon} {stage.upper()}**")
                            
                            if data.get('error'):
                                has_error = True
                                error_message = message
                                break
                            
                            if stage == 'complete' and 'stats' in data:
                                final_stats = data['stats']
                
                progress_bar.empty()
                status_text.empty()
                stage_info.empty()
                
                if has_error:
                    st.error(f"Processing failed: {error_message}")
                elif final_stats:
                    st.divider()
                    st.success("Document processed successfully!")
                    
                    st.markdown("#### Processing Statistics")
                    col1, col2, col3 = st.columns(3)
                    with col1:
                        st.metric("Total Chunks", final_stats.get('total_chunks', 0))
                    with col2:
                        st.metric("New Chunks", final_stats.get('new_chunks', 0))
                    with col3:
                        st.metric("Duplicates Skipped", final_stats.get('duplicates_skipped', 0))
                    
                    with st.expander("View Detailed Metadata"):
                        st.json(final_stats)
                else:
                    st.warning("Processing completed but no statistics returned")
                    
            except requests.exceptions.ConnectionError:
                st.error("Cannot connect to API. Make sure it's running.")
            except Exception as e:
                st.error(f"Error: {str(e)}")
            finally:
                progress_bar.empty()
                status_text.empty()
                stage_info.empty()

with tab2:
    st.subheader("Search Documents")
    
    query = st.text_input(
        "Enter your search query",
        placeholder="Type keywords or questions...",
        help="Search across all document chunks using hybrid vector search"
    )
    
    col1, col2 = st.columns([3, 1])
    with col1:
        search_category = st.selectbox(
            "Filter by Category",
            options=["All", "Capstone", "KP", "MBKM", "Registrasi MK"],
            key="search_category"
        )
    with col2:
        limit = st.number_input("Max Results", min_value=1, max_value=20, value=5)
    
    st.write("")
    
    if st.button("🔍 Search Documents", type="primary", use_container_width=True):
        if not query:
            st.warning("Please enter a search query")
        else:
            with st.spinner("Searching..."):
                try:
                    payload = {
                        "query": query,
                        "category": None if search_category == "All" else search_category,
                        "limit": limit
                    }
                    response = requests.post(f"{API_URL}/documents/search", json=payload)
                    
                    if response.status_code == 200:
                        result = response.json()
                        results = result.get('results', [])
                        
                        st.divider()
                        st.success(f"Found {result.get('total', 0)} result(s)")
                        
                        for idx, res in enumerate(results, 1):
                            with st.container():
                                col1, col2, col3 = st.columns([3, 1.5, 0.5])
                                with col1:
                                    st.markdown(f"**{idx}. {res.get('filename', 'Unknown')}**")
                                with col2:
                                    st.markdown(f"📁 {res.get('category', 'N/A')}")
                                with col3:
                                    st.markdown(f"⭐ {res.get('score', 0):.3f}")
                                
                                st.markdown(f"*Chunk #{res.get('chunk_index', 0)}*")
                                
                                with st.container():
                                    st.markdown("---")
                                    st.markdown(res.get('text', ''))
                                
                                st.divider()
                    else:
                        st.error(f"Search failed: {response.json().get('detail', 'Unknown error')}")
                        
                except requests.exceptions.ConnectionError:
                    st.error("Cannot connect to API. Make sure it's running.")
                except Exception as e:
                    st.error(f"Error: {str(e)}")

with tab3:
    st.subheader("Document Library")
    
    col1, col2 = st.columns([4, 1])
    with col1:
        filter_category = st.selectbox(
            "Filter by Category",
            options=["All", "Capstone", "KP", "MBKM", "Registrasi MK"],
            key="manage_category"
        )
    with col2:
        st.write("")
        if st.button("Refresh", use_container_width=True):
            st.rerun()
    
    st.divider()
    
    try:
        params = {} if filter_category == "All" else {"category": filter_category}
        response = requests.get(f"{API_URL}/documents/list", params=params)
        
        if response.status_code == 200:
            documents = response.json().get('documents', [])
            
            if documents:
                st.success(f"Found {len(documents)} document(s)")
                
                for idx, doc in enumerate(documents, 1):
                    with st.container():
                        col1, col2, col3, col4, col5 = st.columns([3, 1.5, 1.5, 1, 1])
                        
                        with col1:
                            st.markdown(f"**{idx}. {doc['filename']}**")
                        with col2:
                            st.markdown(f"`{doc['file_type'].upper()}`")
                        with col3:
                            st.markdown(f"📁 {doc['category']}")
                        with col4:
                            st.markdown(f"📊 {doc['chunk_count']} chunks")
                        with col5:
                            delete_key = f"del_{doc['filename'].replace('.', '_')}_{doc['category']}_{idx}"
                            if st.button("🗑️", key=delete_key, help="Delete document"):
                                with st.spinner(f"Deleting {doc['filename']}..."):
                                    try:
                                        del_response = requests.delete(
                                            f"{API_URL}/documents/delete",
                                            json={"filename": doc['filename'], "category": doc['category']}
                                        )
                                        
                                        if del_response.status_code == 200:
                                            st.success(f"Deleted {doc['filename']}")
                                            st.rerun()
                                        else:
                                            st.error(f"Delete failed: {del_response.json().get('detail', 'Unknown error')}")
                                    except Exception as e:
                                        st.error(f"Error: {str(e)}")
                        
                        st.divider()
            else:
                st.warning("No documents found")
        else:
            st.error(f"Failed to load documents: {response.json().get('detail', 'Unknown error')}")
            
    except requests.exceptions.ConnectionError:
        st.error("Cannot connect to API. Make sure it's running.")
    except Exception as e:
        st.error(f"Error: {str(e)}")

st.divider()

with st.expander("API Documentation"):
    st.markdown("""
    ### Document Endpoints
    
    **POST /documents/upload**
    - Upload and process document to vector database
    - Parameters: `file` (multipart/form-data), `category` (query parameter)
    - Returns: Processing statistics and indexing results
    
    **POST /documents/upload-stream**
    - Upload and process document with real-time progress streaming
    - Parameters: `file` (multipart/form-data), `category` (query parameter)
    - Returns: Server-Sent Events (SSE) stream with progress updates
    - Progress stages: Reading → Extracting → Chunking → Deduplication → Embedding → Storing → Complete
    - Each stage includes progress percentage and detailed status messages
    
    **POST /documents/search**
    - Search documents in vector database
    - Body: `{"query": "search text", "category": "optional", "limit": 5}`
    - Returns: List of matching document chunks with scores
    
    **GET /documents/list**
    - List all documents in database
    - Parameters: `category` (optional query parameter)
    - Returns: List of documents with filename, type, category, and chunk count
    
    **DELETE /documents/delete**
    - Delete document and all its chunks from database
    - Body: `{"filename": "file.pdf", "category": "Capstone"}`
    - Returns: Deletion confirmation and deleted chunk count
    
    **GET /documents/formats**
    - List supported file formats and OCR settings
    - Returns: Supported formats and OCR configuration
    
    **GET /health**
    - Health check for all services
    - Returns: System status and timestamp
    
    ### Conversation Endpoints
    
    **POST /conversations/create**
    - Create a new conversation
    - Returns: New conversation ID and timestamp
    
    **POST /conversations/chat**
    - Send message to chatbot
    - Body: `{"conversation_id": "uuid", "content": "message"}`
    - Returns: AI response and metadata
    
    **POST /conversations/history**
    - Get conversation history
    - Body: `{"conversation_id": "uuid"}`
    - Returns: Full conversation message history
    
    **GET /conversations/list**
    - List all conversations
    - Returns: All conversations with metadata
    
    **DELETE /conversations/delete**
    - Delete a conversation
    - Body: `{"conversation_id": "uuid"}`
    - Returns: Deletion confirmation
    """)