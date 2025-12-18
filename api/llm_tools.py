from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field
from typing import List, Optional
from document_pipeline import DocumentPipeline
from typing import List, Annotated, Dict
from langgraph.prebuilt import InjectedState

document_pipeline = DocumentPipeline()


class RetrievalInput(BaseModel):
    query: str = Field(
        description="""Create a concise search query from the user's question to find relevant information in the university knowledge base.
        
        CRITICAL RULES:
        1. Extract ONLY 2-4 core keywords from the user's question
        2. Remove ALL filler words: "tolong", "saya ingin tahu", "bagaimana cara", "mohon info", "bisa", "ga", "dong"
        3. NEVER include the category name or document type in the query (already filtered automatically)
        4. Focus ONLY on what information is being sought, not how it's being asked
        
        Query Generation Examples:
        
        User: "siapa ketua tim penyusun dokumen capstone project?"
        Query : "ketua tim penyusun"
        
        User: "bagaimana cara pendaftaran mata kuliah semester depan?"
        Query : "pendaftaran mata kuliah"
        
        User: "tolong kasih tau syarat kelulusan mahasiswa program sarjana"
        Query : "syarat kelulusan"
        
        User: "jadwal pengerjaan tugas capstone project itu kapan ya?"
        Query : "jadwal pengerjaan"
        
        User: "struktur organisasi BEM fakultas teknik gimana?"
        Query : "struktur organisasi BEM"
        
        User: "dosen pembimbing capstone siapa aja?"
        Query : "dosen pembimbing"
        
        REMEMBER: Category filter is AUTOMATICALLY APPLIED. DO NOT include it in query!
        Generate the shortest possible query that captures the core information need.
        """
    )
    state : Annotated[Dict, InjectedState] = Field(
        title="State",
        description="The current state of the agent, which may include previous assessments and other relevant information."
    )


def qdrant_search(
    query: str, 
    state: Annotated[dict, InjectedState]
) -> List[str]:
    """Search knowledge base using DocumentPipeline's unified search method"""
    category = state.get("category")
    
    results = document_pipeline.search(
        query=query, 
        category_filter=category,  
        limit=10
    )
    
    return [result['text'] for result in results]


document_retrieval_tool = StructuredTool.from_function(
    qdrant_search,
    name="document_retrieval_tool",
    description="Search the project's Qdrant knowledge base using hybrid (semantic + keyword) search. Input: query (string), optional category filter. Returns top relevant text chunks.",
    args_schema=RetrievalInput
)