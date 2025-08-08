from enum import Enum
from typing import List, Optional, Dict
from pydantic import BaseModel


class SourceEnum(str, Enum):
    wordnet = "wordnet"
    datamuse = "datamuse"
    rule = "rule"


class DerivationItem(BaseModel):
    word: str
    pos: List[str] = []
    sources: List[SourceEnum] = []
    affix: Optional[str] = None
    frequency: Optional[float] = None


class DerivationsGrouped(BaseModel):
    adjectives: List[DerivationItem] = []
    nouns: List[DerivationItem] = []
    verbs: List[DerivationItem] = []
    adverbs: List[DerivationItem] = []
    other: List[DerivationItem] = []


class Titles(BaseModel):
    films: List[str] = []
    music: List[str] = []
    books: List[str] = []


class Meta(BaseModel):
    sources: Dict[str, bool]


class WordResponse(BaseModel):
    base: str
    normalized: str
    derivations: DerivationsGrouped
    titles: Titles
    meta: Meta