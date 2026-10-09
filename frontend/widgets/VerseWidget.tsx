import { Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  multilineTextAlignment,
  opacity,
  padding,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget } from "expo-widgets";

import type { WidgetTheme } from "@/services/widgets/widgetTheme";

export type VerseProps =
  | { pinned: false; theme: WidgetTheme }
  | {
      pinned: true;
      arabic: string;
      english: string;
      reference: string;
      arabicSize: number;
      // 0 when the English was dropped so the Arabic fits.
      englishSize: number;
      surah: number;
      ayah: number;
      theme: WidgetTheme;
    };

// Runs in the widget's isolated runtime: see NextPrayerWidget.
const Verse = (props: VerseProps) => {
  "widget";
  // WidgetKit renders a placeholder with no props before the app has pushed any.
  if (!props.theme) {
    return <Text>Sirat</Text>;
  }
  const { theme } = props;
  const shell = (url: string) => [
    widgetURL(url),
    padding({ all: 2 }),
    frame({ maxWidth: 10000, maxHeight: 10000, alignment: "center" }),
    containerBackground(theme.background, "widget"),
  ];

  if (!props.pinned) {
    return (
      <VStack modifiers={shell("sirat:///Quran")}>
        <Text
          modifiers={[font({ size: 15 }), foregroundStyle(theme.text), multilineTextAlignment("center")]}
        >
          Hold a verse in the Quran tab to add it
        </Text>
      </VStack>
    );
  }

  return (
    <VStack spacing={8} modifiers={shell(`sirat:///Quran?surah=${props.surah}&ayah=${props.ayah}`)}>
      <Spacer />
      <Text
        modifiers={[
          font({ size: props.arabicSize }),
          foregroundStyle(theme.text),
          multilineTextAlignment("center"),
        ]}
      >
        {props.arabic}
      </Text>
      {props.englishSize ? (
        <Text
          modifiers={[
            font({ size: props.englishSize }),
            foregroundStyle(theme.text),
            opacity(0.9),
            multilineTextAlignment("center"),
          ]}
        >
          {props.english}
        </Text>
      ) : null}
      <Spacer />
      <Text modifiers={[font({ size: 12 }), foregroundStyle(theme.accent)]}>{props.reference}</Text>
    </VStack>
  );
};

export default createWidget("Verse", Verse);
