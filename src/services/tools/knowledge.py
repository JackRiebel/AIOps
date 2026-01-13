"""Knowledge Base and RAG Tools.

This module provides tools for knowledge base operations:
- Document search and retrieval
- Semantic search with embeddings
- Knowledge base management

Tool naming convention: knowledge_{action}_{entity}
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool

logger = logging.getLogger(__name__)


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def success_result(data: Any = None, message: str = None) -> Dict:
    """Create a success result."""
    result = {"success": True}
    if data is not None:
        result["data"] = data
    if message:
        result["message"] = message
    return result


def error_result(message: str) -> Dict:
    """Create an error result."""
    return {"success": False, "error": message}


# =============================================================================
# KNOWLEDGE BASE TOOLS
# =============================================================================

async def handle_search_knowledge(params: Dict, context: Any) -> Dict:
    """Search the knowledge base."""
    query = params.get("query")
    if not query:
        return error_result("query is required")
    try:
        # Use knowledge service from context
        results = await context.knowledge_service.search(
            query=query,
            limit=params.get("limit", 10),
            filters=params.get("filters")
        )
        return success_result(data=results)
    except Exception as e:
        return error_result(str(e))


async def handle_get_document(params: Dict, context: Any) -> Dict:
    """Get a specific document from the knowledge base."""
    doc_id = params.get("doc_id")
    if not doc_id:
        return error_result("doc_id is required")
    try:
        document = await context.knowledge_service.get_document(doc_id)
        return success_result(data=document)
    except Exception as e:
        return error_result(str(e))


async def handle_list_documents(params: Dict, context: Any) -> Dict:
    """List documents in the knowledge base."""
    try:
        documents = await context.knowledge_service.list_documents(
            category=params.get("category"),
            limit=params.get("limit", 50),
            offset=params.get("offset", 0)
        )
        return success_result(data=documents)
    except Exception as e:
        return error_result(str(e))


async def handle_add_document(params: Dict, context: Any) -> Dict:
    """Add a document to the knowledge base."""
    content = params.get("content")
    title = params.get("title")
    if not content or not title:
        return error_result("content and title are required")
    try:
        result = await context.knowledge_service.add_document(
            title=title,
            content=content,
            category=params.get("category"),
            metadata=params.get("metadata")
        )
        return success_result(data=result)
    except Exception as e:
        return error_result(str(e))


async def handle_update_document(params: Dict, context: Any) -> Dict:
    """Update a document in the knowledge base."""
    doc_id = params.get("doc_id")
    if not doc_id:
        return error_result("doc_id is required")
    try:
        updates = {k: params[k] for k in ["title", "content", "category", "metadata"] if params.get(k)}
        result = await context.knowledge_service.update_document(doc_id, **updates)
        return success_result(data=result)
    except Exception as e:
        return error_result(str(e))


async def handle_delete_document(params: Dict, context: Any) -> Dict:
    """Delete a document from the knowledge base."""
    doc_id = params.get("doc_id")
    if not doc_id:
        return error_result("doc_id is required")
    try:
        await context.knowledge_service.delete_document(doc_id)
        return success_result(message=f"Document {doc_id} deleted")
    except Exception as e:
        return error_result(str(e))


async def handle_semantic_search(params: Dict, context: Any) -> Dict:
    """Perform semantic search using embeddings."""
    query = params.get("query")
    if not query:
        return error_result("query is required")
    try:
        results = await context.knowledge_service.semantic_search(
            query=query,
            limit=params.get("limit", 10),
            threshold=params.get("threshold", 0.7)
        )
        return success_result(data=results)
    except Exception as e:
        return error_result(str(e))


async def handle_get_categories(params: Dict, context: Any) -> Dict:
    """Get all knowledge base categories."""
    try:
        categories = await context.knowledge_service.get_categories()
        return success_result(data=categories)
    except Exception as e:
        return error_result(str(e))


async def handle_get_knowledge_stats(params: Dict, context: Any) -> Dict:
    """Get knowledge base statistics."""
    try:
        stats = await context.knowledge_service.get_stats()
        return success_result(data=stats)
    except Exception as e:
        return error_result(str(e))


# =============================================================================
# CISCO DOCUMENTATION TOOLS
# =============================================================================

async def handle_search_cisco_docs(params: Dict, context: Any) -> Dict:
    """Search Cisco documentation."""
    query = params.get("query")
    if not query:
        return error_result("query is required")
    try:
        results = await context.knowledge_service.search_cisco_docs(
            query=query,
            product=params.get("product"),
            limit=params.get("limit", 10)
        )
        return success_result(data=results)
    except Exception as e:
        return error_result(str(e))


async def handle_get_meraki_api_docs(params: Dict, context: Any) -> Dict:
    """Get Meraki API documentation for an endpoint."""
    endpoint = params.get("endpoint")
    if not endpoint:
        return error_result("endpoint is required")
    try:
        docs = await context.knowledge_service.get_meraki_api_docs(endpoint)
        return success_result(data=docs)
    except Exception as e:
        return error_result(str(e))


async def handle_get_catalyst_api_docs(params: Dict, context: Any) -> Dict:
    """Get Catalyst Center API documentation for an endpoint."""
    endpoint = params.get("endpoint")
    if not endpoint:
        return error_result("endpoint is required")
    try:
        docs = await context.knowledge_service.get_catalyst_api_docs(endpoint)
        return success_result(data=docs)
    except Exception as e:
        return error_result(str(e))


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

KNOWLEDGE_TOOLS = [
    # Knowledge Base Tools
    create_tool(
        name="knowledge_search",
        description="Search the knowledge base for relevant information",
        platform="knowledge",
        category="search",
        properties={
            "query": {"type": "string", "description": "Search query"},
            "limit": {"type": "integer", "description": "Maximum results (default: 10)"},
            "filters": {"type": "object", "description": "Filter criteria"},
        },
        required=["query"],
        handler=handle_search_knowledge,
    ),
    create_tool(
        name="knowledge_get_document",
        description="Get a specific document from the knowledge base",
        platform="knowledge",
        category="documents",
        properties={"doc_id": {"type": "string", "description": "Document ID"}},
        required=["doc_id"],
        handler=handle_get_document,
    ),
    create_tool(
        name="knowledge_list_documents",
        description="List documents in the knowledge base",
        platform="knowledge",
        category="documents",
        properties={
            "category": {"type": "string", "description": "Filter by category"},
            "limit": {"type": "integer", "description": "Maximum results"},
            "offset": {"type": "integer", "description": "Result offset"},
        },
        handler=handle_list_documents,
    ),
    create_tool(
        name="knowledge_add_document",
        description="Add a document to the knowledge base",
        platform="knowledge",
        category="documents",
        properties={
            "title": {"type": "string", "description": "Document title"},
            "content": {"type": "string", "description": "Document content"},
            "category": {"type": "string", "description": "Category"},
            "metadata": {"type": "object", "description": "Additional metadata"},
        },
        required=["title", "content"],
        handler=handle_add_document,
        requires_write=True,
    ),
    create_tool(
        name="knowledge_update_document",
        description="Update a document in the knowledge base",
        platform="knowledge",
        category="documents",
        properties={
            "doc_id": {"type": "string", "description": "Document ID"},
            "title": {"type": "string", "description": "New title"},
            "content": {"type": "string", "description": "New content"},
            "category": {"type": "string", "description": "New category"},
        },
        required=["doc_id"],
        handler=handle_update_document,
        requires_write=True,
    ),
    create_tool(
        name="knowledge_delete_document",
        description="Delete a document from the knowledge base",
        platform="knowledge",
        category="documents",
        properties={"doc_id": {"type": "string", "description": "Document ID"}},
        required=["doc_id"],
        handler=handle_delete_document,
        requires_write=True,
    ),
    create_tool(
        name="knowledge_semantic_search",
        description="Perform semantic search using vector embeddings",
        platform="knowledge",
        category="search",
        properties={
            "query": {"type": "string", "description": "Natural language query"},
            "limit": {"type": "integer", "description": "Maximum results (default: 10)"},
            "threshold": {"type": "number", "description": "Similarity threshold (0-1)"},
        },
        required=["query"],
        handler=handle_semantic_search,
    ),
    create_tool(
        name="knowledge_get_categories",
        description="Get all knowledge base categories",
        platform="knowledge",
        category="categories",
        handler=handle_get_categories,
    ),
    create_tool(
        name="knowledge_get_stats",
        description="Get knowledge base statistics",
        platform="knowledge",
        category="stats",
        handler=handle_get_knowledge_stats,
    ),

    # Cisco Documentation Tools
    create_tool(
        name="knowledge_search_cisco_docs",
        description="Search Cisco product documentation",
        platform="knowledge",
        category="cisco_docs",
        properties={
            "query": {"type": "string", "description": "Search query"},
            "product": {"type": "string", "description": "Filter by product (meraki, catalyst, thousandeyes)"},
            "limit": {"type": "integer", "description": "Maximum results"},
        },
        required=["query"],
        handler=handle_search_cisco_docs,
    ),
    create_tool(
        name="knowledge_get_meraki_api_docs",
        description="Get Meraki API documentation for an endpoint",
        platform="knowledge",
        category="cisco_docs",
        properties={"endpoint": {"type": "string", "description": "API endpoint path"}},
        required=["endpoint"],
        handler=handle_get_meraki_api_docs,
    ),
    create_tool(
        name="knowledge_get_catalyst_api_docs",
        description="Get Catalyst Center API documentation for an endpoint",
        platform="knowledge",
        category="cisco_docs",
        properties={"endpoint": {"type": "string", "description": "API endpoint path"}},
        required=["endpoint"],
        handler=handle_get_catalyst_api_docs,
    ),
]


# =============================================================================
# REGISTRATION
# =============================================================================

def register_knowledge_tools():
    """Register all Knowledge tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(KNOWLEDGE_TOOLS)
    logger.info(f"[Knowledge Tools] Registered {len(KNOWLEDGE_TOOLS)} tools")


# Auto-register on import
register_knowledge_tools()
