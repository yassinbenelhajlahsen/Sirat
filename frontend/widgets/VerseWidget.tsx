import { Rectangle, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  kerning,
  multilineTextAlignment,
  opacity,
  padding,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";
import type { ReactNode } from "react";

import type { WidgetTheme } from "@/services/widgets/widgetTheme";

export type VerseProps =
  | { pinned: false; theme: WidgetTheme }
  | {
      pinned: true;
      arabic: string;
      english: string;
      reference: string;
      // Text sizes per widget size; englishSize is 0 when the English was dropped.
      layouts: Record<"systemMedium" | "systemLarge", { arabicSize: number; englishSize: number }>;
      surah: number;
      ayah: number;
      theme: WidgetTheme;
    };

// Runs in the widget's isolated runtime: see NextPrayerWidget.
const Verse = (props: VerseProps, environment: WidgetEnvironment) => {
  "widget";
  // WidgetKit renders a placeholder with no props before the app has pushed any.
  if (!props.theme) {
    return <Text>Sirat</Text>;
  }
  const { theme } = props;
  const medium = environment.widgetFamily === "systemMedium";

  // The app's screen look: a diagonal gradient with a soft glow in two corners.
  // Falls back to the flat color for props pushed before the gradient existed.
  const backdrop = theme.gradient
    ? { type: "linearGradient" as const, colors: theme.gradient, startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } }
    : theme.background;
  const glow = (color: string, x: number, y: number) => (
    <Rectangle
      modifiers={[
        foregroundStyle({
          type: "radialGradient",
          colors: [color + "29", color + "00"],
          center: { x, y },
          startRadius: 0,
          endRadius: medium ? 210 : 230,
        }),
        frame({ maxWidth: 10000, maxHeight: 10000 }),
        // Negative padding pushes the glow past the widget's content margin, so the widget edge clips it.
        padding({ all: -24 }),
      ]}
    />
  );
  // Padding, font and spacing are what verseFit's sizes were calibrated against:
  // keep them as they are when restyling.
  const card = (url: string, content: ReactNode) => (
    <ZStack modifiers={[widgetURL(url), containerBackground(backdrop, "widget")]}>
      {theme.glow ? glow(theme.glow, 0.85, 0) : null}
      {theme.glowSecondary ? glow(theme.glowSecondary, 0.1, 1) : null}
      {content}
    </ZStack>
  );
  const pad = [padding({ all: 2 }), frame({ maxWidth: 10000, maxHeight: 10000, alignment: "center" })];

  if (!props.pinned) {
    return card(
      "sirat:///Quran",
      <VStack modifiers={pad}>
        <Text
          modifiers={[font({ size: 15 }), foregroundStyle(theme.text), multilineTextAlignment("center")]}
        >
          Hold a verse in the Quran tab to add it
        </Text>
      </VStack>,
    );
  }

  const layout = medium ? props.layouts.systemMedium : props.layouts.systemLarge;

  return card(
    `sirat:///Quran?surah=${props.surah}&ayah=${props.ayah}`,
    <VStack spacing={medium ? 4 : 8} modifiers={pad}>
      <Spacer />
      <Text
        modifiers={[
          font({ size: layout.arabicSize }),
          foregroundStyle(theme.text),
          multilineTextAlignment("center"),
        ]}
      >
        {props.arabic}
      </Text>
      {layout.englishSize ? (
        <Text
          modifiers={[
            font({ size: layout.englishSize }),
            foregroundStyle(theme.text),
            opacity(0.9),
            multilineTextAlignment("center"),
          ]}
        >
          {props.english}
        </Text>
      ) : null}
      <Spacer />
      <Text modifiers={[font({ size: 12 }), kerning(1.3), foregroundStyle(theme.accent)]}>
        {props.reference.toUpperCase()}
      </Text>
    </VStack>,
  );
};

export default createWidget("Verse", Verse);
