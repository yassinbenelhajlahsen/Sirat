/**
 * Deterministic dua matching using regex patterns and keyword rules
 * AI is only used as a fallback when regex doesn't match
 */

export interface MatchRule {
  category: string;
  patterns: RegExp[];
}

/**
 * Input normalization
 * - Lowercase
 * - Trim
 * - Remove punctuation (except spaces)
 * - Collapse extra spaces
 */
export function normalizeInput(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .replace(/\s+/g, " "); // Collapse spaces
}

/**
 * Regex rules for category matching
 * Order matters: more specific patterns should come first
 */
export const MATCH_RULES: MatchRule[] = [
  // Exam/test-specific (before general knowledge)
  {
    category: "exam",
    patterns: [
      /\b(exam|test|quiz|final|midterm|studying for|before exam|taking test|test tomorrow)\b/i,
    ],
  },
  // Travel-specific
  {
    category: "travel",
    patterns: [
      /\b(travel|traveling|travelling|journey|trip|vacation|flight|airport|going away|leaving town|road trip)\b/i,
    ],
  },
  // Debt/financial burden
  {
    category: "debt",
    patterns: [
      /\b(debt|debts|loan|loans|owe|owing|borrow|borrowed|financial burden|cant pay|bills)\b/i,
    ],
  },
  // Job/career/employment
  {
    category: "job",
    patterns: [
      /\b(job|career|employment|unemployed|job search|looking for work|job interview|new job|work opportunity)\b/i,
    ],
  },
  // Marriage-specific
  {
    category: "marriage",
    patterns: [
      /\b(marriage|marry|married|getting married|wedding|finding spouse|righteous spouse|good husband|good wife)\b/i,
    ],
  },
  // Pregnancy/expecting
  {
    category: "pregnancy",
    patterns: [
      /\b(pregnan(t|cy)|expecting|baby|conceive|conceiving|cant have baby|fertility|barren)\b/i,
    ],
  },
  // Newborn/baby
  {
    category: "NewBorn",
    patterns: [
      /\b(newborn|new baby|just born|birth|gave birth|new child|infant)\b/i,
    ],
  },
  // Parents-specific
  {
    category: "parents",
    patterns: [
      /\b(parent|parents|mother|mom|father|dad|mama|baba|raised me|my mom|my dad)\b/i,
    ],
  },
  // Children-specific
  {
    category: "children",
    patterns: [
      /\b(my child|my children|my kids|my son|my daughter|for my kids|protect my children)\b/i,
    ],
  },
  // Deceased/death/funeral
  {
    category: "deceased",
    patterns: [
      /\b(deceased|dead|died|death|passed away|funeral|janazah|burial|grave|lost someone)\b/i,
    ],
  },
  // Anger management
  {
    category: "anger",
    patterns: [
      /\b(angry|anger|mad|furious|rage|raging|temper|control anger|losing temper|irritated)\b/i,
    ],
  },
  // Depression/sadness
  {
    category: "depression",
    patterns: [
      /\b(depress(ed|ion)|hopeless|despair|despairing|deep sadness|cant cope|giving up|no hope)\b/i,
    ],
  },
  // Loneliness/isolation
  {
    category: "loneliness",
    patterns: [
      /\b(lonely|loneliness|alone|isolated|isolation|no friends|by myself|solitude)\b/i,
    ],
  },
  // Fear (general)
  {
    category: "fear",
    patterns: [
      /\b(fear|afraid|terrified|terror|scared|scary|frightened|phobia)\b/i,
    ],
  },
  // Jealousy/envy/evil eye
  {
    category: "jealousy",
    patterns: [
      /\b(jealous|jealousy|envy|envious|hasad|evil eye|nazar|people envying)\b/i,
    ],
  },
  // Oppression/injustice
  {
    category: "oppression",
    patterns: [
      /\b(oppress(ed|ion)|injustice|wronged|unfair|unfairly treated|discriminat(ed|ion)|persecuted)\b/i,
    ],
  },
  // Difficulty/hardship
  {
    category: "difficulty",
    patterns: [
      /\b(difficult(y|ies)|hardship|hard time|challenge|challenges|tough time|going through)\b/i,
    ],
  },
  // Calamity/disaster/tragedy
  {
    category: "calamity",
    patterns: [
      /\b(calamity|disaster|catastrophe|tragedy|tragic|devastating|major loss)\b/i,
    ],
  },
  // Confusion/uncertainty
  {
    category: "confusion",
    patterns: [
      /\b(confused|confusion|uncertain|uncertainty|dont know what to do|not sure|unclear)\b/i,
    ],
  },
  // Major decision/istikhara
  {
    category: "decision",
    patterns: [
      /\b(decision|decide|deciding|choice|choosing|istikhara|istikharah|should i|which option)\b/i,
    ],
  },
  // Addiction/bad habits
  {
    category: "addiction",
    patterns: [
      /\b(addict(ed|ion)|habit|bad habit|cant stop|compulsion|obsess(ed|ion)|dependent)\b/i,
    ],
  },
  // Temptation/desire/sin
  {
    category: "temptation",
    patterns: [
      /\b(tempt(ed|ation)|desire|lust|lustful|urge|craving|resist|resisting sin)\b/i,
    ],
  },
  // Chastity/purity
  {
    category: "chastity",
    patterns: [
      /\b(chastity|chaste|purity|pure|modesty|modest|lower gaze|haya)\b/i,
    ],
  },
  // Steadfastness/firmness
  {
    category: "steadfastness",
    patterns: [
      /\b(steadfast|firm|firmness|consistency|consistent|persever(e|ance)|keep going)\b/i,
    ],
  },
  // Hope/optimism
  {
    category: "hope",
    patterns: [
      /\b(hope|hopeful|optimis(m|tic)|positive|positivity|expect good|good thoughts)\b/i,
    ],
  },
  // Humility/modesty
  {
    category: "humility",
    patterns: [
      /\b(humility|humble|modest|modesty|pride|arrogance|arrogant|ego|boastful)\b/i,
    ],
  },
  // Sincerity/intention
  {
    category: "sincerity",
    patterns: [
      /\b(sincerity|sincere|intention|ikhlas|purely for allah|showing off|riya)\b/i,
    ],
  },
  // Charity/giving
  {
    category: "charity",
    patterns: [
      /\b(charity|charitable|sadaqah|sadaqa|giving|donate|donation|generosity|generous)\b/i,
    ],
  },
  // Paradise/jannah/afterlife
  {
    category: "paradise",
    patterns: [
      /\b(paradise|jannah|heaven|afterlife|hereafter|akhirah|enter jannah|good end)\b/i,
    ],
  },
  // Enemy/opponent/conflict
  {
    category: "enemy",
    patterns: [
      /\b(enemy|enemies|opponent|adversary|conflict|fight|fighting|battle|war)\b/i,
    ],
  },
  // Backbiting/gossip
  {
    category: "backbiting",
    patterns: [
      /\b(backbit(ing|e)|gossip|gossiping|slander|slandering|talking behind|rumor)\b/i,
    ],
  },
  // Heart/softness
  {
    category: "heart",
    patterns: [
      /\b(heart|soften heart|hard heart|heartless|compassion|compassionate|mercy in heart)\b/i,
    ],
  },
  // Rain/weather
  {
    category: "rain",
    patterns: [/\b(rain|raining|drought|dry|water|weather|storm)\b/i],
  },
  // Thunder/lightning
  {
    category: "thunder",
    patterns: [/\b(thunder|lightning|thunderstorm)\b/i],
  },
  // Bathroom/toilet
  {
    category: "bathroom",
    patterns: [/\b(bathroom|toilet|restroom|washroom|wc)\b/i],
  },
  // Entering home
  {
    category: "entering_home",
    patterns: [
      /\b(entering home|coming home|arriving home|going inside|opening door)\b/i,
    ],
  },
  // Leaving home
  {
    category: "leaving_home",
    patterns: [
      /\b(leaving home|going out|stepping out|exiting|heading out)\b/i,
    ],
  },
  // Mosque/masjid
  {
    category: "mosque",
    patterns: [/\b(mosque|masjid|masjed|going to mosque|entering masjid)\b/i],
  },
  // Morning/waking up
  {
    category: "morning",
    patterns: [
      /\b(morning|wake|waking up|woke up|awakening|dawn|fajr time|start day)\b/i,
    ],
  },
  // Sleep-related queries (before night, more specific)
  {
    category: "sleep",
    patterns: [
      /\b(sleep|insomnia|rest|tired|bedtime|nightmare|dreams?|cant sleep|trouble sleeping|going to bed)\b/i,
    ],
  },
  // Night/evening (general nighttime, not sleep-related)
  {
    category: "night",
    patterns: [/\b(night|evening|maghrib|isha|nighttime|dark|darkness)\b/i],
  },
  // Eating/food/meal
  {
    category: "eating",
    patterns: [
      /\b(eating|eat|food|meal|lunch|dinner|breakfast|hungry|appetite)\b/i,
    ],
  },
  // Breaking fast/iftar
  {
    category: "breaking_fast",
    patterns: [/\b(breaking fast|iftar|break fast|ramadan|fasting|fast)\b/i],
  },
  // Drinking water
  {
    category: "drinking_water",
    patterns: [/\b(drinking water|drink|thirsty|thirst|water)\b/i],
  },
  // New clothes/dressing
  {
    category: "new_clothes",
    patterns: [
      /\b(new clothes|new dress|new outfit|wearing new|just bought)\b/i,
    ],
  },
  // Mirror/appearance
  {
    category: "mirror",
    patterns: [/\b(mirror|reflection|looking at myself|appearance|beauty)\b/i],
  },
  // Vehicle/car/transportation
  {
    category: "vehicle",
    patterns: [
      /\b(vehicle|car|driving|drive|transportation|riding|passenger)\b/i,
    ],
  },
  // Market/shopping
  {
    category: "market",
    patterns: [/\b(market|shopping|shop|store|mall|bazaar|buying)\b/i],
  },
  // Meeting/gathering/sitting
  {
    category: "meeting",
    patterns: [/\b(meeting|gathering|assembly|sitting|get together|social)\b/i],
  },
  // Adhan/call to prayer
  {
    category: "adhan",
    patterns: [/\b(adhan|azan|call to prayer|prayer call|hearing adhan)\b/i],
  },
  // After prayer/salah
  {
    category: "after_prayer",
    patterns: [
      /\b(after prayer|after salah|finished praying|done praying|tasbih|dhikr)\b/i,
    ],
  },
  // Witr/night prayer
  {
    category: "witr",
    patterns: [/\b(witr|tahajjud|qiyam|night prayer|qunoot)\b/i],
  },
  // Quran/recitation
  {
    category: "quran",
    patterns: [
      /\b(quran|qur'?an|recit(e|ing|ation)|reading quran|understanding quran)\b/i,
    ],
  },
  // Laylatul Qadr/Ramadan night
  {
    category: "laylatul_qadr",
    patterns: [
      /\b(laylatul qadr|lailatul qadr|night of power|night of decree|last ten nights)\b/i,
    ],
  },
  // Friday/Jummah
  {
    category: "Friday",
    patterns: [/\b(friday|jummah|jumu'?ah|blessed friday)\b/i],
  },
  // Visiting sick
  {
    category: "visiting_sick",
    patterns: [
      /\b(visiting sick|visit patient|hospital visit|comfort sick)\b/i,
    ],
  },
  // Sneezing
  {
    category: "sneezing",
    patterns: [/\b(sneez(e|ing)|sneezed|achoo)\b/i],
  },
  // Receiving gift
  {
    category: "gift",
    patterns: [/\b(gift|present|receiv(ed|ing) gift|got gift)\b/i],
  },
  // Receiving praise/compliment
  {
    category: "praise",
    patterns: [
      /\b(praised|compliment|admiration|people praising|someone praised)\b/i,
    ],
  },
  // Seeing disabled person
  {
    category: "seeing_disabled",
    patterns: [
      /\b(disabled|handicapped|affliction|seeing afflicted|less fortunate)\b/i,
    ],
  },
  // Good news
  {
    category: "good_news",
    patterns: [
      /\b(good news|great news|happy news|celebration|celebrating|joyful)\b/i,
    ],
  },
  // Bad news
  {
    category: "bad_news",
    patterns: [
      /\b(bad news|terrible news|sad news|disappointing|disappointment)\b/i,
    ],
  },
  // Business/work/trade
  {
    category: "business",
    patterns: [
      /\b(business|trade|trading|commerce|entrepreneur|startup|company)\b/i,
    ],
  },
  // Consultation/seeking advice
  {
    category: "consultation",
    patterns: [
      /\b(consult(ation|ing)?|advice|advise|counsel|seeking guidance|asking opinion)\b/i,
    ],
  },
  // Inheritance/legacy
  {
    category: "inheritance",
    patterns: [/\b(inheritance|inherit|legacy|estate|will|heir)\b/i],
  },
  // Divorce/separation
  {
    category: "divorce",
    patterns: [
      /\b(divorce|divorcing|separated|separation|breaking up|end marriage)\b/i,
    ],
  },
  // Family conflict
  {
    category: "family_conflict",
    patterns: [
      /\b(family conflict|family problem|family fight|arguing with family|family issues)\b/i,
    ],
  },
  // Legal/court/injustice
  {
    category: "legal",
    patterns: [/\b(legal|court|lawsuit|trial|judge|lawyer|attorney|case)\b/i],
  },
  // Accident/injury
  {
    category: "accident",
    patterns: [/\b(accident|crash|collision|injury|injured|hurt|incident)\b/i],
  },
  // Medical/surgery/treatment
  {
    category: "medical",
    patterns: [
      /\b(medical|surgery|operation|treatment|procedure|hospital|clinic)\b/i,
    ],
  },
  // Moving home/relocating
  {
    category: "moving_home",
    patterns: [
      /\b(moving|relocat(e|ing)|new home|new house|shifting|transfer)\b/i,
    ],
  },
  // Loss/losing something
  {
    category: "loss",
    patterns: [/\b(lost|loss|losing|missing|cant find|misplaced)\b/i],
  },
  // Longing/missing someone
  {
    category: "longing",
    patterns: [
      /\b(longing|miss|missing someone|yearn|longing for|separated from)\b/i,
    ],
  },
  // Remembrance/dhikr/general
  {
    category: "remembrance",
    patterns: [/\b(remembrance|dhikr|zikr|remember allah|mindful)\b/i],
  },
  // Knowledge/learning/education
  {
    category: "knowledge",
    patterns: [
      /\b(knowledge|learn|learning|education|understanding|intellect|wisdom|smart|study|school|assignment|homework|class|course)\b/i,
    ],
  },
  // Anxiety/stress-related queries (keep near end as it's broad)
  {
    category: "anxiety",
    patterns: [
      /\b(anxious|anxiety|stress|stressed|worried|worry|panic|nervous|overthinking|overwhelmed?)\b/i,
    ],
  },
  // Forgiveness/repentance
  {
    category: "forgiveness",
    patterns: [
      /\b(forgive|forgiveness|sin|sins|repent|repentance|tawbah|taubah|mistake|guilty|guilt|regret|atonement)\b/i,
    ],
  },
  // Healing/health/illness
  {
    category: "healing",
    patterns: [
      /\b(heal|healing|health|sick|sickness|ill|illness|pain|hurts?|disease|recovery|recover|medicine|doctor)\b/i,
    ],
  },
  // Gratitude/thanks
  {
    category: "gratitude",
    patterns: [
      /\b(thank|thanks|thankful|grateful|gratitude|blessing|blessed|appreciate|appreciation|favor|alhamdulillah)\b/i,
    ],
  },
  // Protection/safety (broad, near end)
  {
    category: "protection",
    patterns: [
      /\b(protect|protection|safety|safe|guard|shield|defense|defend|harm|danger|threat)\b/i,
    ],
  },
  // Guidance/direction
  {
    category: "guidance",
    patterns: [/\b(guide|guidance|direction|clarity|lost|path|show me)\b/i],
  },
  // Success/achievement
  {
    category: "success",
    patterns: [
      /\b(success|succeed|successful|achievement|achieve|victory|win|accomplish|goal|excellence|prosper)\b/i,
    ],
  },
  // Patience/hardship
  {
    category: "patience",
    patterns: [
      /\b(patience|patient|endure|endurance|struggling?|suffering|sabr)\b/i,
    ],
  },
  // Family (general, keep broad)
  {
    category: "family",
    patterns: [
      /\b(family|spouse|husband|wife|child|children|kids|offspring)\b/i,
    ],
  },
  // Provision/wealth/sustenance
  {
    category: "provision",
    patterns: [
      /\b(provision|wealth|money|rich|poor|sustenance|rizq|income|financial|abundance)\b/i,
    ],
  },
  // Peace/tranquility
  {
    category: "peace",
    patterns: [
      /\b(peace|peaceful|calm|tranquil|tranquility|serenity|serene|quiet|relief|relax)\b/i,
    ],
  },
];

/**
 * Match user input against regex rules
 * Returns category name if matched, null otherwise
 */
export function matchByRegex(input: string): string | null {
  const normalized = normalizeInput(input);

  for (const rule of MATCH_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(normalized)) {
        return rule.category;
      }
    }
  }

  return null;
}

/**
 * Get match source for logging
 */
export type MatchSource = "regex" | "ai" | "fallback";

export interface MatchResult {
  category: string | null;
  source: MatchSource;
}
