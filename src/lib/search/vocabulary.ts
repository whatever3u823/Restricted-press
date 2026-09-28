/**
 * The archive's controlled vocabulary.
 *
 * Each group gathers terms a historical text might use for one concept,
 * including early-modern spellings (u/v and i/j variants, "-ck" endings).
 * Query understanding maps a reader's words onto these groups so that
 * "ritual purification" also finds "ablution" and "lustration".
 *
 * This is deliberately small and hand-edited. It is the lexical stand-in for
 * semantic retrieval and remains useful alongside it (spelling variants are
 * something embeddings handle poorly).
 */
export const VOCABULARY: string[][] = [
  ["purification", "purify", "purified", "cleanse", "cleansing", "ablution", "lustration", "wash", "washing", "bathe", "bathing"],
  ["fasting", "fast", "abstinence", "abstain", "chastity"],
  ["invocation", "invoke", "evoke", "evocation", "conjure", "conjuration", "conjurer", "summon", "call up", "adjure", "exorcism"],
  ["spirit", "spirits", "daemon", "demon", "devil", "devils", "deuill", "diuell", "fiend", "familiar", "imp", "angel"],
  ["devil", "deuill", "diuell", "satan", "lucifer", "fiend", "prince of darkness"],
  ["witch", "witches", "witchcraft", "witch-craft", "sorcery", "sorcerer", "sorceress", "hag", "wizard", "wisard"],
  ["magic", "magick", "magical", "magician", "magus", "magi", "enchantment", "charm", "spell"],
  ["necromancy", "necromancer", "raise the dead", "ghost", "apparition", "shade"],
  ["divination", "augury", "omen", "oracle", "prophecy", "soothsayer", "foretell", "prognostication", "chiromancy", "palmistry"],
  ["astrology", "astrologer", "horoscope", "planet", "nativity", "zodiac", "stars"],
  ["alchemy", "alchemist", "alchemical", "hermetic art", "royal art", "great work", "magnum opus", "adept"],
  ["philosopher's stone", "philosophers' stone", "stone of the philosophers", "elixir", "tincture", "red stone", "powder of projection"],
  ["transmutation", "transmute", "projection", "multiplication", "gold", "base metal"],
  ["mercury", "sulphur", "salt", "quicksilver", "principles"],
  ["hermes", "hermetic", "trismegistus", "hermeticism", "thrice great"],
  ["rosicrucian", "rosicrucians", "rose cross", "rosy cross", "fraternity"],
  ["freemasonry", "freemason", "mason", "masonic", "lodge", "craft", "initiation", "degree"],
  ["kabbalah", "kabbala", "cabala", "cabbala", "qabalah", "sephiroth", "zohar"],
  ["initiation", "initiate", "neophyte", "mysteries", "hierophant", "ordeal", "threshold"],
  ["ritual", "rite", "ceremony", "ceremonial", "sacrifice", "offering", "liturgy"],
  ["compact", "pact", "covenant", "contract", "bargain", "league", "sold his soul"],
  ["sabbath", "sabbat", "assembly", "coven", "meeting", "dance"],
  ["confession", "confessed", "examination", "deposition", "trial", "torture", "evidence", "witness"],
  ["execution", "executed", "hanged", "burned", "burnt", "sentence", "death", "condemned"],
  ["possession", "possessed", "obsession", "exorcist", "dispossession"],
  ["transformation", "shape-shifting", "metamorphosis", "werewolf", "hare", "cat", "toad"],
  ["fairy", "fairies", "elf", "elves", "fay", "good people", "gnome", "sylph", "undine", "salamander"],
  ["soul", "spirit", "astral", "etheric", "desire body", "vital body"],
  ["afterlife", "after death", "life after death", "underworld", "tuat", "judgment", "resurrection", "immortality"],
  ["osiris", "isis", "horus", "thoth", "ra", "anubis"],
  ["mysticism", "mystic", "mystical", "contemplation", "union", "illumination", "ecstasy", "rapture"],
  ["meditation", "recollection", "concentration", "prayer", "contemplation", "quiet"],
  ["symbol", "symbolism", "allegory", "emblem", "sign", "hieroglyph", "parable"],
  ["king", "kingship", "priest-king", "divine king", "sacred king", "king of the wood"],
  ["tree", "oak", "mistletoe", "grove", "golden bough", "sacred tree"],
  ["dream", "dreams", "dreamed", "vision", "visions", "dreamt"],
  ["gnostic", "gnosticism", "gnosis", "aeon", "aeons", "simonian", "heresy", "heretic"],
  ["crystal", "shew-stone", "showstone", "scrying", "speculum", "glass"],
  ["talisman", "amulet", "charm", "seal", "sigil", "ring"],
  ["mental", "mind", "mentalism", "thought", "will", "mental transmutation"],
  ["vibration", "polarity", "rhythm", "correspondence", "causation", "gender"],
];

const STOP = new Set(
  (
    "a an and are as at be been but by can could did do does find for from had has have how i if in into is it its " +
    "me more most my no not of on or our show so some tell than that the their them then there these they this those " +
    "to up us was we were what when where which who whom why will with would you your about any archive texts text " +
    "book books work works passage passages say says said describe describes discuss discussing discusses compare " +
    "between among earliest early concept idea ideas mention mentions mentioned according explain explains " +
    "before after during upon onto within without also such very much many used using use way ways kind kinds " +
    "people person thing things anything something did does done make makes made get give given"
  ).split(" "),
);

/** A concept: the reader's term plus its vocabulary expansions. */
export type Concept = { term: string; terms: string[] };

export function tokenize(text: string) {
  const phrases: string[] = [];
  const stripped = text.replace(/"([^"]{2,80})"/g, (_, p: string) => {
    phrases.push(p.toLowerCase());
    return " ";
  });
  const words = stripped
    .toLowerCase()
    .replace(/[’']/g, "'")
    .split(/[^\p{L}\p{N}'-]+/u)
    .map((w) => w.replace(/^['-]+|['-]+$/g, ""))
    .filter((w) => w.length > 1 && !STOP.has(w));
  return { phrases, words };
}

/**
 * Map free text onto concepts. With `expand`, each word pulls in its
 * vocabulary group; without, concepts are just the reader's own words.
 */
export function toConcepts(text: string, expand: boolean): Concept[] {
  const { phrases, words } = tokenize(text);
  const concepts: Concept[] = phrases.map((p) => ({ term: p, terms: [p] }));
  const seen = new Set<string>();

  // Multi-word vocabulary entries ("philosopher's stone") are matched first.
  const lower = text.toLowerCase();
  if (expand) {
    for (const group of VOCABULARY) {
      for (const t of group) {
        if (t.includes(" ") && lower.includes(t) && !seen.has(t)) {
          concepts.push({ term: t, terms: group });
          t.split(" ").forEach((w) => seen.add(w));
          seen.add(t);
        }
      }
    }
  }

  for (const w of words) {
    if (seen.has(w)) continue;
    seen.add(w);
    if (!expand) {
      concepts.push({ term: w, terms: [w] });
      continue;
    }
    const groups = VOCABULARY.filter((g) => g.some((t) => t === w || stemEq(t, w)));
    const terms = [...new Set([w, ...groups.flat()])].slice(0, 24);
    concepts.push({ term: w, terms });
  }
  return concepts.slice(0, 8);
}

/** Cheap stem comparison so "purifying" meets "purify". */
function stemEq(a: string, b: string) {
  if (a.includes(" ") || b.includes(" ")) return false;
  const stem = (x: string) => x.replace(/(ations?|ings?|ers?|ed|es|s|ly|ical|ic)$/, "").replace(/e$/, "");
  const sa = stem(a);
  const sb = stem(b);
  return sa.length >= 4 && sa === sb;
}
