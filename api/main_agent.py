from typing import TypedDict, List, Dict, Any, Optional, Annotated, Literal
from pydantic import BaseModel, Field
from langchain_core.prompts.chat import ChatPromptTemplate
from langgraph.graph import StateGraph, END, START
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage, SystemMessage, HumanMessage, AIMessage, ToolMessage
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import ToolNode
import os
from dotenv import load_dotenv
from langgraph.checkpoint.postgres import PostgresSaver
from psycopg import Connection
from langchain_core.messages.utils import (
    trim_messages,
    count_tokens_approximately
)
from langchain_core.tools import StructuredTool
from llm_tools import document_retrieval_tool

load_dotenv()

DB_URI = os.getenv("MEMORY_DB_URL")
connection_kwargs = {
    "autocommit": True,
    "prepare_threshold": 0,
}

conn = Connection.connect(DB_URI, **connection_kwargs)
checkpointer = PostgresSaver(conn)

class GraphState(TypedDict):
    user_prompt: str
    messages: list
    category: Optional[str]  # Add this field

class MainState(TypedDict) : 
    user_prompt : str
    messages : Annotated[list, add_messages]
    category : Optional[str]  # Added category to state

class MainAgentGraph : 

    def __init__ (self) : 
        with open('Prompts/systemPrompt.txt', 'r') as file:
            content = file.read()
            self.system_prompt = content
        tools = [document_retrieval_tool]
        self.tool_node = ToolNode(tools)

        self.main_llm = ChatOpenAI(model_name = 'gpt-4.1-mini').bind_tools(tools)
        self.graph = self._build_graph()

    def main_agent(self, state: MainState) -> str : 
        messages = state.get("messages")
        category = state.get("category")
        
        if category and messages:
            system_msg_content = self.system_prompt            
            if isinstance(messages[0], SystemMessage):
                messages[0] = SystemMessage(content=system_msg_content)
            else:
                messages.insert(0, SystemMessage(content=system_msg_content))
        
        trimmed_messages = trim_messages(
            messages,
            strategy="last",
            token_counter=count_tokens_approximately,
            max_tokens=10000,
            start_on="human",
            end_on=("human", "tool"),
            include_system=True
        )
        
        response = self.main_llm.invoke(trimmed_messages)
        
        return {
            'messages': response
        }
    
    def _build_graph (self) -> StateGraph :
        graph = StateGraph(MainState)

        graph.add_node('main_agent', self.main_agent)
        graph.add_node('tool_node', self.tool_node)
        graph.add_edge(START, 'main_agent')

        def route_tools(state: MainState):
            """Route to tools if there are tool calls"""
            if isinstance(state, list):
                ai_message = state[-1]
            elif messages := state.get("messages", []):
                ai_message = messages[-1]
            else:
                raise ValueError(f"No messages found in input state to tool_edge: {state}")
            if hasattr(ai_message, "tool_calls") and len(ai_message.tool_calls) > 0:
                return "tools"
            return END
        
        graph.add_conditional_edges(
            'main_agent',
            route_tools,
            {
                'tools' : 'tool_node',
                END : END
            }
        )

        graph.add_edge('tool_node', 'main_agent')

        return graph.compile(checkpointer=checkpointer)