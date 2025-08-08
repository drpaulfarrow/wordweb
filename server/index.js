import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { LRUCache } from 'lru-cache';

const app = express();
const PORT = process.env.PORT || 5174;

app.use(cors());
app.use(express.json());

const cache = new LRUCache({ max: 500, ttl: 1000 * 60 * 60 }); // 1 hour

async function getDefinitions(word) {
  // Try dictionaryapi.dev as free source
  try {
    const { data } = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    const defs = [];
    for (const entry of data) {
      for (const meaning of entry.meanings || []) {
        for (const def of meaning.definitions || []) {
          defs.push({ text: def.definition });
        }
      }
    }
    return defs.slice(0, 5);
  } catch {
    return [];
  }
}

async function getSynAnt(word) {
  try {
    const [syn, ant] = await Promise.all([
      axios.get(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}`),
      axios.get(`https://api.datamuse.com/words?rel_ant=${encodeURIComponent(word)}`),
    ]);
    return {
      synonyms: syn.data.slice(0, 24).map(x => x.word),
      antonyms: ant.data.slice(0, 24).map(x => x.word),
    };
  } catch {
    return { synonyms: [], antonyms: [] };
  }
}

async function getIdioms(word) {
  // Placeholder free source: use Datamuse phrases involving the word
  try {
    const { data } = await axios.get(`https://api.datamuse.com/words?rel_phr=${encodeURIComponent(word)}`);
    return data.slice(0, 20).map(x => x.word.replace(/_/g, ' '));
  } catch {
    return [];
  }
}

async function getTranslations(word) {
  // Placeholder: simple mapping via MyMemory free API (limited)
  const languages = [
    { code: 'es', lang: 'Spanish' },
    { code: 'fr', lang: 'French' },
    { code: 'de', lang: 'German' },
    { code: 'zh', lang: 'Chinese' },
  ];
  const results = [];
  await Promise.all(languages.map(async ({ code, lang }) => {
    try {
      const { data } = await axios.get('https://api.mymemory.translated.net/get', {
        params: { q: word, langpair: `en|${code}` },
      });
      const translated = data?.responseData?.translatedText;
      if (translated) results.push({ lang, text: translated });
    } catch {
      // ignore
    }
  }));
  return results;
}

async function getConjugations(word) {
  // Free placeholder: return simple forms using Datamuse inflections
  try {
    const { data } = await axios.get(`https://api.datamuse.com/words?rel_trg=${encodeURIComponent(word)}`);
    return data.slice(0, 12).map(x => x.word);
  } catch {
    return [];
  }
}

async function getPopCulture(word) {
  // Placeholder: Wikipedia search snippets
  try {
    const { data } = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        list: 'search',
        srsearch: word,
        format: 'json',
        origin: '*',
      },
    });
    return (data?.query?.search || []).slice(0, 8).map(s => s.title);
  } catch {
    return [];
  }
}

async function getRhymes(word) {
  try {
    const { data } = await axios.get(`https://api.datamuse.com/words?rel_rhy=${encodeURIComponent(word)}`);
    return data.slice(0, 24).map(x => x.word);
  } catch {
    return [];
  }
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/word/:word', async (req, res) => {
  const word = (req.params.word || '').trim().toLowerCase();
  if (!word) return res.status(400).json({ error: 'Word required' });

  const cached = cache.get(word);
  if (cached) return res.json(cached);

  try {
    const [definition, synant, idioms, translations, conjugations, popculture, rhymes] = await Promise.all([
      getDefinitions(word),
      getSynAnt(word),
      getIdioms(word),
      getTranslations(word),
      getConjugations(word),
      getPopCulture(word),
      getRhymes(word),
    ]);

    const payload = {
      word,
      definition,
      synonyms: synant.synonyms,
      antonyms: synant.antonyms,
      idioms,
      translations,
      conjugations,
      popculture,
      rhymes,
    };

    cache.set(word, payload);
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch word data' });
  }
});

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});