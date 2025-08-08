import os
from typing import Optional

from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

from .derivations import collect_derivations, normalize
from .models import Meta, Titles, WordResponse
from .popculture import collect_titles, TMDB_API_KEY

load_dotenv()

app = FastAPI(title="Word Derivations + Pop Culture API", version="0.1.0")


@app.get("/api/healthz")
async def healthz():
    return {"ok": True}


@app.get("/api/word/{term}")
async def get_word(
    term: str,
    max_derivations: int = Query(100, ge=10, le=500),
    include_rules: bool = Query(False),
):
    base = normalize(term)

    derivations = await collect_derivations(base, include_rules=include_rules, max_derivations=max_derivations)
    titles_dict = await collect_titles(base, limit=10)

    titles = Titles(
        films=titles_dict.get("films", []),
        music=titles_dict.get("music", []),
        books=titles_dict.get("books", []),
    )

    meta = Meta(
        sources={
            "wordnet": True,
            "datamuse": True,
            "musicbrainz": True,
            "openlibrary": True,
            "tmdb": bool(TMDB_API_KEY),
        }
    )

    resp = WordResponse(
        base=term,
        normalized=base,
        derivations=derivations,
        titles=titles,
        meta=meta,
    )
    return JSONResponse(content=resp.model_dump())