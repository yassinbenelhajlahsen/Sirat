import SettingsRow from "@/components/settings/SettingsRow";
import SettingsSection from "@/components/settings/SettingsSection";
import type { Dua } from "@/services/duaService";
import { topicForCategory } from "@/services/duaTopics";

type Props = {
  label: string;
  duas: Dua[];
  onSelect: (dua: Dua) => void;
};

/** A grouped list of duas: first line of the translation, topic and reference underneath. */
export default function DuaListSection({ label, duas, onSelect }: Props) {
  return (
    <SettingsSection label={label}>
      {duas.map((dua, index) => (
        <SettingsRow
          key={dua.id}
          first={index === 0}
          title={dua.english}
          subtitle={`${topicForCategory(dua.category)?.label ?? dua.category} · ${dua.reference}`}
          showChevron
          onPress={() => onSelect(dua)}
          accessibilityLabel={`Open dua: ${dua.english}`}
        />
      ))}
    </SettingsSection>
  );
}
