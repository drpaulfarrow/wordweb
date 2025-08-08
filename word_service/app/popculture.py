import asyncio
import os
from typing import List, Set

import httpx


TMDB_API_KEY = os.getenv("TMDB_API_KEY")


async def search_musicbrainz_titles(query: str, limit: int = 10) -> List[str]:
    titles: Set[str] = set()
    headers = {"User-Agent": "word-derivations-service/1.0 (contact: dev@example.com)"}
    async with httpx.AsyncClient(headers=headers, timeout=15) as client:
        try:
            r = await client.get(
                "https://musicbrainz.org/ws/2/recording",
                params={"query": f"recording:{query}", "fmt": "json", "limit": limit},
            )
            r.raise_for_status()
            data = r.json()
            for rec in data.get("recordings", [])[:limit]:
                title = rec.get("title")
                if title:
                    titles.add(title)
        except Exception:
            pass
    return list(titles)[:limit]


async def search_openlibrary_titles(query: str, limit: int = 10) -> List[str]:
    titles: Set[str] = set()
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            r = await client.get(
                "https://openlibrary.org/search.json",
                params={"title": query, "limit": limit},
            )
            r.raise_for_status()
            data = r.json()
            for doc in data.get("docs", [])[: 2 * limit]:
                t = doc.get("title")
                if t:
                    titles.add(t)
        except Exception:
            pass
    return list(titles)[:limit]


async def search_tmdb_titles(query: str, limit: int = 10) -> List[str]:
    if not TMDB_API_KEY:
        return []
    titles: Set[str] = set()
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            # Movies
            r1 = await client.get(
                "https://api.themoviedb.org/3/search/movie",
                params={"query": query, "include_adult": "false", "page": 1, "api_key": TMDB_API_KEY},
            )
            r1.raise_for_status()
            data1 = r1.json()
            for m in data1.get("results", [])[:limit]:
                t = m.get("title")
                if t:
                    titles.add(t)
            # TV
            r2 = await client.get(
                "https://api.themoviedb.org/3/search/tv",
                params={"query": query, "include_adult": "false", "page": 1, "api_key": TMDB_API_KEY},
            )
            r2.raise_for_status()
            data2 = r2.json()
            for tv in data2.get("results", [])[:limit]:
                t = tv.get("name")
                if t:
                    titles.add(t)
        except Exception:
            pass
    return list(titles)[:limit]


async def collect_titles(base: str, limit: int = 10) -> dict:
    # Query each source concurrently
    music_task = asyncio.create_task(search_musicbrainz_titles(base, limit))
    books_task = asyncio.create_task(search_openlibrary_titles(base, limit))
    films_task = asyncio.create_task(search_tmdb_titles(base, limit))

    music, books, films = await asyncio.gather(music_task, books_task, films_task)

    return {
        "music": music,
        "books": books,
        "films": films,
    }