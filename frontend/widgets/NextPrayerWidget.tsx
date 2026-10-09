import { AccessoryWidgetBackground, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import {
  containerBackground,
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
  const open = widgetURL("sirat:///");

  if (props.stale && lockScreen) {
    return rounded("Open Sirat to update");
  }

  if (props.stale) {
    return (
      <VStack alignment="leading" modifiers={[open, containerBackground(props.theme.background, "widget")]}>
        <Text modifiers={[font({ size: 14, weight: "semibold" }), foregroundStyle(props.theme.text)]}>
          Open Sirat to update
        </Text>
      </VStack>
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

  return (
    <VStack
      alignment="leading"
      spacing={0}
      modifiers={[
        open,
        padding({ all: 2 }),
        frame({ maxWidth: 10000, maxHeight: 10000, alignment: "topLeading" }),
        containerBackground(props.theme.background, "widget"),
      ]}
    >
      <Text modifiers={[font({ size: 11, weight: "medium" }), foregroundStyle(props.theme.text), opacity(0.7)]}>
        NEXT PRAYER
      </Text>
      <Text modifiers={[font({ size: 30, weight: "bold" }), foregroundStyle(props.theme.accent)]}>
        {props.next.name}
      </Text>
      <Text modifiers={[font({ size: 17, weight: "medium" }), foregroundStyle(props.theme.text)]}>
        {props.next.time}
      </Text>
      <Spacer />
      <Text
        modifiers={[font({ size: 14, weight: "semibold" }), foregroundStyle(props.theme.text)]}
        date={new Date(props.next.at)}
        dateStyle="relative"
      />
      <Text modifiers={[font({ size: 11 }), foregroundStyle(props.theme.accent)]}>{props.hijri}</Text>
    </VStack>
  );
};

export default createWidget("NextPrayer", NextPrayer);
