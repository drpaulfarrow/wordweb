# Word Derivations + Pop Culture API

A minimal FastAPI service that, given any English word, returns:

- Derivationally related forms (via WordNet), with POS grouping and frequency ranking
- Optional extra forms (Datamuse) and frequency filtering
- Pop-culture titles (MusicBrainz for music, Open Library for books, optional TMDb for movies/TV)

## Setup

1. Python 3.10+
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. (Optional) Create `.env` in the project root to enable movie/TV search:

```env
TMDB_API_KEY=your_tmdb_api_key_here
```

## Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## API

- `GET /api/word/{term}`
  - Query params:
    - `max_derivations` (int, default 100): cap on derivation items before ranking
    - `include_rules` (bool, default false): include simple heuristic prefix/suffix expansions
  - Response JSON contains `derivations` grouped by POS and `titles` grouped by media.

### Example

```bash
curl -s "http://localhost:8000/api/word/vision?include_rules=true" | jq
```

## Notes
- WordNet data will be downloaded automatically on first run.
- External services used:
  - WordNet (NLTK)
  - Datamuse (no key)
  - MusicBrainz (no key; be gentle with rate limits)
  - Open Library (no key)
  - TMDb (requires API key)