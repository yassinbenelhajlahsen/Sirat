/**
 * Display topics for the dua library. The category strings in duas.json are
 * matched by duaMatcher (and by older app builds through the backend), so they are never renamed;
 * this map only decides how they are grouped and labelled in the UI. Every
 * category belongs to exactly one topic (enforced by a test).
 */

export const DUA_TOPIC_GROUPS = [
  "Daily life",
  "Feelings",
  "Hardship",
  "Family",
  "Worship",
  "Travel and home",
] as const;

export type DuaTopicGroup = (typeof DUA_TOPIC_GROUPS)[number];

export interface DuaTopic {
  id: string;
  label: string;
  group: DuaTopicGroup;
  categories: string[];
}

export const DUA_TOPICS: DuaTopic[] = [
  // Daily life
  { id: "morning-night", label: "Morning and night", group: "Daily life", categories: ["morning", "night"] },
  { id: "sleep", label: "Sleep", group: "Daily life", categories: ["sleep"] },
  { id: "food-drink", label: "Food and drink", group: "Daily life", categories: ["eating", "drinking_water", "breaking_fast"] },
  { id: "etiquette", label: "Everyday manners", group: "Daily life", categories: ["bathroom", "mirror", "new_clothes", "sneezing", "sitting", "meeting", "hosting"] },
  { id: "work-provision", label: "Work and provision", group: "Daily life", categories: ["job", "job_interview", "business", "market", "provision", "debt"] },
  { id: "knowledge-success", label: "Knowledge and success", group: "Daily life", categories: ["knowledge", "exam", "success"] },
  { id: "decisions", label: "Decisions and guidance", group: "Daily life", categories: ["decision", "major_decision", "consultation", "guidance", "new_beginning"] },
  { id: "weather", label: "Rain, thunder and wind", group: "Daily life", categories: ["rain", "thunder", "wind"] },

  // Feelings
  { id: "anxiety-worry", label: "Anxiety and worry", group: "Feelings", categories: ["anxiety", "worry", "depression", "confusion"] },
  { id: "fear-protection", label: "Fear and protection", group: "Feelings", categories: ["fear", "protection", "enemy"] },
  { id: "anger-jealousy", label: "Anger and jealousy", group: "Feelings", categories: ["anger", "jealousy"] },
  { id: "loneliness", label: "Loneliness and longing", group: "Feelings", categories: ["loneliness", "longing"] },
  { id: "gratitude-joy", label: "Gratitude and joy", group: "Feelings", categories: ["gratitude", "praise", "good_news", "gift", "seeing_disabled"] },
  { id: "hope-peace", label: "Hope and peace", group: "Feelings", categories: ["hope", "peace"] },

  // Hardship
  { id: "illness-healing", label: "Illness and healing", group: "Hardship", categories: ["illness", "healing", "medical", "visiting_sick"] },
  { id: "grief-loss", label: "Grief and loss", group: "Hardship", categories: ["loss", "deceased", "calamity", "bad_news", "accident", "visiting_graves"] },
  { id: "patience", label: "Patience and difficulty", group: "Hardship", categories: ["patience", "difficulty", "steadfastness"] },
  { id: "injustice", label: "Injustice", group: "Hardship", categories: ["oppression", "injustice", "legal", "betrayal"] },

  // Family
  { id: "marriage", label: "Marriage and divorce", group: "Family", categories: ["marriage", "divorce"] },
  { id: "parents-family", label: "Parents and family", group: "Family", categories: ["parents", "family", "family_conflict", "inheritance"] },
  { id: "children", label: "Children and pregnancy", group: "Family", categories: ["children", "NewBorn", "pregnancy"] },

  // Worship
  { id: "forgiveness", label: "Forgiveness and repentance", group: "Worship", categories: ["forgiveness", "repentance", "forgiveness_from_people"] },
  { id: "prayer-mosque", label: "Prayer and the mosque", group: "Worship", categories: ["mosque", "adhan", "after_prayer", "witr", "in_prayer", "wudu"] },
  { id: "special-times", label: "Special times", group: "Worship", categories: ["laylatul qadr", "Friday"] },
  { id: "remembrance", label: "Remembrance and the Quran", group: "Worship", categories: ["quran", "remembrance", "paradise", "General"] },
  { id: "heart-character", label: "Heart and character", group: "Worship", categories: ["humility", "sincerity", "heart", "charity"] },
  { id: "self-restraint", label: "Self-restraint", group: "Worship", categories: ["temptation", "addiction", "chastity", "backbiting"] },

  // Travel and home
  { id: "travel", label: "Travel", group: "Travel and home", categories: ["travel", "vehicle"] },
  { id: "home", label: "Home", group: "Travel and home", categories: ["entering_home", "leaving_home", "moving_home"] },
];

const TOPIC_BY_CATEGORY = new Map<string, DuaTopic>(
  DUA_TOPICS.flatMap((topic) => topic.categories.map((c) => [c, topic] as const)),
);

export function topicForCategory(category: string): DuaTopic | undefined {
  return TOPIC_BY_CATEGORY.get(category);
}

export function getTopic(id: string): DuaTopic | undefined {
  return DUA_TOPICS.find((topic) => topic.id === id);
}
