import { getAnotherDua, getDuasForTopic } from "@/services/duaService";
import { DUA_TOPICS, DUA_TOPIC_GROUPS, getTopic, topicForCategory } from "@/services/duaTopics";

const { duas } = require("../../assets/data/duas.json") as {
  duas: { id: number; category: string }[];
};
const dataCategories = [...new Set(duas.map((d) => d.category))];

describe("services/duaTopics", () => {
  it("maps every category in duas.json to exactly one topic", () => {
    for (const category of dataCategories) {
      const owners = DUA_TOPICS.filter((t) => t.categories.includes(category));
      expect({ category, topics: owners.map((t) => t.id).length }).toEqual({ category, topics: 1 });
    }
  });

  it("only lists categories that exist in duas.json", () => {
    const unknown = DUA_TOPICS.flatMap((t) => t.categories).filter(
      (c) => !dataCategories.includes(c),
    );
    expect(unknown).toEqual([]);
  });

  it("uses unique topic ids and known groups", () => {
    const ids = DUA_TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const topic of DUA_TOPICS) {
      expect(DUA_TOPIC_GROUPS).toContain(topic.group);
    }
  });

  it("merges near-duplicate categories under one topic", () => {
    expect(topicForCategory("healing")?.id).toBe(topicForCategory("visiting_sick")?.id);
    expect(topicForCategory("anxiety")?.id).toBe(topicForCategory("depression")?.id);
    expect(getTopic("illness-healing")?.label).toBe("Illness and healing");
  });

  it("lists every dua under exactly one topic", () => {
    const total = DUA_TOPICS.reduce((sum, t) => sum + getDuasForTopic(t.id).length, 0);
    expect(total).toBe(duas.length);
  });
});

describe("getAnotherDua", () => {
  it("stays inside the topic while it has another dua", () => {
    const topic = getTopic("illness-healing")!;
    const members = getDuasForTopic(topic.id);
    expect(members.length).toBeGreaterThan(1);

    for (let i = 0; i < 25; i += 1) {
      const next = getAnotherDua(topic, members[0].id)!;
      expect(next.id).not.toBe(members[0].id);
      expect(topicForCategory(next.category)?.id).toBe(topic.id);
    }
  });

  it("falls back to the wider pool when there is no topic", () => {
    const shown = duas[0].id;
    expect(getAnotherDua(undefined, shown)!.id).not.toBe(shown);
  });
});
