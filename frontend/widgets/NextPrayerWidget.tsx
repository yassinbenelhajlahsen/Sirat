import { AccessoryWidgetBackground, Rectangle, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  kerning,
  lineLimit,
  minimumScaleFactor,
  opacity,
  padding,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";
import type { ReactNode } from "react";

import type { PrayerEntryProps } from "@/services/widgets/timeline";
import type { WidgetTheme } from "@/services/widgets/widgetTheme";

export type NextPrayerProps = PrayerEntryProps & { theme: WidgetTheme };

// Runs in the widget's isolated runtime: the function is stringified, so it must
// stay pure and synchronous and can only use its arguments and the globals the
// widget runtime provides (the swift-ui components and modifiers).
const NextPrayer = (props: NextPrayerProps, environment: WidgetEnvironment) => {
  "widget";
  const lockScreen = environment.widgetFamily === "accessoryRectangular";
  // The lock screen's own rounded backing, used for the loading and update states.
  const rounded = (message: string) => (
    <ZStack>
      <AccessoryWidgetBackground />
      <Text modifiers={[font({ size: 14, weight: "semibold" })]}>{message}</Text>
    </ZStack>
  );

  // WidgetKit renders a placeholder with no props before the app has pushed any.
  if (!props.theme || !props.next) {
    return lockScreen ? rounded("Sirat") : <Text>Sirat</Text>;
  }
  const { theme } = props;
  const open = widgetURL("sirat:///");

  if (props.stale && lockScreen) {
    return rounded("Open Sirat to update");
  }

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
          endRadius: 110,
        }),
        frame({ maxWidth: 10000, maxHeight: 10000 }),
        // Negative padding pushes the glow past the widget's content margin, so the widget edge clips it.
        padding({ all: -24 }),
      ]}
    />
  );
  const card = (content: ReactNode) => (
    <ZStack modifiers={[open, containerBackground(backdrop, "widget")]}>
      {theme.glow ? glow(theme.glow, 0.85, 0) : null}
      {theme.glowSecondary ? glow(theme.glowSecondary, 0.1, 1) : null}
      {content}
    </ZStack>
  );
  const pad = [padding({ all: 2 }), frame({ maxWidth: 10000, maxHeight: 10000, alignment: "topLeading" })];

  if (props.stale) {
    return card(
      <VStack alignment="leading" modifiers={pad}>
        <Text modifiers={[font({ size: 14, weight: "semibold" }), foregroundStyle(theme.text)]}>
          Open Sirat to update
        </Text>
      </VStack>,
    );
  }

  if (lockScreen) {
    return (
      <VStack alignment="leading" spacing={1} modifiers={[open]}>
        <Text modifiers={[font({ size: 16, weight: "bold" })]}>{props.hijri}</Text>
        <Text modifiers={[font({ size: 14, weight: "semibold" })]}>
          {`${props.next.name} at ${props.next.time}`}
        </Text>
        <Text modifiers={[font({ size: 14, weight: "semibold" })]} date={new Date(props.next.at)} dateStyle="relative" />
      </VStack>
    );
  }

  return card(
    <VStack alignment="leading" spacing={0} modifiers={pad}>
      <Text modifiers={[font({ size: 11, weight: "medium" }), kerning(1.3), foregroundStyle(theme.accent)]}>
        NEXT PRAYER
      </Text>
      <Text modifiers={[font({ size: 32, weight: "bold" }), foregroundStyle(theme.text)]}>
        {props.next.name}
      </Text>
      <Text modifiers={[font({ size: 14 }), foregroundStyle(theme.text), opacity(0.7)]}>
        {props.next.time}
      </Text>
      <Spacer />
      <Text
        modifiers={[
          font({ size: 17, weight: "semibold" }),
          foregroundStyle(theme.text),
          lineLimit(1),
          minimumScaleFactor(0.7),
        ]}
        date={new Date(props.next.at)}
        dateStyle="relative"
      />
      <Text modifiers={[font({ size: 11 }), foregroundStyle(theme.accent)]}>{props.hijri}</Text>
    </VStack>,
  );
};

export default createWidget("NextPrayer", NextPrayer);
