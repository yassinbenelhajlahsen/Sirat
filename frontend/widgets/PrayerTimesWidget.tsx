import { HStack, Rectangle, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  kerning,
  opacity,
  padding,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";
import type { ReactNode } from "react";

import type { PrayerEntryProps } from "@/services/widgets/timeline";
import type { WidgetTheme } from "@/services/widgets/widgetTheme";

export type PrayerTimesProps = PrayerEntryProps & { theme: WidgetTheme };

// Runs in the widget's isolated runtime: see NextPrayerWidget.
const PrayerTimes = (props: PrayerTimesProps, environment: WidgetEnvironment) => {
  "widget";
  // WidgetKit renders a placeholder with no props before the app has pushed any.
  if (!props.theme || !props.next) {
    return <Text>Sirat</Text>;
  }
  const { theme } = props;
  const wide = environment.widgetFamily === "systemMedium";

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
          endRadius: wide ? 210 : 230,
        }),
        frame({ maxWidth: 10000, maxHeight: 10000 }),
        // Negative padding pushes the glow past the widget's content margin, so the widget edge clips it.
        padding({ all: -24 }),
      ]}
    />
  );
  const card = (content: ReactNode) => (
    <ZStack modifiers={[widgetURL("sirat:///"), containerBackground(backdrop, "widget")]}>
      {theme.glow ? glow(theme.glow, 0.85, 0) : null}
      {theme.glowSecondary ? glow(theme.glowSecondary, 0.1, 1) : null}
      {content}
    </ZStack>
  );
  const pad = [padding({ all: 2 }), frame({ maxWidth: 10000, maxHeight: 10000, alignment: "topLeading" })];
  const rule = <Rectangle modifiers={[foregroundStyle(theme.text + "1F"), frame({ maxWidth: 10000, height: 1 })]} />;

  if (props.stale) {
    return card(
      <VStack alignment="leading" modifiers={pad}>
        <Text modifiers={[font({ size: 15, weight: "semibold" }), foregroundStyle(theme.text)]}>
          Open Sirat to update
        </Text>
      </VStack>,
    );
  }

  const header = (
    <HStack alignment="top">
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={[font({ size: 11, weight: "medium" }), kerning(1.3), foregroundStyle(theme.accent)]}>
          {props.hijri.toUpperCase()}
        </Text>
        <Text modifiers={[font({ size: 14, weight: "semibold" }), foregroundStyle(theme.text)]}>
          {props.gregorian}
        </Text>
      </VStack>
      <Spacer />
      {props.sunrise ? (
        <Text modifiers={[font({ size: 12 }), foregroundStyle(theme.text), opacity(0.7)]}>
          {`Sunrise ${props.sunrise}`}
        </Text>
      ) : null}
    </HStack>
  );

  const footer = (size: number) => (
    <HStack spacing={4}>
      <Text modifiers={[font({ size }), foregroundStyle(theme.text), opacity(0.88)]}>
        {`${props.next.name} in`}
      </Text>
      <Text
        modifiers={[font({ size, weight: "bold" }), foregroundStyle(theme.accent)]}
        date={new Date(props.next.at)}
        dateStyle="relative"
      />
    </HStack>
  );

  if (wide) {
    return card(
      <VStack alignment="leading" spacing={10} modifiers={pad}>
        {header}
        {rule}
        <HStack spacing={0}>
          {props.prayers.map((p) => {
            const isNext = p.name === props.next.name;
            const color = isNext ? theme.accent : theme.text;
            return (
              <VStack key={p.name} spacing={3} modifiers={[frame({ maxWidth: 10000 })]}>
                <Text modifiers={[font({ size: 12 }), foregroundStyle(color), opacity(isNext ? 1 : 0.72)]}>{p.name}</Text>
                <Text modifiers={[font({ size: 18, weight: isNext ? "bold" : "semibold" }), foregroundStyle(color)]}>
                  {p.time.split(" ")[0]}
                </Text>
              </VStack>
            );
          })}
        </HStack>
        <Spacer />
        {footer(12)}
      </VStack>,
    );
  }

  // Rows share the height left under the header, so the list fills the widget.
  return card(
    <VStack alignment="leading" spacing={10} modifiers={pad}>
      {header}
      {rule}
      <VStack spacing={0} modifiers={[frame({ maxHeight: 10000 })]}>
        {props.prayers.map((p, i) => {
          const isNext = p.name === props.next.name;
          const color = isNext ? theme.accent : theme.text;
          const weight = isNext ? "bold" : "regular";
          return (
            <VStack key={p.name} spacing={0} modifiers={[frame({ maxHeight: 10000 })]}>
              <HStack modifiers={[frame({ maxHeight: 10000 })]}>
                <Text modifiers={[font({ size: 22, weight }), foregroundStyle(color), opacity(isNext ? 1 : 0.88)]}>{p.name}</Text>
                <Spacer />
                <Text modifiers={[font({ size: 22, weight }), foregroundStyle(color), opacity(isNext ? 1 : 0.88)]}>{p.time}</Text>
              </HStack>
              {i < props.prayers.length - 1 ? rule : null}
            </VStack>
          );
        })}
      </VStack>
      {footer(14)}
    </VStack>,
  );
};

export default createWidget("PrayerTimes", PrayerTimes);
