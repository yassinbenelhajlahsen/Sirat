/**
 * Offline dua matching: a crisis check first, then a weighted keyword scorer.
 * Rules are written from what each dua in duas.json actually says, not from
 * its category name. A low score is "no match": it is better to show the
 * general dua than a wrong one. A tie returns every tied category. What the
 * rules cannot place goes to a trained classifier (duaClassifier.ts).
 *
 * Nothing the user types leaves this module: no logging, no storage.
 */
import { bundledModel, decide } from "./duaClassifier";

export type DuaMatch =
  | { kind: "crisis"; duaId: number }
  | { kind: "match"; categories: string[]; duaIds?: number[]; strong?: boolean }
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

// Accented letters (Turkish, French, Malay, Indonesian) fold to plain ones so a word is not split in two.
function foldAccents(text: string): string {
  const base = typeof text.normalize === "function" ? text.normalize("NFD").replace(/[̀-ͯ]/g, "") : text;
  return base.replace(/ı/g, "i").replace(/ø/g, "o").replace(/æ/g, "ae").replace(/ß/g, "ss");
}

export function normalizeInput(input: string): string {
  return foldAccents(input.toLowerCase())
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
  /\b(killing me|kills me|killed me|kill me (if|when|for)|dying to|die of embarrassment|dying of embarrassment|die of shame|die laughing|dying laughing|dying of laughter|dead tired|to die for|bored to death|scared to death|worried to death|be the death of me|death of me|cut myself some slack|(going|gonna) to kill me (lol|lmao|haha|jk)|(dont|do not) want to die (in a bad state|in sin|in a state|without|before i|upon|on anything|as a))\b/g;

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
    strong: ["exam", "exams", "final exam", "finals", "final tomorrow", "midterm", "midterms", "quiz", "entrance exam", "driving test", "driving exam", "studying for", "study for", "revise for", "revision", "test tomorrow", "ielts", "toefl", "gcse", "viva", "board exams", "sat exam", "tests", "mid term", "mid terms", "mocks", "mock exam", "mock results", "havent studied", "not studied", "questions easy", "blanking during", "revising", "boards", "the paper", "into a test", "entrance test"],
    weak: ["test", "study", "studying", "school", "grades", "memorize", "memorise", "university", "final"],
    conflict: ["test results", "blood test", "covid test", "pregnancy test", "cancer", "positive for", "diagnosed", "biopsy", "scan"],
  },
  medical: {
    strong: ["surgery", "operation", "diagnosed", "diagnosis", "cancer", "tumor", "tumour", "chemo", "chemotherapy", "biopsy", "test results", "results came back", "scan results", "mri", "ct scan", "dialysis", "transplant", "heart attack", "stroke", "intensive care", "icu", "life support", "surgeon", "medical", "treatment", "doctor said", "doctors said", "c section", "procedure", "anesthesia", "anaesthesia", "colonoscopy", "endoscopy", "lab results", "blood work", "blood test", "amputate", "amputation", "operating on", "lump", "the report", "meds", "side effects", "the theatre"],
    weak: ["hospital", "doctor", "clinic", "appointment", "medication", "checkup", "results"],
  },
  illness: {
    strong: ["sick", "sickness", "illness", "fever", "flu", "infection", "pain", "headache", "migraine", "stomach ache", "sore throat", "not feeling well", "unwell", "under the weather", "shifa", "shifaa", "cough", "ill", "asthma", "dizzy", "nausea", "nauseous", "coughing", "virus", "covid", "bedridden", "pounding", "vomiting", "throwing up", "everything hurts", "caught a cold", "a cold", "high temp", "temperature"],
    weak: ["hurts", "hurting", "back", "knee", "head", "stomach", "tooth", "chest", "leg", "arm", "neck"],
    conflict: ["sick of", "sick and tired", "visit sick", "visiting sick"],
  },
  healing: {
    strong: ["ruqya", "ruqyah", "ruqia", "heal", "healed", "healing", "cure", "cured", "recovery", "recover", "get better soon", "get well", "him get better", "her get better", "to get better", "well soon", "back on his feet", "back on her feet", "up and walking", "recite over", "make him well", "make her well", "let ~ get better"],
    weak: ["health", "healthy"],
  },
  visiting_sick: {
    strong: ["visit ~ sick", "visiting ~ sick", "visit ~ hospital", "visiting ~ hospital", "visit ~ patient", "visiting ~ patient", "visit ~ ill", "bedside", "check on", "friend in hospital", "friend in the hospital", "mate in the hospital", "sit with ~ hospital", "sitting with ~ hospital", "bringing flowers", "see my teacher", "got discharged", "nursing home", "in the ward", "to see my ~ in hospital", "went to see my"],
  },
  deceased: {
    strong: ["died", "passed away", "pass away", "passed on", "death", "dead", "deceased", "funeral", "janazah", "janaza", "jenazah", "burial", "buried", "grave", "last goodbye", "final goodbye", "condolences", "condolence", "rest in peace", "inna lillahi", "late father", "late mother", "late husband", "late wife", "late grandmother", "late grandfather", "who passed", "has passed", "had passed", "passed last", "passed yesterday", "passed today", "passed suddenly", "passed recently", "soul of", "his soul", "her soul", "washing the body", "body is being washed", "someone dies", "when someone dies"],
    conflict: ["dead tired", "dead battery", "dead end", "dead serious", "scared to death", "bored to death", "worried to death", "death of me"],
    weak: ["passed", "gone"],
  },
  loss: {
    strong: ["lost my father", "lost my mother", "lost my dad", "lost my mom", "lost my husband", "lost my wife", "lost my son", "lost my daughter", "lost my brother", "lost my sister", "lost my grandmother", "lost my grandfather", "lost my best friend", "lost my baby", "lost someone", "lost a loved one", "loved one", "bereavement", "grieving", "mourning", "bereaved", "losing a parent", "losing a loved one", "losing someone", "losing my mum", "losing my mom", "losing my dad", "losing my father", "losing my mother", "losing my wife", "losing my husband", "losing my son", "losing my daughter", "losing my brother", "losing my sister", "losing my best friend", "is gone", "allah took", "wife passed", "husband passed", "lost my grandma", "lost my grandpa", "lost my nan", "lost my nana", "lost my nani", "lost my uncle", "lost my aunt", "lost my cousin", "lost my friend", "lost my child", "since she passed", "since he passed", "half my world"],
  },
  calamity: {
    strong: ["disaster", "catastrophe", "calamity", "earthquake", "flood", "flooded", "tsunami", "hurricane", "wildfire", "burned down", "lost everything", "tragedy", "tragic", "affliction", "house fire", "lost our home", "lost my home", "cyclone", "typhoon", "explosion", "bombing", "under water", "everything is gone", "lost the house", "lost our house", "lost my house", "in the fire", "landslide", "famine", "war zone", "wiped out", "shelled", "shelling", "fled", "collapsed", "trapped", "the fire took", "ruined everything", "took all our"],
  },
  bad_news: {
    strong: ["bad news", "terrible news", "sad news", "awful news", "horrible news", "devastating news", "disappointing news", "fell through", "rejected", "rejection", "declined", "withdrawn", "news ~ awful", "news ~ terrible", "news ~ bad", "news ~ devastating", "didnt get the", "not getting the", "wrecked my", "denied", "not renewing", "wont be renewing", "didnt want to hear", "upsetting", "came back positive"],
    weak: ["disappointed", "disappointing", "disappointment"],
  },
  accident: {
    strong: ["accident", "crash", "collision", "car crash", "fell off", "fell from", "fell down", "rear ended", "flipped", "ambulance", "hit by a car", "got hit", "slipped and", "hit his head", "hit her head", "hit my head", "injured", "a fall", "had a fall", "near misses", "near miss", "derailed", "spun off", "truck hit", "hit our car", "hit my car", "slipped on", "broke my wrist", "broke my arm", "broke my leg"],
    weak: ["injured", "injury", "fell", "broken bone", "broke my"],
  },
  good_news: {
    strong: ["good news", "great news", "amazing news", "happy news", "wonderful news", "got approved", "got accepted", "got promoted", "promotion", "engaged", "celebrating", "celebration", "i passed", "passed my", "got the job", "got the visa", "approved", "came through", "got into", "proposed to me", "accepted into", "scholarship", "finally happened", "acceptance letter", "admitted"],
    weak: ["excited", "so happy"],
  },
  parents: {
    strong: ["my parents", "mom and dad", "mum and dad", "mother and father", "mama and baba", "raised me", "raising me", "brought me up", "dua for my parents", "dua for parents", "for my parents", "for parents", "my mother deserves", "elderly parents", "aging parents", "getting older", "ammi", "abbu", "reward my mother", "reward my father", "reward my parents", "for raising"],
    weak: ["parents", "mom", "dad", "mother", "father", "mama", "baba", "mum", "for my mom", "for my mother", "for my dad", "for my father"],
    conflict: ["passed away", "died", "death", "funeral", "diagnosed", "surgery", "sick"],
  },
  pregnancy: {
    strong: ["pregnant", "pregnancy", "expecting a", "expecting our", "expecting my", "we are expecting", "i am expecting", "trying to conceive", "cant conceive", "cant get pregnant", "cannot conceive", "cannot get pregnant", "cannot have a baby", "cannot have children", "conceive", "miscarriage", "infertility", "infertile", "barren", "childless", "want a baby", "want a child", "wanting a baby", "trying for a baby", "cant have a baby", "cant have children", "ivf", "conceiving", "grant me a child", "grant us a child", "bless us with a child", "have a child", "for a child", "for a baby", "never have kids", "have kids", "naturally"],
    weak: ["baby", "birth"],
    conflict: ["crying", "wont stop crying", "keeps crying"],
  },
  NewBorn: {
    strong: ["newborn", "new baby", "gave birth", "just born", "was born", "had a baby", "welcomed a baby", "aqiqah", "aqeeqah", "birth of my", "new arrival", "congratulations on the baby", "had her baby", "had their baby", "had our baby", "baby is here", "son is here", "daughter is here", "little one", "new mom", "new mum", "new dad", "new parents", "first see your baby", "after delivery", "named the baby", "name the baby", "naming the baby", "baby name"],
    weak: ["baby girl", "baby boy", "baby", "infant"],
    conflict: ["crying", "wont stop crying", "keeps crying"],
  },
  children: {
    strong: ["protect my children", "protect my kids", "protect my child", "protect my son", "protect my daughter", "protection for my children", "keep my children safe", "keep my kids safe", "my kids safe"],
    weak: ["my kids", "my children", "my child", "my son", "my daughter", "kids", "children", "for my kids", "for the kids", "the kids", "kids are"],
  },
  family: {
    strong: ["righteous offspring", "righteous children", "righteous kids", "righteous child", "good offspring", "children ~ pious", "kids ~ pious", "child ~ pious", "children ~ righteous", "kids ~ righteous", "child ~ righteous", "raise my children well", "raise my kids well", "raise righteous", "family unity", "family united", "keep my family", "my family together", "happy home", "happy family", "bless my family", "for my siblings", "eldest", "dua for family", "khandan", "family life", "raise a family", "righteous family", "grant our family"],
    weak: ["family", "offspring", "spouse", "for my family", "my family", "our family"],
  },
  marriage: {
    strong: ["nikah", "get married", "getting married", "want to marry", "looking for a husband", "looking for a wife", "righteous husband", "righteous wife", "righteous spouse", "good husband", "good wife", "pious spouse", "future spouse", "future husband", "future wife", "wedding", "engagement", "marriage", "marry", "married life", "walima", "find a spouse", "find a husband", "find a wife", "nikkah", "the couple", "my spouse", "rishta", "rishtas", "proposal", "newlyweds", "good match", "good spouse", "single", "be married", "right person"],
    weak: ["spouse", "husband", "wife", "partner"],
  },
  divorce: {
    strong: ["divorce", "divorced", "divorcing", "talaq", "khula", "separation", "separated", "ending my marriage", "end my marriage", "marriage problems", "marital problems", "problems in my marriage", "troubled marriage", "unhappy marriage", "toxic marriage", "marriage is falling apart", "my husband left", "my wife left"],
    weak: ["husband", "wife", "keep fighting", "keep arguing", "always fighting", "always arguing", "arguing", "left me"],
  },
  family_conflict: {
    strong: ["family conflict", "family problems", "family drama", "family feud", "family issues", "family fight", "falling out with", "estranged", "havent spoken", "not speaking to", "stopped talking to", "cut me off", "fight ~ brother", "fight ~ sister", "fight ~ cousin", "fight ~ in laws", "argue ~ brother", "argue ~ sister", "argued ~ brother", "argued ~ sister", "mother in law", "father in law", "in laws", "sister in law", "brother in law", "in law", "mil", "drama", "resentment", "cant stand each other", "everyone is fighting", "undermining", "forgive my mum", "forgive my mom", "sibling rivalry", "rivalry", "same table"],
    weak: ["brother", "sister", "cousin", "relatives", "siblings", "keep fighting"],
    conflict: ["inheritance"],
  },
  inheritance: {
    strong: ["inheritance", "inherit", "inherited", "heir", "heirs", "will and testament", "mirath", "wasiyyah", "dividing the property", "family property", "estate", "the will", "share of", "his share", "her share", "my share", "our share", "dads share", "left us", "left a shop", "fair division", "division", "executor", "claim it"],
    weak: ["share"],
  },
  debt: {
    strong: ["debt", "debts", "in debt", "loan", "loans", "owe", "cant pay", "cant afford", "mortgage", "credit card", "bankrupt", "bankruptcy", "creditors", "borrowed money", "behind on rent", "the bills", "utility bills", "bills piling", "behind on", "overdue", "debt collectors", "collectors", "repossess", "repossessed", "if i dont pay"],
    weak: ["bills", "rent", "owe money", "pay back", "repay", "repaying"],
  },
  provision: {
    strong: ["rizq", "rizk", "provision", "sustenance", "financial hardship", "financial struggles", "money is tight", "money problems", "i am broke", "flat broke", "so broke", "poverty", "need money", "barakah in my income", "barakah in my wealth", "halal income", "halal rizq", "lawful income", "financially struggling", "struggling financially", "financially", "abundance", "wealth", "income", "salary", "money", "rich", "wealthy", "cash", "richer", "fast car", "new car", "nice car", "dream car", "want a car", "buy a car", "no food", "beg", "living off", "in my account", "dollars", "open a door for us"],
    weak: ["financial", "finances", "poor"],
    conflict: ["sadaqah", "sadaqa", "charity", "give ~ money", "giving ~ money", "gave ~ money", "money i give"],
  },
  job: {
    strong: ["unemployed", "unemployment", "lost my job", "laid off", "layoff", "fired", "job search", "looking for a job", "looking for work", "need a job", "find a job", "finding a job", "get a job", "new job", "employment", "hiring", "job offer", "work opportunity", "resume", "applying to jobs", "applying for jobs", "job applications", "job market", "my position", "my role", "pushed out", "lost the job", "cant find work", "find work", "good job", "restructuring", "redundancy", "redundant", "being let go", "letting people go", "jobless", "got let go", "let go today", "callbacks", "cvs", "nothing lined up", "door for work", "contract isnt"],
    weak: ["job", "career", "work", "jobs"],
  },
  job_interview: {
    strong: ["interview", "interviews", "job interview", "interviewing", "for the role", "recruiter", "tell me about yourself", "phone screen interview", "phone screening"],
  },
  business: {
    strong: ["business", "entrepreneur", "startup", "start up", "my company", "open a shop", "opening a shop", "starting a business", "opening a business", "venture", "invest", "investing", "investment", "trading", "profit", "customers", "clients", "sales", "my restaurant", "a restaurant", "my brand", "launch", "launching", "small business", "side hustle", "my store", "my own shop", "self employed", "freelance", "freelancing", "sign ~ contract", "big contract"],
    weak: ["trade", "shop", "company", "owner", "brand", "deal"],
  },
  market: {
    strong: ["market", "marketplace", "bazaar", "mall", "shopping", "go shopping", "grocery", "groceries", "supermarket", "souk", "butcher", "buy stuff", "the shops", "enter a shop", "costco", "overspend"],
    weak: ["store", "shop", "buying"],
    conflict: ["stock market", "job market", "market research"],
  },
  anxiety: {
    ...MOOD,
    strong: ["anxious", "anxiety", "stressed", "stress", "panic attack", "panic", "panicking", "overthinking", "overthink", "overwhelmed", "overwhelming", "on edge", "worried sick", "cant stop thinking", "racing thoughts", "pressure", "hasbiyallah", "mind racing", "mind is racing", "racing mind", "closing in", "mind is so loud", "spiraling", "spiralling", "looping", "freaks out", "freak out", "freaking out", "something bad is", "cant relax", "replaying", "switch off", "worst case", "chest feels tight", "tight chest", "heart is racing", "heart racing", "wont shut off"],
    weak: ["nervous", "nervousness", "tense", "mind wont stop"],
  },
  worry: {
    ...MOOD,
    strong: ["worried", "worry", "worrying", "so worried", "grief", "sadness", "distress", "troubled", "sorrow", "grieving", "distressed", "no control", "out of my control", "cant function"],
  },
  fear: {
    ...MOOD,
    strong: ["afraid", "scared", "terrified", "terror", "frightened", "phobia", "fear of", "scared of", "afraid of", "fearful", "dread", "fear", "unsafe", "jumpy", "spooked", "creeped out", "public speaking", "speak in front of"],
    conflict: ["scared of my husband", "afraid of my husband", "scared to death", "worried to death"],
  },
  depression: {
    ...MOOD,
    strong: ["depressed", "depression", "hopeless", "despair", "no hope", "no point", "nothing matters", "nothing will ever get better", "feel empty", "numb", "cant stop crying", "feel down", "sad all the time", "mental health", "heartbroken", "broken heart", "heart ~ broken", "heart broke", "feel hopeless", "worthless", "dark place", "no joy", "feel joy", "feel nothing", "going through the motions", "so sad", "grey", "lost interest", "heavy heart", "low mood", "feeling low", "feel low", "broke up", "lost myself", "pointless", "no energy", "hopelessness", "nothing will get better"],
    weak: ["sad", "crying", "tears", "empty", "unhappy"],
  },
  loneliness: {
    ...MOOD,
    strong: ["lonely", "loneliness", "feel ~ alone", "feeling alone", "isolated", "isolation", "no friends", "have no one", "nobody cares", "nobody understands", "no one understands", "no one to talk to", "nobody to talk to", "left out", "wahshah", "make friends", "a single friend", "no one to call", "nobody to call", "forgotten", "connections", "feeling ~ alone", "so alone", "all alone", "an outsider", "dont have anyone", "so cut off", "by myself", "moved away"],
    weak: ["alone", "no one"],
    conflict: ["leave me alone", "alone time", "home alone"],
  },
  longing: {
    strong: ["i miss", "missing my", "miss my", "homesick", "longing for", "longing", "yearn", "reunite", "reunion", "far from my family", "far from home", "miss them", "miss him", "miss her", "missing you", "reuniting", "homesickness", "yearning", "longs", "long for", "go back home", "going back home", "be back home", "see ~ again", "far away", "aches for", "heart aches", "holy land", "be together", "go back to"],
    conflict: ["miss my flight", "miss my bus", "miss my train", "miss my exam", "miss my appointment", "miss my deadline", "miss my class", "miss my prayer", "miss my meeting"],
  },
  anger: {
    ...MOOD,
    strong: ["angry", "anger", "furious", "rage", "enraged", "temper", "lose my temper", "losing my temper", "so mad", "mad at", "pissed", "livid", "irritated", "annoyed", "control my anger", "fuming", "ghussa", "irritation", "bad mood", "lose it", "short tempered", "short fuse", "get heated", "so heated", "snap at", "punch the wall", "punch", "flip out", "flipping out", "boiling inside", "boiling", "disrespected"],
    weak: ["mad", "annoying", "frustrated", "frustration", "snapped"],
  },
  jealousy: {
    strong: ["jealous", "jealousy", "envy", "envious", "hasad", "hasid", "evil eye", "nazar", "nazr", "envying", "bad eye", "gave me the evil eye", "someone envies", "envies me"],
    conflict: ["i am jealous", "i feel jealous", "i get jealous", "i am envious", "i envy", "i feel envious"],
  },
  difficulty: {
    ...MOOD,
    strong: ["difficult", "difficulty", "hardship", "hard time", "going through a hard", "tough time", "struggling", "struggle", "everything is hard", "life is hard", "so hard right now", "things are hard", "hard times", "tribulation", "make it easy", "ease my", "burden", "doors ~ closing", "door ~ closing", "rough year", "rough time", "rough patch", "too much to handle", "too heavy", "so heavy", "need ease", "for ease", "things to ease", "ease up", "nothing opens", "nothing is working", "nothing works", "affairs easy", "drowning", "everything is falling apart", "relief", "on my shoulders", "nothing is going right", "exhausted", "make things easy"],
  },
  patience: {
    ...MOOD,
    strong: ["patience", "patient", "sabr", "give me patience", "need patience", "endure", "endurance", "be patient", "hold on", "keep going", "trials", "trial", "stay calm", "pile up", "piling up", "impatient"],
  },
  steadfastness: {
    strong: ["steadfast", "steadfastness", "stay firm", "firm on my deen", "firm on my religion", "keep my faith", "hold on to my faith", "faith is weak", "iman is low", "imaan", "deen", "stay consistent", "consistency", "istiqamah", "istiqama", "turner of hearts", "lose my faith", "firm on", "weak iman", "iman", "eman", "faith ~ fading", "faith ~ shaky", "faith ~ weak", "drifting", "slipping", "slacking", "stay strong", "keep failing", "consistent", "drop it after", "wavering", "steady on"],
  },
  guidance: {
    s: 8,
    cap: 9,
    strong: ["guidance", "guide me", "guide us", "hidayah", "hidaya", "hidayat", "right path", "straight path", "show me the way", "lost my way", "lost in life", "direction in life", "need direction", "need clarity", "which way", "where to go", "where my life is going", "where to start", "a sign", "guide my", "guide", "pointed back", "who i am", "better muslim", "off the path", "my purpose", "purpose", "no clue what i want", "why am i here", "no direction"],
    weak: ["clarity", "direction"],
  },
  confusion: {
    strong: ["helpless", "helplessness", "powerless", "lazy", "laziness", "procrastinate", "procrastinating", "procrastination", "unmotivated", "no motivation", "coward", "cowardly", "cowardice", "dont want to do anything", "cant get myself to", "cant make myself", "wont move", "no energy to", "wasting my days", "instead of doing my work", "so confused", "useless", "willpower", "chicken out", "aimless"],
    weak: ["confused", "confusion", "unsure"],
  },
  decision: {
    s: 14,
    strong: ["istikhara", "istikharah", "make a decision", "making a decision", "decide", "deciding", "cant decide", "choose between", "torn between", "undecided", "which one to choose", "salat al istikhara", "pick between", "right choice", "torn about", "torn", "whether to", "or stay", "have to choose", "which path", "is it right", "if its right", "the right one", "which to pick", "which one", "two offers", "job offers", "pros and cons", "one option", "or the one", "or move on", "or staying", "choosing between"],
    weak: ["decision", "choice", "choose", "should i"],
  },
  major_decision: {
    strong: ["life changing", "major decision", "big decision", "big choice", "huge decision", "important decision", "move abroad", "what to do with my life", "career change", "change careers", "quit my job", "move to another country", "immigrate", "emigrate", "crossroads", "at a crossroads", "uproot", "uprooting", "across the world", "big change", "retire", "retiring", "life change", "whole life", "life decision", "life decisions", "entire life", "whole path", "moving across", "home country", "big city", "switching careers", "emigrating", "leave the country", "yes or no"],
  },
  consultation: {
    strong: ["seek advice", "seeking advice", "need advice", "ask for advice", "consult", "consulting", "consultation", "counsel", "seek counsel", "shura", "second opinion", "asking opinion", "counselor", "counsellor", "therapist", "sought advice", "for advice", "different advice", "conflicting advice", "wise advice", "good advice", "perspective", "talking to people", "who to listen to"],
    weak: ["advice", "opinion"],
  },
  hope: {
    ...MOOD,
    strong: ["need ~ hope", "lost hope", "losing hope", "hopeful", "optimistic", "optimism", "expect good", "think good of allah", "husn al dhann", "positive thinking", "ease after hardship", "giving up", "give up", "no way out", "way out", "hold on to", "nothing good", "stay positive", "losing faith", "losing trust", "door is closed", "not being answered", "not answered", "tired of waiting", "good planned", "light at the end", "defeated", "hope"],
  },
  peace: {
    ...MOOD,
    strong: ["peace of mind", "inner peace", "peace", "peaceful", "tranquility", "tranquillity", "serenity", "sakinah", "mental peace", "peace in my heart", "peaceful mind", "stillness", "calm inside", "calm heart", "feel calm", "tranquil", "inner calm", "my soul", "calmer", "at ease", "mind is restless", "restless mind", "settle down", "serene", "calm and quiet", "quiet heart"],
    weak: ["calm", "calm down", "relax", "calmness"],
    conflict: ["peace be upon"],
  },
  gratitude: {
    ...MOOD,
    strong: ["thankful", "grateful", "gratitude", "thank allah", "thanks to allah", "alhamdulillah", "hamdulillah", "shukr", "blessed", "blessings", "count my blessings", "more than i asked", "more than you asked", "allah has given me"],
    weak: ["thanks", "thank", "appreciate"],
  },
  gift: {
    strong: ["gift", "gifts", "jazakallah", "jazakallahu khayran", "did me a favor", "helped me", "received a gift", "got a gift", "gave me a gift", "birthday present", "hadiyah", "hadiya", "favour", "big favor", "huge favor", "thank them", "thank him", "thank her", "jazakumullah", "jazakallah khair", "jazakallahu khair", "parcel", "paid for my", "gave us"],
    weak: ["present", "favor"],
  },
  praise: {
    strong: ["compliment", "complimented", "praised", "praising me", "praise me", "complimenting", "compliments", "people praise", "admired", "admiration", "flattered", "flattery", "they praise me", "told me i am", "nice things about me", "how good i look", "so smart", "people praise me", "said nice things", "shoutout", "talented", "bragging about me", "how well im doing", "called me the best", "the best student"],
  },
  seeing_disabled: {
    strong: ["wheelchair", "disabled", "disability", "handicapped", "amputee", "paralyzed", "blind man", "blind person", "deaf", "someone afflicted", "saw someone suffering", "autism", "autistic", "coma", "special needs", "people suffering", "are suffering", "suffering so much", "refugees", "starving", "burns on", "down syndrome", "cerebral palsy", "is blind", "blind and"],
  },
  protection: {
    strong: ["protect me", "protect us", "protection", "refuge", "seek refuge", "shaytan", "shaitan", "satan", "devil", "jinn", "jinns", "jin", "djinn", "waswasa", "waswas", "whispers", "intrusive thoughts", "safe from harm", "keep me safe", "keep us safe", "safeguard", "black magic", "sihr", "possessed", "haunted", "magic", "something evil", "evil in my house"],
    weak: ["protect", "harm", "safe", "danger", "evil"],
  },
  enemy: {
    strong: ["enemy", "enemies", "plotting against me", "conspiring against me", "scheming against me", "out to get me", "hate me", "hates me", "hating me", "hated me", "bully", "bullies", "bullying", "bullied", "hostile", "persecution", "tyrant", "at war", "plotting", "harm me", "bring me down", "take me down", "want me to fail", "sabotage", "sabotaging", "planning ~ against me", "working against me", "turned against me", "see me fail", "picking on me", "wicked people", "want me gone"],
    weak: ["war"],
  },
  oppression: {
    strong: ["oppressed", "oppression", "oppressing", "oppressor", "zulm", "zulum", "dhulm", "wronged", "treated unjustly", "tyranny", "in power", "with power", "authority", "abusing their", "abuse of power", "crushing me", "mistreated", "mistreating", "wronging", "cracking down", "crackdown", "persecuted", "underpaying", "exploited", "exploiting", "taking my land", "treats me like", "pushed out of", "squeezed", "militia", "forced us out", "crushed", "targeted", "regime"],
  },
  injustice: {
    strong: ["unfair", "unfairly", "injustice", "unjust", "discrimination", "discriminated", "racism", "racist", "no justice", "framed", "falsely accused", "false accusation", "wrongfully", "wrongly accused", "wrongful", "singled out", "treated worse", "treated like", "treating me like", "treating us like", "blamed", "take credit", "took credit", "humiliated", "didnt do", "did nothing wrong", "cheated out of", "justice", "smeared", "false info", "spreading lies", "lies about me", "wrongly", "kicked me out"],
  },
  legal: {
    strong: ["court", "lawsuit", "sued", "lawyer", "attorney", "judge", "trial", "legal", "legal case", "custody", "police", "arrested", "prison", "jail", "verdict", "charged with", "case against me", "false charges", "tribunal", "litigation", "sentenced", "bail", "court hearing", "custody hearing", "legal hearing", "appeal", "courthouse", "name cleared", "clear my name", "solicitor", "immigration case", "deportation", "deported", "a hearing", "the hearing", "my hearing", "appeal hearing", "immigration officer", "my papers", "questioning"],
    weak: ["sue", "my case"],
  },
  forgiveness: {
    strong: ["forgive me", "forgiveness", "ask ~ forgiveness", "seek forgiveness", "istighfar", "astaghfirullah", "maghfirah", "ask for forgiveness", "forgive my sins", "my sins", "sins", "sinned", "sinful", "guilty", "guilt", "ghfir", "ighfir", "ighfirli", "falling again", "slate clean", "shortcomings", "disappointing you"],
    weak: ["mistakes", "regret", "sin", "forgive"],
  },
  repentance: {
    strong: ["tawbah", "tawba", "taubah", "toba", "tauba", "repent", "repentance", "repenting", "committed zina", "committed a major sin", "major sin", "big sin", "fornication", "adultery", "did something haram", "committed a sin", "returning to allah", "return to allah", "come back to you", "came back to allah", "turning back", "turn back to", "far from allah", "far from him", "commit a sin", "after a sin", "after sinning", "haram life", "want me back"],
    weak: ["zina", "haram"],
  },
  forgiveness_from_people: {
    strong: ["apologize", "apologise", "apology", "apologizing", "make amends", "reconcile", "reconciliation", "i hurt my friend", "hurt someone", "hurtful", "wronged someone", "i wronged", "ask for their forgiveness", "wont forgive me", "forgiveness from my", "owe an apology", "say sorry", "hurt my", "reconciling", "make up with", "to make up", "said terrible things", "said hurtful things", "let it go", "forgive them", "forgive him", "forgive her", "broke a promise", "make things right", "ghosted", "people who hurt me"],
    weak: ["sorry"],
  },
  temptation: {
    strong: ["temptation", "tempted", "urge", "urges", "lust", "desire", "craving", "cant resist", "resist temptation", "lower my gaze", "lowering my gaze", "cant control my eyes", "cant control my gaze", "evil of my sight", "looking at things i shouldnt", "sinful thoughts", "evil thoughts", "crush", "pull of haram", "something haram", "haram stuff", "things i shouldnt", "the thing i shouldnt", "stuff i shouldnt", "keep me away from", "distract me from", "lusting", "haram scenes", "my nafs", "nafs", "stuff ~ shouldnt"],
    weak: ["my eyes", "my gaze"],
    conflict: ["did something haram"],
  },
  chastity: {
    strong: ["chastity", "chaste", "stay pure", "purity", "falling into zina", "haram relationship", "haram relationships", "stay away from haram", "avoid zina", "stay away from zina", "modesty", "modest", "save myself for", "cross the line", "virginity", "keep myself pure", "pure ~ inside", "stay clean", "sexual sin", "attracted to", "iffah", "iffa", "honour clean", "alone with someone"],
    weak: ["zina", "haya"],
  },
  addiction: {
    strong: ["addicted", "addiction", "addict", "cant quit", "porn", "pornography", "gambling", "gamble", "alcohol", "drinking problem", "drugs", "smoking", "vape", "vaping", "cocaine", "substance", "relapse", "relapsed", "bad habit", "bad habits", "quit smoking", "hooked", "dependent on", "break ~ habit", "cigarettes", "gaming addiction", "games all night", "betting", "sports betting", "the bottle", "shisha", "hookah", "this cycle"],
    weak: ["cant stop", "quit", "weed", "habit", "smoke"],
  },
  backbiting: {
    strong: ["backbiting", "backbite", "backbitten", "gossip", "gossiping", "ghibah", "gheebah", "ghiba", "slander", "slandering", "talking behind", "talk behind my back", "talks behind", "speaking ill of", "rumor", "rumour", "rumors", "behind my back", "behind their back", "behind his back", "behind her back", "badmouth", "bad mouth", "running my mouth", "making fun of people", "talk about people", "talking about people", "judging people", "talking shit about", "talking trash about", "something mean about", "peoples honour", "their honour"],
  },
  humility: {
    strong: ["humble", "humility", "arrogance", "arrogant", "kibr", "takabbur", "vanity", "conceited", "too proud", "feel superior", "full of myself", "big headed", "boasting", "boast", "down to earth", "looking down on", "look down on", "better than everyone", "better than others", "more than everyone", "superior", "too good for", "better than other people", "smug", "correct everyone", "ego is out of control", "ego"],
    weak: ["proud", "pride"],
  },
  sincerity: {
    strong: ["sincere", "sincerity", "ikhlas", "ikhlaas", "riya", "riyaa", "showing off", "show off", "intention", "intentions", "purify my intention", "seeking praise", "for show", "shirk", "pure intention", "niyyah", "niyyat", "niat", "for allah alone", "for allah only", "for the sake of allah", "followers", "for likes", "for attention", "post my good deeds", "nobody gets to see", "want credit", "think im religious", "seen by people"],
  },
  charity: {
    strong: ["sadaqah", "sadaqa", "sadaqat", "charity", "donate", "donation", "donating", "zakat", "zakah", "give to the poor", "feed the poor", "giving to charity", "generosity", "generous", "waqf", "infaq", "orphan", "orphans", "sponsor"],
  },
  heart: {
    strong: ["heart ~ hard", "hard ~ heart", "hardened heart", "soften my heart", "soften hearts", "cant cry", "cannot cry", "no khushu", "khushu", "khushoo", "kindness", "compassion", "mercy in my heart", "qalb", "heartless", "cold heart", "soft heart", "rust", "heart ~ dunya", "turn my heart", "heart ~ wandering", "heart ~ doesnt respond", "dead heart", "cry for allah", "cry ~ for allah", "harder than a stone", "dry inside", "living heart", "heart warm", "heart ~ cold", "cold inside", "sensitive to the reminder", "heart ~ locked", "hard inside", "make it alive"],
    weak: ["my heart"],
  },
  remembrance: {
    strong: ["dhikr", "zikr", "remembrance of allah", "remember allah", "remembering allah", "make more dhikr", "subhanallah", "subhan allah", "allahu akbar", "la hawla", "say something to allah", "something good to allah"],
    weak: ["tasbih", "tasbeeh", "mindful", "mindfulness"],
  },
  quran: {
    strong: ["quran", "koran", "recite surah", "reciting surah", "recite ayat", "recite quran", "memorize quran", "hifz", "hifdh", "tajweed", "surah", "ayah", "ayat", "mushaf", "read quran", "finish the quran", "khatm", "surahs", "juz", "juz amma", "sipara", "hafiz", "hafidh", "khatam"],
    weak: ["recite", "recitation", "reciting"],
  },
  knowledge: {
    strong: ["knowledge", "gain knowledge", "seek knowledge", "seeking knowledge", "ilm", "increase my knowledge", "islamic studies", "tafsir", "lectures", "absorb", "absorbing", "nothing sticks", "grasp", "forget ~ learn", "retain", "open my understanding", "trying to learn", "want to learn", "understanding nothing", "memorize hadith", "my memory", "learn arabic", "hadith"],
    weak: ["learn", "learning", "student", "understand", "understanding", "wisdom", "education", "homework", "assignment", "thesis", "research", "study", "studying"],
  },
  success: {
    strong: ["success", "succeed", "successful", "do well in", "achieve my goals", "achieve", "achievement", "victory", "goals", "excel", "excellence", "prosper", "prosperity", "good in this world and the hereafter", "hasanah", "rabbana atina", "hard work", "efforts", "pay off", "make something of", "targets", "do well", "failure", "make my family proud", "take off", "getting ahead", "level up", "need a win", "turnaround", "doesnt work out", "aiming for"],
    weak: ["goal", "win"],
  },
  paradise: {
    strong: ["paradise", "jannah", "jannat", "firdaus", "enter jannah", "heaven", "afterlife", "hereafter", "akhirah", "akhira", "day of judgment", "day of judgement", "hellfire", "fire of hell", "punishment of hell", "save me from hell", "good ending", "husnul khatimah", "good end", "qiyamah", "last words", "la ilaha illallah", "die with iman", "die as a muslim", "die upon", "good death", "peaceful death", "die in a good state", "bad state", "torment of hell", "saved from the fire"],
    conflict: ["what the hell", "hell of a"],
  },
  mosque: {
    strong: ["entering the mosque", "entering the masjid", "enter the mosque", "enter the masjid", "leaving the mosque", "leaving the masjid", "leave the mosque", "leave the masjid", "going to the mosque", "going to the masjid", "go to the mosque", "go to the masjid", "heading to the masjid", "heading to the mosque", "walking to the mosque", "walking to the masjid", "at the mosque", "at the masjid", "mosque dua", "masjid dua", "dua for the mosque", "dua for the masjid", "masjed", "into the masjid", "into the mosque", "local masjid", "pass by a masjid", "a masjid"],
    weak: ["mosque", "masjid", "mosques", "jamaah", "in masjid", "the masjid", "the mosque"],
  },
  adhan: {
    strong: ["adhan", "azan", "athan", "adzan", "call to prayer", "prayer call", "muadhdhin", "muezzin", "hayya", "iqamah", "iqama"],
  },
  after_prayer: {
    strong: ["after prayer", "after salah", "after salat", "after namaz", "after praying", "finished praying", "done praying", "post prayer", "post salah", "after fard", "after the prayer", "after ~ salah", "after ~ prayers", "finish praying", "finish salah", "finished salah", "finishing salah", "finish ~ prayer", "finished ~ prayer", "adhkar after", "tasbih after", "tasbeeh count", "ends the prayer", "before i get up", "after my namaz", "after salam", "after the salam", "after salaam", "end my prayer", "ending my prayer", "my fard"],
    weak: ["tasbih", "tasbeeh"],
  },
  witr: {
    strong: ["witr", "tahajjud", "qiyam", "qiyam al layl", "night prayer", "qunoot", "qunut", "pray at night", "last third of the night", "late night prayer"],
  },
  "laylatul qadr": {
    strong: ["laylatul qadr", "lailatul qadr", "laylat al qadr", "laylatulqadr", "laylatul kadr", "lailat ul qadr", "layla tul qadr", "shab e qadr", "night of power", "night of decree", "night of qadr", "last ten nights", "last 10 nights", "odd nights", "27th night", "21st", "23rd", "25th", "29th", "last nights", "ramadan ending", "end of ramadan", "27th"],
    weak: ["ramadan", "qadr"],
  },
  Friday: {
    strong: ["friday", "jummah", "jumah", "jumuah", "jumua", "juma", "salawat", "durood", "send blessings upon the prophet", "salat on the prophet"],
    conflict: ["black friday"],
  },
  breaking_fast: {
    strong: ["iftar", "break my fast", "break the fast", "breaking my fast", "breaking fast", "break fast", "about to break", "fast opening", "broke my fast", "buka puasa", "end my fast", "ending my fast", "finish fasting", "finished fasting", "done fasting", "fasting all day", "open my fast", "opening my fast", "open the fast", "iftaar", "iftari", "after fasting", "roza", "break your fast", "open your fast"],
    weak: ["fasting", "fast", "ramadan", "dates", "puasa"],
    conflict: ["fast car", "fast cars", "fast food", "fast lane", "fast internet"],
  },
  eating: {
    strong: ["before eating", "after eating", "finished eating", "about to eat", "before i eat", "before dinner", "before lunch", "before breakfast", "after dinner", "after lunch", "after breakfast", "start my meal", "eating dua", "dua for food", "dua before meal", "dua after meal", "after my meal", "before my meal", "before the meal", "when eating", "when i eat", "while eating", "khana", "khane", "first meal", "before a meal", "after a meal", "finish dinner", "finish eating", "finish my food", "start eating", "about to have", "i ate", "you ate", "makan", "first bite", "this food", "bless the food", "started eating", "before we eat", "before we start", "forgot to say bismillah"],
    weak: ["food", "meal", "dinner", "lunch", "breakfast", "eating", "eat", "hungry"],
  },
  drinking_water: {
    strong: ["drinking water", "drink water", "drank water", "glass of water", "thirsty", "thirst", "after drinking", "parched", "paani", "pani", "drinking milk", "drinking tea", "drinking chai", "when you drink", "when i drink", "before drinking", "before i drink", "drinking from", "drink milk", "drink tea", "finished my water", "minum", "sip", "water bottle", "finish drinking"],
    weak: ["drink", "water", "drinking"],
  },
  bathroom: {
    strong: ["bathroom", "toilet", "restroom", "washroom", "wc", "lavatory", "relieve myself", "loo", "jamban", "tandas"],
  },
  mirror: {
    strong: ["mirror", "reflection", "looking at myself", "my appearance", "how i look", "feel ugly", "ugly", "insecure about my looks", "my looks", "cermin", "better looking", "dont like my body", "hate my body", "body image", "insecure about my", "the way i look", "my reflection", "comparing my face", "my face", "insecure", "look terrible", "appearance"],
  },
  new_clothes: {
    strong: ["new clothes", "new dress", "new outfit", "new shirt", "new shoes", "new thobe", "new abaya", "new hijab", "new jacket", "wearing new", "put on new", "wear something new", "baju baru", "baju", "new pants", "new trousers", "new jeans", "new kurta", "new sweater", "new coat", "new suit", "naye kapde", "kapde", "clothes are new", "new thing"],
  },
  sneezing: {
    strong: ["sneeze", "sneezed", "sneezes", "sneezing", "achoo", "bless you", "chheenk", "chheenk aaye", "bersin"],
  },
  sitting: {
    strong: ["bad company", "avoid bad company", "bad friends", "bad influence", "bad crowd", "good company", "righteous company", "good friends", "better friends", "right company", "circle of friends", "good circle", "good people", "teman", "friends who", "people who dont pray", "muslim friends", "righteous friends", "friend group", "toxic friends", "wrong crowd", "wrong friends", "people who waste time", "dost", "follow the crowd", "the crowd", "people i sit with", "righteous people", "toxic"],
    weak: ["sitting with", "sit with"],
  },
  meeting: {
    strong: ["meeting", "gathering", "assembly", "majlis", "end of a meeting", "end of the meeting", "after the meeting", "end of a gathering", "kaffarat al majlis", "study circle", "dars", "halaqah", "halaqa", "halqa", "zoom call", "call ends", "the lecture", "end of class", "session ends", "end of the session", "sohbet", "stand up from", "group of people", "long discussion", "discussion"],
  },
  morning: {
    strong: ["wake up", "waking up", "woke up", "when i wake", "dawn", "sunrise", "sun rises", "sun rise", "sun rising", "start my day", "start the day", "good morning", "morning adhkar", "morning dua", "morning supplication", "dua for the morning", "start of the day", "open my eyes", "subah", "subuh", "pagi", "woke up late", "first thing in the morning", "first words", "get up for fajr", "after getting up", "just got up", "morning azkar", "after waking", "get out of bed", "start this day", "this day right"],
    weak: ["morning", "fajr"],
    conflict: ["middle of the night", "at night", "nightmare", "cant sleep", "woke up scared", "for qiyam", "for tahajjud", "for prayer", "for fajr", "tahajjud", "qiyam", "woke up ~ scared", "woke up ~ afraid"],
  },
  night: {
    strong: ["dusk", "sunset", "after maghrib", "nightfall", "good evening", "evening adhkar", "evening dua", "dua for the evening", "for the evening", "when night falls", "sun sets", "sun is setting", "starts to set", "the sun set", "petang", "night is coming", "in the evening", "evening azkar", "asr passed", "after asr", "maghrib just", "sun goes down", "gets dark", "evening"],
    weak: ["night", "nighttime", "dark", "darkness", "maghrib"],
  },
  sleep: {
    strong: ["sleep", "sleeping", "asleep", "insomnia", "nightmare", "nightmares", "bedtime", "bad dream", "bad dreams", "before bed", "going to bed", "go to bed", "in bed", "lying down", "tossing and turning", "sleepless", "cant fall asleep", "woke up scared", "middle of the night", "wake up at night", "waking up at night", "while i sleep", "lying awake", "awake since", "woke up ~ scared", "woke up ~ afraid", "scary dream", "scary dreams", "disturbing dream", "close my eyes"],
    weak: ["dreams", "bed", "dream"],
  },
  travel: {
    strong: ["travel", "traveling", "travelling", "traveler", "journey", "trip", "flight", "flights", "airport", "going abroad", "road trip", "hajj", "umrah", "boarding", "safar", "back from my trip", "returned from my trip", "returning from", "safe return", "arrived safely", "landed", "touches down", "study abroad", "first flight", "flying for the first time"],
    weak: ["plane", "train", "bus", "flying"],
  },
  vehicle: {
    strong: ["getting into the car", "get into the car", "into the car", "in the car", "getting in the car", "get in my car", "get into my car", "start the car", "start my car", "riding", "on the bus", "taking the bus", "taking a taxi", "motorcycle", "uber", "taxi", "ride a", "engine", "turning the key", "van", "vehicles", "dua for car", "car dua", "behind the wheel", "before driving", "public transport", "the metro", "metro", "subway"],
    weak: ["car", "driving", "vehicle", "ride"],
    conflict: ["car crash", "car accident"],
  },
  entering_home: {
    strong: ["got back home", "got home", "get home", "getting home", "came home", "coming home", "arrived home", "arriving home", "reach home", "reached home", "entering home", "enter my house", "entering my house", "entering the house", "enter the house", "walk into my house", "walking into the house", "enter my home", "entering my home", "front door", "come home", "walk in the door", "through the door", "back from work", "home from work", "into my house", "into the house", "into my home", "open the door", "at the door", "into my mums house", "coming back home", "when i get back", "going back to the family home", "returning to my home", "come back in", "walking in", "finally home", "home after"],
  },
  leaving_home: {
    strong: ["leaving home", "leave my house", "leaving my house", "leaving the house", "leave the house", "step out", "stepping out", "going out", "heading out", "exiting the house", "about to leave", "when i leave", "leave for school", "leave for work", "leaving for work", "leaving my home", "out the door", "while im gone", "while i am out", "while im out", "when he leaves", "when she leaves", "leaves our home", "moved out"],
    weak: ["out of the house"],
  },
  moving_home: {
    strong: ["moving to a new", "moving house", "moving home", "new house", "new home", "new apartment", "relocate", "relocating", "relocation", "moved into", "housewarming", "buying a house", "buying a home", "the keys", "move in", "moving in", "new place", "find a house", "find a place", "our own home", "building our", "landlord", "notice to leave", "eviction", "evicted", "old place", "settle in", "house hunting", "moving into", "new flat", "someone else lived"],
    weak: ["moving", "move"],
    conflict: ["move abroad"],
  },
  rain: {
    strong: ["rain", "raining", "rainfall", "drizzle", "drought", "downpour", "pouring", "its pouring", "water is scarce", "no rain", "need rain", "water shortage", "hope it rains", "rains", "heat is unbearable"],
    weak: ["storm", "weather"],
  },
  thunder: {
    strong: ["thunder", "lightning", "thunderstorm", "sky is so loud", "thunderclap", "rumbling"],
  },
  wind: {
    strong: ["strong wind", "strong winds", "stormy wind", "windstorm", "wind storm", "gale", "hurricane", "tornado", "howling wind", "huge wind", "big wind", "very windy", "wind is shaking", "wind is blowing", "wind is howling", "high winds", "high wind", "wind blew", "winds are", "wind picks up", "wind ~ violent", "storm damage", "storm is coming", "storm coming", "storm is hitting", "roof is shaking", "sandstorm", "dust storm", "trees are falling", "windy", "gusts", "power lines", "knocked down", "sounds like a train", "tore the roof"],
    weak: ["wind", "winds"],
  },
  wudu: {
    strong: ["wudu", "wudhu", "ablution", "ablutions", "after wudu", "just made wudu", "finished wudu", "performing wudu", "wuzu", "wazu", "washing ~ before", "ghusl", "cleaning myself", "before salah"],
  },
  in_prayer: {
    strong: ["in sujood", "in sajda", "during sujood", "in ruku", "during ruku", "while bowing", "while prostrating", "prostration", "tashahhud", "tashahud", "opening dua", "opening supplication", "opening of the prayer", "opening of prayer", "start of the prayer", "istiftah", "dua during prayer", "dua in prayer", "what to say in prayer", "what to say during prayer", "what do i say in sujood", "what do i say in ruku", "between ~ sujood", "between ~ sajdah", "sujud", "sajdah", "sajda", "takbir", "fatiha", "from ruku", "during the prayer", "in salah", "during salah", "in my salah", "in namaz", "during namaz", "mind wanders", "middle of salah", "ruku dua", "subhana rabbi", "3rd rakat", "for the 3rd"],
    weak: ["sujood", "ruku", "rakah", "rakat"],
    conflict: ["after prayer", "after salah", "finished praying", "after praying"],
  },
  visiting_graves: {
    strong: ["graveyard", "cemetery", "visit the grave", "visiting the grave", "visit graves", "visiting graves", "visit his grave", "visit her grave", "at the grave", "baqi", "qabr", "qabristan", "kabristan", "the graves", "graves"],
    weak: ["grave"],
    conflict: ["grave mistake", "grave danger", "gravely"],
  },
  hosting: {
    strong: ["my guests", "guests are leaving", "guest is leaving", "thank my host", "thank the host", "thanking my host", "thanking the host", "hosting", "invited me for dinner", "invited to dinner", "invited for dinner", "dinner invitation", "thank you for the meal", "thanks for the meal", "thank you for dinner", "having guests", "having people over", "my host", "the host", "for the host", "hosts me", "who hosts", "fed me", "guests come", "guests arrive", "visits me", "visits you", "stayed at", "staying at", "for dinner", "tetamu", "mehmaan", "mehman", "hosted me", "hosted", "welcome", "cooked for me", "open house", "the home i was in", "guest at my house"],
    weak: ["guest", "guests", "host"],
    conflict: ["before eating", "before i eat", "before the meal"],
  },
  betrayal: {
    strong: ["cheated on me", "cheating on me", "betrayed", "betrayal", "betraying", "backstabbed", "stabbed me in the back", "unfaithful", "infidelity", "lied to me", "broke my trust", "broken trust", "trust broken", "deceived me", "double crossed", "is cheating", "cheating", "lied to", "lied about", "turned out to be fake", "two faced", "talking to someone else", "found the messages", "stole my idea", "took my idea", "sold my secrets", "told my secrets", "my trust", "trusted", "lying to me", "turned on me", "dont trust anyone", "partner cheated", "has been lying", "been lying"],
    weak: ["cheated", "affair"],
    conflict: ["exam", "test", "quiz", "homework", "game"],
  },
  new_beginning: {
    strong: ["new beginning", "new beginnings", "new chapter", "starting something new", "start something new", "new project", "starting my homework", "starting homework", "about to start", "arriving in", "just arrived in", "arrived in a new", "entering a new", "new city", "new town", "first day", "fresh start", "start over", "starting over", "start fresh", "starting fresh", "reset", "new me", "old me", "new course", "new neighborhood", "new neighbourhood", "new school", "new class", "new classroom", "new semester", "clean slate", "help me begin", "somewhere new", "new country", "new year", "apprenticeship"],
    weak: ["starting", "beginning"],
    conflict: ["job", "interview", "business", "house", "home", "apartment", "marriage", "wedding", "baby", "exam", "school year", "diet"],
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
  const covered = new Set<string>();
  for (const t of rule.strong) {
    const q = termQuality(tokens, t);
    score += q * rule.s;
    if (q > 0) t.forEach((w) => covered.add(w));
  }
  // A weak word already inside a matched strong phrase ("mosque" in "at the mosque") adds nothing.
  for (const t of rule.weak) if (!t.every((w) => covered.has(w))) score += termQuality(tokens, t) * WEAK;
  return Math.min(score, rule.cap);
}

// Specific sleep situations. Used only to choose among the sleep duas.
const SLEEP_PICKS: { id: number; terms: Term[] }[] = [
  { id: 116, terms: toTerms(["nightmare", "nightmares", "bad dream", "bad dreams", "scary dream", "woke up scared", "woke up afraid", "scared to sleep", "afraid to sleep", "sleep paralysis"]) },
  { id: 117, terms: toTerms(["middle of the night", "wake up at night", "waking up at night", "woke up at night", "woke up during the night", "wake up in the middle"]) },
  { id: 118, terms: toTerms(["cant sleep", "cant fall asleep", "insomnia", "sleepless", "restless", "tossing and turning", "tossing", "mind wont stop", "racing thoughts", "wide awake", "lying awake", "awake since"]) },
  { id: 119, terms: toTerms(["lie down", "lying down", "going to bed", "go to bed", "before bed", "bedtime", "about to sleep", "going to sleep", "before i sleep", "before sleeping"]) },
  ...[156, 157, 158].map((id) => ({ id, terms: toTerms(["three quls", "3 quls", "the quls", "the three quls", "surah ikhlas", "surah falaq", "surah nas", "muawwidhat", "mu awwidhat", "ikhlas falaq nas"]) })),
  { id: 120, terms: toTerms(["while i sleep", "protect me while", "ayat al kursi", "ayatul kursi", "kursi", "safe tonight", "protected through the night", "jinn"]) },
];

function pickSleepIds(tokens: string[]): number[] | undefined {
  const hits = SLEEP_PICKS.map((p) => ({ id: p.id, n: p.terms.filter((t) => termQuality(tokens, t) > 0).length }));
  const top = Math.max(...hits.map((h) => h.n));
  return top > 0 ? hits.filter((h) => h.n === top).map((h) => h.id) : undefined;
}

// A one or two word request such as "money" or "my mom" can only reach one weak term, which is
// below MIN_SCORE, so for these the best weak score is still taken as a match.
const SHORT_QUERY_TOKENS = 2;
function short(tokens: string[]): DuaMatch {
  if (tokens.filter((t) => t !== BREAK).length > SHORT_QUERY_TOKENS) return { kind: "none" };
  const any = COMPILED.map((rule) => ({ category: rule.category, score: scoreRule(tokens, rule) }))
    .filter((r) => r.score >= WEAK)
    .sort((a, b) => b.score - a.score);
  if (any.length === 0) return { kind: "none" };
  const tied = any.filter((r) => any[0].score - r.score < 0.01);
  return { kind: "match", categories: tied.map((r) => r.category) };
}

// A clause break becomes a token no term contains, so "accident this morning, dua for"
// cannot read as "morning dua". A "~" gap can still cross it.
const BREAK = "_";
export function tokenize(input: string): string[] {
  return normalizeInput(input.replace(/[,.;!?]+/g, " xbreakx ")).split(" ").filter(Boolean).map((t) => (t === "xbreakx" ? BREAK : t));
}

// shortcut: negation ("not worried", "no longer afraid") is not handled and still scores as the feeling; upgrade to a short negation window before the term if wrong matches show up.
/** Crisis check and keyword rules only. matchDua adds the classifier fallback. */
export function matchKeywords(input: string): DuaMatch {
  const crisisId = detectCrisis(input);
  if (crisisId !== null) return { kind: "crisis", duaId: crisisId };

  const tokens = tokenize(input);
  if (tokens.length === 0) return { kind: "none" };

  const scored = COMPILED.map((rule) => ({ category: rule.category, score: scoreRule(tokens, rule) }))
    .filter((r) => r.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return short(tokens);

  const best = scored[0].score;
  // A tie, even across topics, returns every tied category and the caller picks one at random:
  // one of the tied topics is right far more often than the general dua is useful.
  const categories = scored.filter((r) => best - r.score < 0.01).map((r) => r.category);
  const strong = best >= STRONG;
  return categories.length === 1 && categories[0] === "sleep"
    ? { kind: "match", categories, duaIds: pickSleepIds(tokens), strong }
    : { kind: "match", categories, strong };
}

/** Categories a rule's conflict list rules out for this request. */
export function vetoedCategories(tokens: string[]): Set<string> {
  return new Set(COMPILED.filter((r) => r.conflict.some((t) => termQuality(tokens, t) === 1)).map((r) => r.category));
}

// The classifier leads: it answers what the rules leave unplaced, breaks ties, keeps a rule match
// only when it finds the category plausible, and overrules a rule match when it is clearly surer.
// It never picks a category a rule explicitly excludes.
export function matchDua(input: string): DuaMatch {
  const keywords = matchKeywords(input);
  if (keywords.kind === "crisis") return keywords;
  const tokens = tokenize(input);
  const matched = keywords.kind === "match" ? keywords : null;
  const categories = decide(bundledModel(), tokens, matched?.categories ?? [], matched?.strong ?? false, vetoedCategories(tokens));
  if (!categories) return { kind: "none" };
  return categories.length === 1 && categories[0] === "sleep"
    ? { kind: "match", categories, duaIds: pickSleepIds(tokens) }
    : { kind: "match", categories };
}
