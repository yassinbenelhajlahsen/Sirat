import { HStack, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  background,
  containerBackground,
  cornerRadius,
  font,
  foregroundStyle,
  frame,
  opacity,
  padding,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

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
  const shell = [
    widgetURL("sirat:///"),
    padding({ all: 2 }),
    frame({ maxWidth: 10000, maxHeight: 10000, alignment: "topLeading" }),
    containerBackground(theme.background, "widget"),
  ];

  if (props.stale) {
    return (
      <VStack alignment="leading" modifiers={shell}>
        <Text modifiers={[font({ size: 15, weight: "semibold" }), foregroundStyle(theme.text)]}>
          Open Sirat to update
        </Text>
      </VStack>
    );
  }

  // 16% accent behind the next prayer (hex alpha 0x29).
  const highlight = theme.accent + "29";

  const header = (
    <HStack alignment="top">
      <VStack alignment="leading" spacing={1}>
        <Text modifiers={[font({ size: 13, weight: "semibold" }), foregroundStyle(theme.accent)]}>{props.hijri}</Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(theme.text), opacity(0.7)]}>{props.gregorian}</Text>
      </VStack>
      <Spacer />
      {props.sunrise ? (
        <Text modifiers={[font({ size: 12 }), foregroundStyle(theme.text), opacity(0.7)]}>
          {`Sunrise ${props.sunrise}`}
        </Text>
      ) : null}
    </HStack>
  );

  const footer = (
    <HStack spacing={4}>
      <Text modifiers={[font({ size: 13 }), foregroundStyle(theme.text), opacity(0.85)]}>
        {`${props.next.name} in`}
      </Text>
      <Text
        modifiers={[font({ size: 13, weight: "bold" }), foregroundStyle(theme.accent)]}
        date={new Date(props.next.at)}
        dateStyle="relative"
      />
    </HStack>
  );

  if (wide) {
    return (
      <VStack alignment="leading" spacing={8} modifiers={shell}>
        {header}
        <HStack spacing={0}>
          {props.prayers.map((p) => {
            const isNext = p.name === props.next.name;
            const color = isNext ? theme.accent : theme.text;
            return (
              <VStack
                key={p.name}
                spacing={2}
                modifiers={[
                  frame({ maxWidth: 10000 }),
                  padding({ vertical: 6 }),
                  background(isNext ? highlight : "clear"),
                  cornerRadius(10),
                ]}
              >
                <Text modifiers={[font({ size: 12 }), foregroundStyle(color), opacity(isNext ? 1 : 0.75)]}>{p.name}</Text>
                <Text modifiers={[font({ size: 15, weight: "semibold" }), foregroundStyle(color)]}>
                  {p.time.split(" ")[0]}
                </Text>
              </VStack>
            );
          })}
        </HStack>
        <Spacer />
        {footer}
      </VStack>
    );
  }

  // Rows share the height left under the header, so the list fills the widget.
  return (
    <VStack alignment="leading" spacing={10} modifiers={shell}>
      {header}
      <VStack spacing={4} modifiers={[frame({ maxHeight: 10000 })]}>
        {props.prayers.map((p) => {
          const isNext = p.name === props.next.name;
          const color = isNext ? theme.accent : theme.text;
          return (
            <HStack
              key={p.name}
              modifiers={[
                padding({ horizontal: 14 }),
                frame({ maxHeight: 10000 }),
                background(isNext ? highlight : "clear"),
                cornerRadius(14),
              ]}
            >
              <Text modifiers={[font({ size: 24, weight: isNext ? "bold" : "regular" }), foregroundStyle(color)]}>{p.name}</Text>
              <Spacer />
              <Text modifiers={[font({ size: 24, weight: isNext ? "bold" : "regular" }), foregroundStyle(color)]}>{p.time}</Text>
            </HStack>
          );
        })}
      </VStack>
      {footer}
    </VStack>
  );
};

export default createWidget("PrayerTimes", PrayerTimes);
