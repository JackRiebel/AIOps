"""Web Search Service for Agentic RAG Corrective Agent.

Provides web search capabilities when the knowledge base is insufficient.
Supports multiple providers:
- Tavily (recommended for RAG)
- SerpAPI
- DuckDuckGo (fallback, no API key required)

The service abstracts the provider details and returns normalized results.
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional, Dict, Any
from urllib.parse import quote_plus

import httpx

logger = logging.getLogger(__name__)


@dataclass
class WebSearchResult:
    """Normalized web search result."""
    title: str
    url: str
    snippet: str
    source: str
    relevance_score: Optional[float] = None
    published_date: Optional[str] = None


class WebSearchProvider(ABC):
    """Abstract base class for web search providers."""

    @abstractmethod
    async def search(
        self,
        query: str,
        max_results: int = 5,
        **kwargs
    ) -> List[WebSearchResult]:
        """Perform a web search.

        Args:
            query: Search query
            max_results: Maximum number of results
            **kwargs: Provider-specific options

        Returns:
            List of WebSearchResult objects
        """
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name."""
        pass


class TavilySearchProvider(WebSearchProvider):
    """Tavily API search provider - optimized for RAG applications."""

    def __init__(self, api_key: str):
        """Initialize Tavily provider.

        Args:
            api_key: Tavily API key
        """
        self.api_key = api_key
        self.base_url = "https://api.tavily.com"

    @property
    def name(self) -> str:
        return "tavily"

    async def search(
        self,
        query: str,
        max_results: int = 5,
        search_depth: str = "basic",
        include_domains: Optional[List[str]] = None,
        exclude_domains: Optional[List[str]] = None,
        **kwargs
    ) -> List[WebSearchResult]:
        """Search using Tavily API.

        Args:
            query: Search query
            max_results: Maximum results (1-10)
            search_depth: "basic" or "advanced"
            include_domains: Only include these domains
            exclude_domains: Exclude these domains

        Returns:
            List of search results
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                payload = {
                    "api_key": self.api_key,
                    "query": query,
                    "max_results": min(max_results, 10),
                    "search_depth": search_depth,
                    "include_answer": True,
                }

                if include_domains:
                    payload["include_domains"] = include_domains
                if exclude_domains:
                    payload["exclude_domains"] = exclude_domains

                response = await client.post(
                    f"{self.base_url}/search",
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()

                results = []
                for item in data.get("results", []):
                    results.append(WebSearchResult(
                        title=item.get("title", ""),
                        url=item.get("url", ""),
                        snippet=item.get("content", ""),
                        source=self.name,
                        relevance_score=item.get("score"),
                        published_date=item.get("published_date"),
                    ))

                return results

            except httpx.HTTPError as e:
                logger.error(f"Tavily search error: {e}")
                return []
            except Exception as e:
                logger.error(f"Tavily search unexpected error: {e}")
                return []


class SerpAPISearchProvider(WebSearchProvider):
    """SerpAPI search provider - Google search results."""

    def __init__(self, api_key: str):
        """Initialize SerpAPI provider.

        Args:
            api_key: SerpAPI API key
        """
        self.api_key = api_key
        self.base_url = "https://serpapi.com/search"

    @property
    def name(self) -> str:
        return "serpapi"

    async def search(
        self,
        query: str,
        max_results: int = 5,
        engine: str = "google",
        **kwargs
    ) -> List[WebSearchResult]:
        """Search using SerpAPI.

        Args:
            query: Search query
            max_results: Maximum results
            engine: Search engine (google, bing, etc.)

        Returns:
            List of search results
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                params = {
                    "api_key": self.api_key,
                    "q": query,
                    "engine": engine,
                    "num": min(max_results, 10),
                }

                response = await client.get(self.base_url, params=params)
                response.raise_for_status()
                data = response.json()

                results = []
                for item in data.get("organic_results", [])[:max_results]:
                    results.append(WebSearchResult(
                        title=item.get("title", ""),
                        url=item.get("link", ""),
                        snippet=item.get("snippet", ""),
                        source=self.name,
                        relevance_score=item.get("position", 0) / 10,  # Estimate
                    ))

                return results

            except httpx.HTTPError as e:
                logger.error(f"SerpAPI search error: {e}")
                return []
            except Exception as e:
                logger.error(f"SerpAPI search unexpected error: {e}")
                return []


class DuckDuckGoSearchProvider(WebSearchProvider):
    """DuckDuckGo search provider - No API key required."""

    def __init__(self):
        """Initialize DuckDuckGo provider."""
        self.base_url = "https://api.duckduckgo.com/"

    @property
    def name(self) -> str:
        return "duckduckgo"

    async def search(
        self,
        query: str,
        max_results: int = 5,
        **kwargs
    ) -> List[WebSearchResult]:
        """Search using DuckDuckGo Instant Answer API.

        Note: DDG Instant Answer API has limited results.
        For more results, consider using duckduckgo-search library.

        Args:
            query: Search query
            max_results: Maximum results

        Returns:
            List of search results
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                params = {
                    "q": query,
                    "format": "json",
                    "no_html": 1,
                    "skip_disambig": 1,
                }

                response = await client.get(self.base_url, params=params)
                response.raise_for_status()
                data = response.json()

                results = []

                # Abstract (main result)
                if data.get("Abstract"):
                    results.append(WebSearchResult(
                        title=data.get("Heading", ""),
                        url=data.get("AbstractURL", ""),
                        snippet=data.get("Abstract", ""),
                        source=self.name,
                        relevance_score=1.0,
                    ))

                # Related topics
                for topic in data.get("RelatedTopics", [])[:max_results - 1]:
                    if isinstance(topic, dict) and "Text" in topic:
                        results.append(WebSearchResult(
                            title=topic.get("Text", "")[:100],
                            url=topic.get("FirstURL", ""),
                            snippet=topic.get("Text", ""),
                            source=self.name,
                            relevance_score=0.7,
                        ))

                return results[:max_results]

            except httpx.HTTPError as e:
                logger.error(f"DuckDuckGo search error: {e}")
                return []
            except Exception as e:
                logger.error(f"DuckDuckGo search unexpected error: {e}")
                return []


class WebSearchService:
    """Main web search service that coordinates providers."""

    def __init__(
        self,
        tavily_api_key: Optional[str] = None,
        serpapi_api_key: Optional[str] = None,
        default_provider: str = "auto",
    ):
        """Initialize web search service.

        Args:
            tavily_api_key: Tavily API key (recommended)
            serpapi_api_key: SerpAPI key
            default_provider: "tavily", "serpapi", "duckduckgo", or "auto"
        """
        self.providers: Dict[str, WebSearchProvider] = {}

        # Initialize available providers
        if tavily_api_key:
            self.providers["tavily"] = TavilySearchProvider(tavily_api_key)

        if serpapi_api_key:
            self.providers["serpapi"] = SerpAPISearchProvider(serpapi_api_key)

        # Always add DuckDuckGo as fallback
        self.providers["duckduckgo"] = DuckDuckGoSearchProvider()

        # Set default provider
        if default_provider == "auto":
            if "tavily" in self.providers:
                self.default_provider = "tavily"
            elif "serpapi" in self.providers:
                self.default_provider = "serpapi"
            else:
                self.default_provider = "duckduckgo"
        else:
            self.default_provider = default_provider

        logger.info(
            f"WebSearchService initialized with providers: {list(self.providers.keys())}, "
            f"default: {self.default_provider}"
        )

    @property
    def available_providers(self) -> List[str]:
        """Get list of available provider names."""
        return list(self.providers.keys())

    async def search(
        self,
        query: str,
        max_results: int = 5,
        provider: Optional[str] = None,
        cisco_focus: bool = True,
        **kwargs
    ) -> List[WebSearchResult]:
        """Perform web search.

        Args:
            query: Search query
            max_results: Maximum results
            provider: Specific provider to use (or None for default)
            cisco_focus: If True, add Cisco-related terms to improve results
            **kwargs: Provider-specific options

        Returns:
            List of search results
        """
        # Select provider
        provider_name = provider or self.default_provider
        if provider_name not in self.providers:
            logger.warning(f"Provider {provider_name} not available, using {self.default_provider}")
            provider_name = self.default_provider

        search_provider = self.providers[provider_name]

        # Optionally enhance query for Cisco focus
        search_query = query
        if cisco_focus and not any(term in query.lower() for term in ["cisco", "meraki", "catalyst"]):
            search_query = f"Cisco networking {query}"

        logger.info(f"Web search via {provider_name}: {search_query[:100]}...")

        try:
            results = await search_provider.search(
                query=search_query,
                max_results=max_results,
                **kwargs
            )

            # If primary provider fails, try fallback
            if not results and provider_name != "duckduckgo":
                logger.warning(f"Primary provider {provider_name} returned no results, trying fallback")
                results = await self.providers["duckduckgo"].search(
                    query=search_query,
                    max_results=max_results,
                )

            logger.info(f"Web search returned {len(results)} results")
            return results

        except Exception as e:
            logger.error(f"Web search failed: {e}")
            return []

    async def search_cisco_docs(
        self,
        query: str,
        max_results: int = 5,
    ) -> List[WebSearchResult]:
        """Search specifically in Cisco documentation.

        Args:
            query: Search query
            max_results: Maximum results

        Returns:
            List of search results from Cisco domains
        """
        cisco_domains = [
            "cisco.com",
            "meraki.com",
            "documentation.meraki.com",
            "developer.cisco.com",
        ]

        # Use Tavily with domain filtering if available
        if "tavily" in self.providers:
            return await self.search(
                query=query,
                max_results=max_results,
                provider="tavily",
                cisco_focus=True,
                include_domains=cisco_domains,
            )

        # Fallback: enhance query
        cisco_query = f"site:cisco.com OR site:meraki.com {query}"
        return await self.search(
            query=cisco_query,
            max_results=max_results,
            cisco_focus=False,
        )


# Singleton instance
_web_search_service: Optional[WebSearchService] = None


def get_web_search_service() -> Optional[WebSearchService]:
    """Get the web search service singleton."""
    return _web_search_service


def init_web_search_service(
    tavily_api_key: Optional[str] = None,
    serpapi_api_key: Optional[str] = None,
    default_provider: str = "auto",
) -> WebSearchService:
    """Initialize the web search service singleton.

    Args:
        tavily_api_key: Tavily API key
        serpapi_api_key: SerpAPI key
        default_provider: Default provider selection

    Returns:
        Initialized WebSearchService
    """
    global _web_search_service
    _web_search_service = WebSearchService(
        tavily_api_key=tavily_api_key,
        serpapi_api_key=serpapi_api_key,
        default_provider=default_provider,
    )
    return _web_search_service
