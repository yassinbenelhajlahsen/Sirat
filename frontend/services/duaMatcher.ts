/**
 * Offline dua matching: a crisis check first, then a weighted keyword scorer.
 * Rules are written from what each dua in duas.json actually says, not from
 * its category name. A low score or a tie between topics is "no match": it is
 * better to show the general dua than a wrong one.
 *
 * Nothing the user types leaves this module: no logging, no storage.
 */
import { topicForCategory } from "./duaTopics";

export type DuaMatch =
  | { kind: "crisis"; duaId: number }
  | { kind: "match"; categories: string[]; duaIds?: number[] }
  | { kind: "none" };

// Crisis duas, chosen from what they say: 39 is a call for rescue ("by Your
// mercy I seek help"); 114 asks Allah to be Protector and Helper against harm.
export const CRISIS_DUA_SELF_HARM = 39;
export const CRISIS_DUA_ABUSE = 114;

const STRONG = 10;
const WEAK = 3;
const MIN_SCORE = 6;
const FUZZY_WEIGHT = 0.8;
const MAX_GAP = 4;

const CONTRACTIONS: Record<string, string> = { ll: " will", ve: " have", re: " are", m: " am", d: " would" };

export function normalizeInput(input: string): string {
  return input
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/'(ll|ve|re|m|d)\b/g, (_, e: string) => CONTRACTIONS[e] ?? "")
    .replace(/'s\b/g, "")
    .replace(/'/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------- crisis

const SELF_HARM: RegExp[] = [
  /\b(kill|killing|hurt|hurting|harm|harming|injure|injuring|starve|starving|hang|hanging|drown|drowning|poison|poisoning|stab|stabbing|shoot|shooting|overdose on|cut|cutting|burn|burning) (myself|my self)\b(?! (some slack|off from|a break|loose))/,
  /\b(suicide|suicidal|self harm|selfharm|self injury)\b/,
  /\b(want|wanna|wish|going|plan|planning|ready|need|thinking|think|thought) (to|about|of) (die|end it|end it all|end my life|ending it all|ending my life|disappear|not exist|not be here|not wake up)\b/,
  /\b(wish i (was|were) dead|better off dead|better off without me|nothing to live for|no reason to live|no point in living|life is not worth living|end my life|take my own life|ending it all|end it all|ending my life|cant go on)\b/,
  /\b(dont|do not) want to (live|be alive|exist|wake up)\b(?! (in|with|near|at|on|here|there|alone|like a)\b)/,
  /\bdont want to be here anymore\b/,
  /\bi want to die\b/,
  /\b(unalive|unaliving)\b/,
  /\bwanna die\b/,
  /\bwill kill me\b(?! (if|when|for))/,
  /\b(going|gonna) to kill me\b(?! (if|when|for))/,
];

const RELATIVE =
  "husband|wife|boyfriend|girlfriend|partner|dad|father|mom|mum|mother|brother|sister|uncle|stepfather|stepmother|stepdad|stepmom|boss|parents|fiance|ex|in laws";
const ABUSE: RegExp[] = [
  new RegExp(
    `\\b(he|she|they|my (${RELATIVE})) (is |was |are |keeps |keep |always |often )?(hit|hits|hitting|beat|beats|beating|slap|slaps|slapped|punch|punches|punched|choke|chokes|choked|strangle|strangles|abuse|abuses|abused|abusing|hurt|hurts|hurting|rape|raped|molest|molested|touch|touches|touched|threaten|threatens|threatened) me\\b`,
  ),
  new RegExp(`\\b(he|she|they|someone|somebody|my (${RELATIVE})) (wants|want|is trying|are trying|tried|threatened|threatens) to (hurt|harm|kill) me\\b`),
  /\b(someone|somebody) (is |keeps )?(hurting|hitting|beating|abusing) me\b/,
  /\b(being|am being|was|been) abused\b/,
  /\b(abusive|violent) (husband|wife|marriage|relationship|home|parents|father|mother|boyfriend|partner)\b/,
  /\b(domestic violence|domestic abuse|sexual assault|sexually assaulted|sexually abused|molested|raped)\b/,
  new RegExp(`\\b(scared|afraid|terrified) (of|to go home to) my (${RELATIVE})\\b`),
  /\b(scared|afraid) to go home\b/,
];

// shortcut: Arabic crisis phrases are a short fixed list, so other wording or other scripts are missed; upgrade by adding a reviewed phrase list per language.
const ARABIC_CRISIS = ["انتحار", "انتحر", "اقتل نفسي", "أقتل نفسي", "أنهي حياتي", "انهي حياتي", "لا أريد أن أعيش", "لا اريد ان اعيش"];
const ARABIC_ABUSE = ["يضربني", "زوجي يضربني", "أبي يضربني", "ابي يضربني"];

// Said in jest, not in earnest. Removed before the crisis patterns run.
const IDIOMS =
  /\b(killing me|kills me|killed me|kill me (if|when|for)|dying to|die of embarrassment|dying of embarrassment|die of shame|die laughing|dying laughing|dying of laughter|dead tired|to die for|bored to death|scared to death|worried to death|be the death of me|death of me|cut myself some slack)\b/g;

// Same phrases with the spaces removed, so odd spacing or invisible characters
// between the words cannot hide them. Only phrases that cannot sit inside an
// unrelated word are listed.
const SQUASHED_SELF_HARM =
  /(killmyself|killingmyself|endmylife|endingmylife|takemyownlife|suicid|hurtmyself|hurtingmyself|harmmyself|harmingmyself|cuttingmyself)/;

// Keyboards and pasted text can carry invisible characters, full-width letters or odd spaces.
function foldForCrisis(raw: string): string {
  const unified = typeof raw.normalize === "function" ? raw.normalize("NFKC") : raw;
  return unified.replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, "");
}

function detectCrisis(input: string): number | null {
  const raw = foldForCrisis(input);
  if (ARABIC_ABUSE.some((p) => raw.includes(p))) return CRISIS_DUA_ABUSE;
  if (ARABIC_CRISIS.some((p) => raw.includes(p))) return CRISIS_DUA_SELF_HARM;
  const text = normalizeInput(raw).replace(IDIOMS, " ");
  if (SELF_HARM.some((re) => re.test(text)) || SQUASHED_SELF_HARM.test(text.replace(/ /g, ""))) {
    return CRISIS_DUA_SELF_HARM;
  }
  if (ABUSE.some((re) => re.test(text))) return CRISIS_DUA_ABUSE;
  return null;
}

// ---------------------------------------------------------------- scorer

interface Rule {
  strong?: string[];
  weak?: string[];
  conflict?: string[];
  /** Strong-term score; mood categories use less so a concrete situation beats a feeling. */
  s?: number;
  /** Ceiling for the category's total, so stacking synonyms of a feeling cannot beat a situation. */
  cap?: number;
}

const MOOD = { s: 8, cap: 9 };

// Terms are normalized words (no apostrophes). "~" allows up to four words in between.
const RULES: Record<string, Rule> = {
  exam: {
    strong: ["exam", "exams", "final exam", "finals", "final tomorrow", "midterm", "midterms", "quiz", "entrance exam", "driving test", "driving exam", "studying for", "study for", "revise for", "revision", "test tomorrow", "ielts", "toefl", "gcse", "viva", "board exams", "sat exam"],
    weak: ["test", "study", "studying", "school", "grades", "memorize", "memorise", "university", "final"],
    conflict: ["test results", "blood test", "covid test", "pregnancy test", "cancer", "positive for", "diagnosed", "biopsy", "scan"],
  },
  medical: {
    strong: ["surgery", "operation", "diagnosed", "diagnosis", "cancer", "tumor", "tumour", "chemo", "chemotherapy", "biopsy", "test results", "results came back", "scan results", "mri", "ct scan", "dialysis", "transplant", "heart attack", "stroke", "intensive care", "icu", "life support", "surgeon", "medical", "treatment", "doctor said", "doctors said"],
    weak: ["hospital", "doctor", "clinic", "appointment", "medication", "checkup"],
  },
  illness: {
    strong: ["sick", "sickness", "illness", "fever", "flu", "infection", "pain", "headache", "migraine", "stomach ache", "sore throat", "not feeling well", "unwell", "under the weather", "shifa", "shifaa", "cough", "ill"],
    weak: ["hurts", "hurting", "back", "knee", "head", "stomach", "tooth", "chest", "leg", "arm", "neck"],
    conflict: ["sick of", "sick and tired", "visit sick", "visiting sick"],
  },
  healing: {
    strong: ["ruqya", "ruqyah", "ruqia", "heal", "healed", "healing", "cure", "cured", "recovery", "recover", "get better soon"],
    weak: ["health", "healthy"],
  },
  visiting_sick: {
    strong: ["visit ~ sick", "visiting ~ sick", "visit ~ hospital", "visiting ~ hospital", "visit ~ patient", "visiting ~ patient", "visit ~ ill", "bedside"],
  },
  deceased: {
    strong: ["died", "passed away", "pass away", "passed on", "death", "dead", "deceased", "funeral", "janazah", "janaza", "jenazah", "burial", "buried", "grave", "last goodbye", "final goodbye", "condolences", "condolence", "rest in peace", "inna lillahi", "late father", "late mother", "late husband", "late wife", "late grandmother", "late grandfather"],
    conflict: ["dead tired", "dead battery", "dead end", "dead serious", "scared to death", "bored to death", "worried to death", "death of me"],
  },
  loss: {
    strong: ["lost my father", "lost my mother", "lost my dad", "lost my mom", "lost my husband", "lost my wife", "lost my son", "lost my daughter", "lost my brother", "lost my sister", "lost my grandmother", "lost my grandfather", "lost my best friend", "lost my baby", "lost someone", "lost a loved one", "loved one", "bereavement", "grieving", "mourning", "bereaved"],
  },
  calamity: {
    strong: ["disaster", "catastrophe", "calamity", "earthquake", "flood", "flooded", "tsunami", "hurricane", "wildfire", "burned down", "lost everything", "tragedy", "tragic", "affliction", "house fire", "lost our home", "lost my home"],
  },
  bad_news: {
    strong: ["bad news", "terrible news", "sad news", "awful news", "horrible news", "devastating news", "disappointing news"],
    weak: ["disappointed", "disappointing", "disappointment"],
  },
  accident: {
    strong: ["accident", "crash", "collision", "car crash"],
    weak: ["injured", "injury", "fell", "broken bone", "broke my"],
  },
  good_news: {
    strong: ["good news", "great news", "amazing news", "happy news", "wonderful news", "got approved", "got accepted", "got promoted", "promotion", "engaged", "celebrating", "celebration", "i passed", "passed my", "got the job", "got the visa"],
    weak: ["excited", "so happy"],
  },
  parents: {
    strong: ["my parents", "mom and dad", "mum and dad", "mother and father", "mama and baba", "raised me", "raising me", "brought me up", "dua for my parents"],
    weak: ["parents", "my mom", "my dad", "my mother", "my father", "for my mother", "for my father", "mama", "baba", "mum"],
    conflict: ["passed away", "died", "death", "funeral", "diagnosed", "surgery", "sick"],
  },
  pregnancy: {
    strong: ["pregnant", "pregnancy", "expecting a", "expecting our", "expecting my", "we are expecting", "i am expecting", "trying to conceive", "cant conceive", "cant get pregnant", "cannot conceive", "cannot get pregnant", "cannot have a baby", "cannot have children", "conceive", "miscarriage", "infertility", "infertile", "barren", "childless", "want a baby", "want a child", "wanting a baby", "trying for a baby", "cant have a baby", "cant have children"],
    weak: ["baby", "birth"],
  },
  NewBorn: {
    strong: ["newborn", "new baby", "gave birth", "just born", "was born", "had a baby", "welcomed a baby", "aqiqah", "aqeeqah", "birth of my", "new arrival", "congratulations on the baby"],
    weak: ["baby girl", "baby boy", "baby", "infant"],
  },
  children: {
    strong: ["protect my children", "protect my kids", "protect my child", "protect my son", "protect my daughter", "protection for my children", "keep my children safe", "keep my kids safe", "my kids safe"],
    weak: ["my kids", "my children", "my child", "my son", "my daughter", "kids", "children"],
  },
  family: {
    strong: ["righteous offspring", "righteous children", "righteous kids", "righteous child", "good offspring", "children ~ pious", "kids ~ pious", "child ~ pious", "children ~ righteous", "kids ~ righteous", "child ~ righteous", "raise my children well", "raise my kids well", "raise righteous"],
    weak: ["family", "offspring", "spouse"],
  },
  marriage: {
    strong: ["nikah", "get married", "getting married", "want to marry", "looking for a husband", "looking for a wife", "righteous husband", "righteous wife", "righteous spouse", "good husband", "good wife", "pious spouse", "future spouse", "future husband", "future wife", "wedding", "engagement", "marriage", "marry", "married life", "walima", "find a spouse", "find a husband", "find a wife"],
    weak: ["spouse", "husband", "wife", "partner"],
  },
  divorce: {
    strong: ["divorce", "divorced", "divorcing", "talaq", "khula", "separation", "separated", "ending my marriage", "end my marriage", "marriage problems", "marital problems", "problems in my marriage", "troubled marriage", "unhappy marriage", "toxic marriage", "marriage is falling apart", "my husband left", "my wife left"],
    weak: ["husband", "wife", "keep fighting", "keep arguing", "always fighting", "always arguing", "arguing", "left me"],
  },
  family_conflict: {
    strong: ["family conflict", "family problems", "family drama", "family feud", "family issues", "family fight", "falling out with", "estranged", "havent spoken", "not speaking to", "stopped talking to", "cut me off", "fight ~ brother", "fight ~ sister", "fight ~ cousin", "fight ~ in laws", "argue ~ brother", "argue ~ sister", "argued ~ brother", "argued ~ sister", "mother in law", "father in law", "in laws"],
    weak: ["brother", "sister", "cousin", "relatives", "siblings", "keep fighting"],
    conflict: ["inheritance"],
  },
  inheritance: {
    strong: ["inheritance", "inherit", "inherited", "heir", "heirs", "will and testament", "mirath", "wasiyyah", "dividing the property", "family property", "estate"],
  },
  debt: {
    strong: ["debt", "debts", "in debt", "loan", "loans", "owe", "cant pay", "cant afford", "mortgage", "credit card", "bankrupt", "bankruptcy", "creditors", "borrowed money", "behind on rent"],
    weak: ["bills", "rent", "owe money", "pay back", "repay", "repaying"],
  },
  provision: {
    strong: ["rizq", "rizk", "provision", "sustenance", "financial hardship", "financial struggles", "money is tight", "money problems", "i am broke", "flat broke", "so broke", "poverty", "need money", "barakah in my income", "barakah in my wealth", "halal income", "halal rizq", "lawful income", "financially struggling", "struggling financially", "financially", "abundance", "wealth", "income", "salary"],
    weak: ["money", "financial", "finances", "poor", "rich", "wealthy", "broke"],
  },
  job: {
    strong: ["unemployed", "unemployment", "lost my job", "laid off", "layoff", "fired", "job search", "looking for a job", "looking for work", "need a job", "find a job", "finding a job", "get a job", "new job", "employment", "hiring", "job offer", "work opportunity", "resume"],
    weak: ["job", "career", "work", "jobs"],
  },
  job_interview: {
    strong: ["interview", "interviews", "job interview", "interviewing"],
  },
  business: {
    strong: ["business", "entrepreneur", "startup", "start up", "my company", "open a shop", "opening a shop", "starting a business", "opening a business", "venture", "invest", "investing", "investment", "trading", "profit", "customers", "clients", "sales"],
    weak: ["trade", "shop", "company"],
  },
  market: {
    strong: ["market", "marketplace", "bazaar", "mall", "shopping", "go shopping", "grocery", "groceries", "supermarket", "souk"],
    weak: ["store", "shop", "buying"],
    conflict: ["stock market", "job market", "market research"],
  },
  anxiety: {
    ...MOOD,
    strong: ["anxious", "anxiety", "stressed", "stress", "panic attack", "panic", "panicking", "overthinking", "overthink", "overwhelmed", "overwhelming", "on edge", "worried sick", "cant stop thinking", "racing thoughts", "pressure", "hasbiyallah"],
    weak: ["nervous", "nervousness", "tense", "mind wont stop"],
  },
  worry: {
    ...MOOD,
    strong: ["worried", "worry", "worrying", "so worried", "grief", "sadness", "distress", "troubled", "sorrow", "grieving"],
  },
  fear: {
    ...MOOD,
    strong: ["afraid", "scared", "terrified", "terror", "frightened", "phobia", "fear of", "scared of", "afraid of", "fearful", "dread", "fear"],
    conflict: ["scared of my husband", "afraid of my husband", "scared to death", "worried to death"],
  },
  depression: {
    ...MOOD,
    strong: ["depressed", "depression", "hopeless", "despair", "no hope", "no point", "nothing matters", "nothing will ever get better", "feel empty", "numb", "cant stop crying", "feel down", "sad all the time", "mental health", "heartbroken", "broken heart", "heart ~ broken", "heart broke", "feel hopeless", "worthless"],
    weak: ["sad", "crying", "tears", "empty", "unhappy"],
  },
  loneliness: {
    ...MOOD,
    strong: ["lonely", "loneliness", "feel ~ alone", "feeling alone", "isolated", "isolation", "no friends", "have no one", "nobody cares", "nobody understands", "no one understands", "no one to talk to", "nobody to talk to", "left out", "wahshah"],
    weak: ["alone", "no one"],
    conflict: ["leave me alone", "alone time", "home alone"],
  },
  longing: {
    strong: ["i miss", "missing my", "miss my", "homesick", "longing for", "longing", "yearn", "reunite", "reunion", "far from my family", "far from home", "miss them", "miss him", "miss her", "missing you"],
    conflict: ["miss my flight", "miss my bus", "miss my train", "miss my exam", "miss my appointment", "miss my deadline", "miss my class", "miss my prayer", "miss my meeting"],
  },
  anger: {
    ...MOOD,
    strong: ["angry", "anger", "furious", "rage", "enraged", "temper", "lose my temper", "losing my temper", "so mad", "mad at", "pissed", "livid", "irritated", "annoyed", "control my anger", "fuming", "ghussa"],
    weak: ["mad", "annoying", "frustrated", "frustration", "snapped"],
  },
  jealousy: {
    strong: ["jealous", "jealousy", "envy", "envious", "hasad", "hasid", "evil eye", "nazar", "nazr", "envying", "bad eye", "gave me the evil eye", "someone envies", "envies me"],
    conflict: ["i am jealous", "i feel jealous", "i get jealous", "i am envious", "i envy", "i feel envious"],
  },
  difficulty: {
    ...MOOD,
    strong: ["difficult", "difficulty", "hardship", "hard time", "going through a hard", "tough time", "struggling", "struggle", "everything is hard", "life is hard", "so hard right now", "things are hard", "hard times", "tribulation", "make it easy", "ease my"],
  },
  patience: {
    ...MOOD,
    strong: ["patience", "patient", "sabr", "give me patience", "need patience", "endure", "endurance", "be patient"],
  },
  steadfastness: {
    strong: ["steadfast", "steadfastness", "stay firm", "firm on my deen", "firm on my religion", "keep my faith", "hold on to my faith", "faith is weak", "iman is low", "imaan", "deen", "stay consistent", "consistency", "istiqamah", "istiqama", "turner of hearts", "lose my faith", "firm on"],
  },
  guidance: {
    s: 8,
    cap: 9,
    strong: ["guidance", "guide me", "guide us", "hidayah", "hidaya", "hidayat", "right path", "straight path", "show me the way", "lost my way", "lost in life", "direction in life", "need direction", "need clarity"],
    weak: ["clarity", "direction"],
  },
  confusion: {
    strong: ["helpless", "helplessness", "powerless", "lazy", "laziness", "procrastinate", "procrastinating", "procrastination", "unmotivated", "no motivation", "coward", "cowardly", "cowardice"],
    weak: ["confused", "confusion", "unsure"],
  },
  decision: {
    s: 14,
    strong: ["istikhara", "istikharah", "make a decision", "making a decision", "decide", "deciding", "cant decide", "choose between", "torn between", "undecided", "which one to choose", "salat al istikhara"],
    weak: ["decision", "choice", "choose"],
  },
  major_decision: {
    strong: ["life changing", "major decision", "big decision", "big choice", "huge decision", "important decision", "move abroad", "what to do with my life", "career change", "change careers", "quit my job", "move to another country", "immigrate", "emigrate", "crossroads", "at a crossroads"],
  },
  consultation: {
    strong: ["seek advice", "seeking advice", "need advice", "ask for advice", "consult", "consulting", "consultation", "counsel", "seek counsel", "shura", "second opinion", "asking opinion"],
    weak: ["advice", "opinion"],
  },
  hope: {
    ...MOOD,
    strong: ["need ~ hope", "lost hope", "losing hope", "hopeful", "optimistic", "optimism", "expect good", "think good of allah", "husn al dhann", "positive thinking", "ease after hardship"],
    weak: ["hope"],
  },
  peace: {
    ...MOOD,
    strong: ["peace of mind", "inner peace", "peace", "peaceful", "tranquility", "tranquillity", "serenity", "sakinah", "mental peace", "peace in my heart", "peaceful mind"],
    weak: ["calm", "calm down", "relax", "calmness"],
    conflict: ["peace be upon"],
  },
  gratitude: {
    ...MOOD,
    strong: ["thankful", "grateful", "gratitude", "thank allah", "thanks to allah", "alhamdulillah", "hamdulillah", "shukr", "blessed", "blessings", "count my blessings"],
    weak: ["thanks", "thank", "appreciate"],
  },
  gift: {
    strong: ["gift", "gifts", "jazakallah", "jazakallahu khayran", "did me a favor", "helped me", "received a gift", "got a gift", "gave me a gift", "birthday present", "hadiyah", "hadiya"],
    weak: ["present", "favor"],
  },
  praise: {
    strong: ["compliment", "complimented", "praised", "praising me", "praise me", "complimenting", "compliments", "people praise", "admired", "admiration", "flattered", "flattery", "they praise me", "told me i am"],
  },
  seeing_disabled: {
    strong: ["wheelchair", "disabled", "disability", "handicapped", "amputee", "paralyzed", "blind man", "blind person", "deaf", "someone afflicted", "saw someone suffering"],
  },
  protection: {
    strong: ["protect me", "protect us", "protection", "refuge", "seek refuge", "shaytan", "shaitan", "satan", "devil", "jinn", "jinns", "jin", "djinn", "waswasa", "waswas", "whispers", "intrusive thoughts", "safe from harm", "keep me safe", "keep us safe", "safeguard", "black magic", "sihr", "possessed", "haunted", "magic"],
    weak: ["protect", "harm", "safe", "danger", "evil"],
  },
  enemy: {
    strong: ["enemy", "enemies", "plotting against me", "conspiring against me", "scheming against me", "out to get me", "hate me", "hates me", "hating me", "hated me", "bully", "bullies", "bullying", "bullied", "hostile", "persecution", "tyrant", "at war"],
    weak: ["war"],
  },
  oppression: {
    strong: ["oppressed", "oppression", "oppressing", "oppressor", "zulm", "zulum", "dhulm", "wronged", "treated unjustly"],
  },
  injustice: {
    strong: ["unfair", "unfairly", "injustice", "unjust", "discrimination", "discriminated", "racism", "racist", "no justice", "framed", "falsely accused", "false accusation", "wrongfully", "wrongly accused", "wrongful"],
  },
  legal: {
    strong: ["court", "lawsuit", "sued", "lawyer", "attorney", "judge", "trial", "legal", "legal case", "custody", "police", "arrested", "prison", "jail", "verdict", "charged with", "case against me", "false charges", "tribunal", "litigation", "sentenced", "bail", "court hearing", "custody hearing", "legal hearing"],
    weak: ["sue", "my case"],
  },
  forgiveness: {
    strong: ["forgive me", "forgiveness", "ask ~ forgiveness", "seek forgiveness", "istighfar", "astaghfirullah", "maghfirah", "ask for forgiveness", "forgive my sins", "my sins", "sins", "sinned", "sinful", "guilty", "guilt"],
    weak: ["mistakes", "regret", "sin"],
  },
  repentance: {
    strong: ["tawbah", "tawba", "taubah", "toba", "tauba", "repent", "repentance", "repenting", "committed zina", "committed a major sin", "major sin", "big sin", "fornication", "adultery", "did something haram", "committed a sin"],
    weak: ["zina", "haram"],
  },
  forgiveness_from_people: {
    strong: ["apologize", "apologise", "apology", "apologizing", "make amends", "reconcile", "reconciliation", "i hurt my friend", "hurt someone", "hurtful", "wronged someone", "i wronged", "ask for their forgiveness", "wont forgive me", "forgiveness from my", "owe an apology", "say sorry", "hurt my"],
    weak: ["sorry"],
  },
  temptation: {
    strong: ["temptation", "tempted", "urge", "urges", "lust", "desire", "craving", "cant resist", "resist temptation", "lower my gaze", "lowering my gaze", "cant control my eyes", "cant control my gaze", "evil of my sight", "looking at things i shouldnt", "sinful thoughts", "evil thoughts"],
    weak: ["my eyes", "my gaze"],
  },
  chastity: {
    strong: ["chastity", "chaste", "stay pure", "purity", "falling into zina", "haram relationship", "haram relationships", "stay away from haram", "avoid zina", "stay away from zina"],
    weak: ["zina", "haya"],
  },
  addiction: {
    strong: ["addicted", "addiction", "addict", "cant quit", "porn", "pornography", "gambling", "gamble", "alcohol", "drinking problem", "drugs", "smoking", "vape", "vaping", "cocaine", "substance", "relapse", "relapsed", "bad habit", "bad habits", "quit smoking"],
    weak: ["cant stop", "quit", "weed"],
  },
  backbiting: {
    strong: ["backbiting", "backbite", "backbitten", "gossip", "gossiping", "ghibah", "gheebah", "ghiba", "slander", "slandering", "talking behind", "talk behind my back", "talks behind", "speaking ill of", "rumor", "rumour", "rumors"],
  },
  humility: {
    strong: ["humble", "humility", "arrogance", "arrogant", "kibr", "takabbur", "vanity", "conceited", "too proud", "feel superior", "full of myself", "big headed", "boasting", "boast"],
    weak: ["proud", "pride", "ego"],
  },
  sincerity: {
    strong: ["sincere", "sincerity", "ikhlas", "ikhlaas", "riya", "riyaa", "showing off", "show off", "intention", "intentions", "purify my intention", "seeking praise", "for show", "shirk", "pure intention"],
  },
  charity: {
    strong: ["sadaqah", "sadaqa", "sadaqat", "charity", "donate", "donation", "donating", "zakat", "zakah", "give to the poor", "feed the poor", "giving to charity", "generosity", "generous", "waqf", "infaq"],
  },
  heart: {
    strong: ["heart ~ hard", "hard ~ heart", "hardened heart", "soften my heart", "soften hearts", "cant cry", "cannot cry", "no khushu", "khushu", "khushoo", "kindness", "compassion", "mercy in my heart", "qalb", "heartless", "cold heart"],
    weak: ["my heart"],
  },
  remembrance: {
    strong: ["dhikr", "zikr", "remembrance of allah", "remember allah", "remembering allah", "make more dhikr"],
    weak: ["tasbih", "tasbeeh", "mindful", "mindfulness"],
  },
  quran: {
    strong: ["quran", "koran", "recite surah", "reciting surah", "recite ayat", "recite quran", "memorize quran", "hifz", "hifdh", "tajweed", "surah", "ayah", "ayat", "mushaf", "read quran", "finish the quran", "khatm"],
    weak: ["recite", "recitation", "reciting"],
  },
  knowledge: {
    strong: ["knowledge", "gain knowledge", "seek knowledge", "seeking knowledge", "ilm", "increase my knowledge", "islamic studies"],
    weak: ["learn", "learning", "student", "understand", "understanding", "wisdom", "education", "homework", "assignment", "thesis", "research", "study", "studying"],
  },
  success: {
    strong: ["success", "succeed", "successful", "do well in", "achieve my goals", "achieve", "achievement", "victory", "goals", "excel", "excellence", "prosper", "prosperity", "good in this world and the hereafter", "hasanah", "rabbana atina"],
    weak: ["goal", "win"],
  },
  paradise: {
    strong: ["paradise", "jannah", "jannat", "firdaus", "enter jannah", "heaven", "afterlife", "hereafter", "akhirah", "akhira", "day of judgment", "day of judgement", "hellfire", "fire of hell", "punishment of hell", "save me from hell", "good ending", "husnul khatimah", "good end", "qiyamah"],
    conflict: ["what the hell", "hell of a"],
  },
  mosque: {
    strong: ["entering the mosque", "entering the masjid", "enter the mosque", "enter the masjid", "leaving the mosque", "leaving the masjid", "leave the mosque", "leave the masjid", "going to the mosque", "going to the masjid", "go to the mosque", "go to the masjid", "heading to the masjid", "heading to the mosque", "walking to the mosque", "walking to the masjid", "at the mosque", "at the masjid", "mosque dua", "masjid dua", "dua for the mosque", "dua for the masjid", "masjed"],
    weak: ["mosque", "masjid", "mosques", "jamaah"],
  },
  adhan: {
    strong: ["adhan", "azan", "athan", "adzan", "call to prayer", "prayer call", "muadhdhin", "muezzin"],
  },
  after_prayer: {
    strong: ["after prayer", "after salah", "after salat", "after namaz", "after praying", "finished praying", "done praying", "post prayer"],
    weak: ["tasbih", "tasbeeh"],
  },
  witr: {
    strong: ["witr", "tahajjud", "qiyam", "qiyam al layl", "night prayer", "qunoot", "qunut", "pray at night", "last third of the night", "late night prayer"],
  },
  "laylatul qadr": {
    strong: ["laylatul qadr", "lailatul qadr", "laylat al qadr", "laylatulqadr", "laylatul kadr", "lailat ul qadr", "layla tul qadr", "shab e qadr", "night of power", "night of decree", "night of qadr", "last ten nights", "last 10 nights", "odd nights", "27th night"],
    weak: ["ramadan", "qadr"],
  },
  Friday: {
    strong: ["friday", "jummah", "jumah", "jumuah", "jumua", "juma", "salawat", "durood", "send blessings upon the prophet", "salat on the prophet"],
    conflict: ["black friday"],
  },
  breaking_fast: {
    strong: ["iftar", "break my fast", "break the fast", "breaking my fast", "breaking fast", "break fast", "about to break", "fast opening"],
    weak: ["fasting", "fast", "ramadan"],
  },
  eating: {
    strong: ["before eating", "after eating", "finished eating", "about to eat", "before i eat", "before dinner", "before lunch", "before breakfast", "after dinner", "after lunch", "after breakfast", "start my meal", "eating dua", "dua for food", "dua before meal", "dua after meal", "after my meal", "before my meal", "before the meal", "when eating", "when i eat", "while eating"],
    weak: ["food", "meal", "dinner", "lunch", "breakfast", "eating", "hungry"],
  },
  drinking_water: {
    strong: ["drinking water", "drink water", "drank water", "glass of water", "thirsty", "thirst", "after drinking"],
    weak: ["drink", "water", "drinking"],
  },
  bathroom: {
    strong: ["bathroom", "toilet", "restroom", "washroom", "wc", "lavatory", "relieve myself"],
  },
  mirror: {
    strong: ["mirror", "reflection", "looking at myself", "my appearance", "how i look", "feel ugly", "ugly", "insecure about my looks", "my looks"],
  },
  new_clothes: {
    strong: ["new clothes", "new dress", "new outfit", "new shirt", "new shoes", "new thobe", "new abaya", "new hijab", "new jacket", "wearing new", "put on new", "wear something new"],
  },
  sneezing: {
    strong: ["sneeze", "sneezed", "sneezes", "sneezing", "achoo", "bless you"],
  },
  sitting: {
    strong: ["bad company", "avoid bad company", "bad friends", "bad influence", "bad crowd", "good company", "righteous company"],
    weak: ["sitting with", "sit with"],
  },
  meeting: {
    strong: ["meeting", "gathering", "assembly", "majlis", "end of a meeting", "end of the meeting", "after the meeting", "end of a gathering", "kaffarat al majlis"],
  },
  morning: {
    strong: ["wake up", "waking up", "woke up", "when i wake", "dawn", "sunrise", "sun rises", "sun rise", "sun rising", "start my day", "start the day", "good morning", "morning adhkar", "morning dua", "morning supplication", "dua for the morning"],
    weak: ["morning", "fajr"],
    conflict: ["middle of the night", "at night", "nightmare", "cant sleep", "woke up scared", "for qiyam", "for tahajjud", "for prayer", "for fajr", "tahajjud", "qiyam"],
  },
  night: {
    strong: ["dusk", "sunset", "after maghrib", "nightfall", "good evening", "evening adhkar", "evening dua", "dua for the evening", "for the evening", "when night falls"],
    weak: ["evening", "night", "nighttime", "dark", "darkness", "maghrib"],
  },
  sleep: {
    strong: ["sleep", "sleeping", "asleep", "insomnia", "nightmare", "nightmares", "bedtime", "bad dream", "bad dreams", "before bed", "going to bed", "go to bed", "in bed", "lying down", "tossing and turning", "sleepless", "cant fall asleep", "woke up scared", "middle of the night", "wake up at night", "waking up at night", "while i sleep"],
    weak: ["dreams", "bed", "dream"],
  },
  travel: {
    strong: ["travel", "traveling", "travelling", "traveler", "journey", "trip", "flight", "flights", "airport", "going abroad", "road trip", "hajj", "umrah", "boarding", "safar", "back from my trip", "returned from my trip", "returning from", "safe return", "arrived safely", "landed"],
    weak: ["plane", "flying", "train", "bus"],
  },
  vehicle: {
    strong: ["getting into the car", "get into the car", "into the car", "in the car", "getting in the car", "get in my car", "get into my car", "start the car", "start my car", "riding", "on the bus", "taking the bus", "taking a taxi", "motorcycle", "uber", "taxi", "ride a"],
    weak: ["car", "driving", "vehicle", "ride"],
    conflict: ["car crash", "car accident"],
  },
  entering_home: {
    strong: ["got back home", "got home", "get home", "getting home", "came home", "coming home", "arrived home", "arriving home", "reach home", "reached home", "entering home", "enter my house", "entering my house", "entering the house", "enter the house", "walk into my house", "walking into the house", "enter my home", "entering my home"],
  },
  leaving_home: {
    strong: ["leaving home", "leave my house", "leaving my house", "leaving the house", "leave the house", "step out", "stepping out", "going out", "heading out", "exiting the house", "about to leave"],
    weak: ["out of the house"],
  },
  moving_home: {
    strong: ["moving to a new", "moving house", "moving home", "new house", "new home", "new apartment", "relocate", "relocating", "relocation", "moved into", "housewarming", "buying a house", "buying a home"],
    weak: ["moving", "move"],
    conflict: ["move abroad"],
  },
  rain: {
    strong: ["rain", "raining", "rainfall", "drizzle", "drought", "downpour", "pouring", "its pouring"],
    weak: ["storm", "weather"],
  },
  thunder: {
    strong: ["thunder", "lightning", "thunderstorm"],
  },
};

type Term = string[];
interface CompiledRule {
  category: string;
  strong: Term[];
  weak: Term[];
  conflict: Term[];
  s: number;
  cap: number;
}

const toTerms = (list: string[] | undefined): Term[] => (list ?? []).map((t) => t.split(" "));

const COMPILED: CompiledRule[] = Object.entries(RULES).map(([category, rule]) => ({
  category,
  strong: toTerms(rule.strong),
  weak: toTerms(rule.weak),
  conflict: toTerms(rule.conflict),
  s: rule.s ?? STRONG,
  cap: rule.cap ?? Infinity,
}));

// A word that already appears in some rule is a real word, not a typo, so it
// is never fuzzy-matched to a neighbour ("final" must not become "finals").
const VOCAB = new Set(
  COMPILED.flatMap((r) => [...r.strong, ...r.weak, ...r.conflict]).flatMap((t) => t).filter((w) => w !== "~"),
);

/** Categories that have a scoring rule. */
export const RULE_CATEGORIES = Object.keys(RULES);

// Small local edit distance: fuzzy matching is limited to longer words, so
// this stays cheap and short words never drift.
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let prev2 = prev;
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

// 1 exact, FUZZY_WEIGHT for a near miss on a long word (same first letter), 0 otherwise.
function wordQuality(token: string, word: string): number {
  if (token === word) return 1;
  if (word.length < 6 || token[0] !== word[0] || VOCAB.has(token)) return 0;
  const max = word.length >= 10 ? 2 : 1;
  return editDistance(token, word, max) <= max ? FUZZY_WEIGHT : 0;
}

function matchFrom(tokens: string[], i: number, term: Term, k: number, q: number): number {
  if (k === term.length) return q;
  if (term[k] === "~") {
    let best = 0;
    for (let g = 0; g <= MAX_GAP && i + g <= tokens.length; g += 1) {
      best = Math.max(best, matchFrom(tokens, i + g, term, k + 1, q));
    }
    return best;
  }
  if (i >= tokens.length) return 0;
  const w = wordQuality(tokens[i], term[k]);
  return w === 0 ? 0 : matchFrom(tokens, i + 1, term, k + 1, Math.min(q, w));
}

function termQuality(tokens: string[], term: Term): number {
  let best = 0;
  for (let i = 0; i < tokens.length && best < 1; i += 1) {
    best = Math.max(best, matchFrom(tokens, i, term, 0, 1));
  }
  return best;
}

function scoreRule(tokens: string[], rule: CompiledRule): number {
  // A conflict term vetoes the category outright. It must match exactly: a near miss never vetoes.
  if (rule.conflict.some((t) => termQuality(tokens, t) === 1)) return 0;
  let score = 0;
  for (const t of rule.strong) score += termQuality(tokens, t) * rule.s;
  for (const t of rule.weak) score += termQuality(tokens, t) * WEAK;
  return Math.min(score, rule.cap);
}

// Specific sleep situations. Used only to choose among the sleep duas.
const SLEEP_PICKS: { id: number; terms: Term[] }[] = [
  { id: 116, terms: toTerms(["nightmare", "nightmares", "bad dream", "bad dreams", "scary dream", "woke up scared", "woke up afraid", "scared to sleep", "afraid to sleep", "sleep paralysis"]) },
  { id: 117, terms: toTerms(["middle of the night", "wake up at night", "waking up at night", "woke up at night", "woke up during the night", "wake up in the middle"]) },
  { id: 118, terms: toTerms(["cant sleep", "cant fall asleep", "insomnia", "sleepless", "restless", "tossing and turning", "tossing", "mind wont stop", "racing thoughts", "wide awake"]) },
  { id: 119, terms: toTerms(["lie down", "lying down", "going to bed", "go to bed", "before bed", "bedtime", "about to sleep", "going to sleep", "before i sleep", "before sleeping"]) },
  { id: 120, terms: toTerms(["while i sleep", "protect me while", "ayat al kursi", "ayatul kursi", "kursi", "safe tonight", "protected through the night", "jinn"]) },
];

function pickSleepIds(tokens: string[]): number[] | undefined {
  const hits = SLEEP_PICKS.map((p) => ({ id: p.id, n: p.terms.filter((t) => termQuality(tokens, t) > 0).length }));
  const top = Math.max(...hits.map((h) => h.n));
  return top > 0 ? hits.filter((h) => h.n === top).map((h) => h.id) : undefined;
}

// shortcut: negation ("not worried", "no longer afraid") is not handled and still scores as the feeling; upgrade to a short negation window before the term if wrong matches show up.
export function matchDua(input: string): DuaMatch {
  const crisisId = detectCrisis(input);
  if (crisisId !== null) return { kind: "crisis", duaId: crisisId };

  const tokens = normalizeInput(input).split(" ").filter(Boolean);
  if (tokens.length === 0) return { kind: "none" };

  const scored = COMPILED.map((rule) => ({ category: rule.category, score: scoreRule(tokens, rule) }))
    .filter((r) => r.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return { kind: "none" };

  const best = scored[0].score;
  const tied = scored.filter((r) => best - r.score < 0.01);
  const topics = new Set(tied.map((r) => topicForCategory(r.category)?.id ?? r.category));
  if (topics.size > 1) return { kind: "none" };

  const categories = tied.map((r) => r.category);
  return categories.includes("sleep")
    ? { kind: "match", categories, duaIds: pickSleepIds(tokens) }
    : { kind: "match", categories };
}
