import asyncio
from typing import Dict, Iterable, List, Optional, Set, Tuple

import httpx
import nltk
from nltk.corpus import wordnet as wn
from wordfreq import zipf_frequency

from .models import DerivationItem, DerivationsGrouped, SourceEnum


_WORDNET_READY = False


async def ensure_wordnet() -> None:
    global _WORDNET_READY
    if _WORDNET_READY:
        return
    try:
        wn.ensure_loaded()
    except LookupError:
        nltk.download("wordnet")
        nltk.download("omw-1.4")
    _ = wn.synsets("test")  # touch
    _WORDNET_READY = True


def normalize(word: str) -> str:
    return (word or "").strip().lower()


def wordnet_derivations(base: str) -> Set[str]:
    results: Set[str] = set()
    for pos in (wn.NOUN, wn.VERB, wn.ADJ, wn.ADV):
        for syn in wn.synsets(base, pos=pos):
            for lemma in syn.lemmas():
                for rel in lemma.derivationally_related_forms():
                    results.add(rel.name().replace("_", " "))
    return results


async def datamuse_pos_and_freq(candidates: Iterable[str]) -> Dict[str, Tuple[List[str], Optional[float]]]:
    # Datamuse can return pos tags and frequency estimates. Batch by joining words with commas is not supported,
    # so we issue multiple requests concurrently, but cap concurrency.
    async def fetch(client: httpx.AsyncClient, term: str) -> Tuple[str, List[str], Optional[float]]:
        url = "https://api.datamuse.com/words"
        params = {"sp": term, "md": "pf", "max": 1}
        # Using sp=word returns the token if present; otherwise nearest matches. We'll guard later with frequency.
        try:
            resp = await client.get(url, params=params, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            if not data:
                # Fallback purely on zipf frequency
                zipf = zipf_frequency(term, "en")
                return term, [], float(zipf) if zipf else None
            entry = data[0]
            pos_tags = []
            if "tags" in entry:
                pos_tags = [t for t in entry["tags"] if t in {"n", "v", "adj", "adv"}]
            # Prefer Zipf frequency; if not measurable, fall back to Datamuse score
            zipf = zipf_frequency(term, "en")
            freq_val = float(zipf) if zipf else (float(entry.get("score")) if entry.get("score") is not None else None)
            return term, pos_tags, freq_val
        except Exception:
            zipf = zipf_frequency(term, "en")
            return term, [], float(zipf) if zipf else None

    result: Dict[str, Tuple[List[str], Optional[float]]] = {}
    sem = asyncio.Semaphore(8)

    async def guarded_fetch(client: httpx.AsyncClient, term: str):
        async with sem:
            key, pos_tags, freq = await fetch(client, term)
            result[key] = (pos_tags, freq)

    async with httpx.AsyncClient() as client:
        await asyncio.gather(*(guarded_fetch(client, w) for w in candidates))

    return result


def conservative_affix_rules(base: str) -> Set[str]:
    # Extremely conservative: only allow prefix 'en' + base (e.g., vision -> envision)
    forms: Set[str] = set()
    if base and base.isalpha():
        forms.add("en" + base)
    return forms


async def collect_derivations(base: str, include_rules: bool, max_derivations: int = 100) -> DerivationsGrouped:
    base_norm = normalize(base)
    await ensure_wordnet()

    forms: Set[str] = set()
    forms.add(base_norm)

    # WordNet hop-1 and hop-2 closure
    first = wordnet_derivations(base_norm)
    forms.update(first)
    for f in list(first)[:50]:  # cap to avoid explosion
        forms.update(wordnet_derivations(f))

    if include_rules:
        forms.update(conservative_affix_rules(base_norm))

    # Remove spaces (multi-word lemmas are rare derivations for our use) and dedupe
    forms = {w for w in forms if w and " " not in w}

    # Pre-trim by Zipf frequency to reduce API calls
    if len(forms) > max_derivations:
        ranked = sorted(forms, key=lambda w: zipf_frequency(w, "en"), reverse=True)
        forms = set(ranked[:max_derivations])

    pos_freq = await datamuse_pos_and_freq(forms)

    # Build items with filtering: keep base, or words with POS evidence, or minimal Zipf >= 2.5
    MIN_ZIPF = 2.5
    items: List[DerivationItem] = []
    for w in forms:
        pos_tags, freq = pos_freq.get(w, ([], None))
        if w != base_norm:
            zipf_val = zipf_frequency(w, "en")
            has_pos_evidence = len(pos_tags) > 0
            if not has_pos_evidence and (zipf_val is None or zipf_val < MIN_ZIPF):
                continue
        srcs: List[SourceEnum] = [SourceEnum.wordnet]
        if include_rules and w in conservative_affix_rules(base_norm):
            srcs.append(SourceEnum.rule)
        items.append(DerivationItem(word=w, pos=pos_tags, sources=srcs, frequency=freq))

    # Group
    grouped = DerivationsGrouped(adjectives=[], nouns=[], verbs=[], adverbs=[], other=[])
    for item in sorted(items, key=lambda x: (-(x.frequency or 0.0), x.word)):
        tags = set(item.pos)
        if "adj" in tags:
            grouped.adjectives.append(item)
        elif "n" in tags:
            grouped.nouns.append(item)
        elif "v" in tags:
            grouped.verbs.append(item)
        elif "adv" in tags:
            grouped.adverbs.append(item)
        else:
            grouped.other.append(item)

    return grouped