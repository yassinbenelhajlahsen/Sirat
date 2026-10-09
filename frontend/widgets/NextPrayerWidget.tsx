import { Text, VStack } from "@expo/ui/swift-ui";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

export type NextPrayerProps = {
  dateLabel: string;
  prayerName: string;
  timeLabel: string;
  // Epoch ms. The countdown runs from `startsAt` (this timeline entry) to
  // `endsAt` (the prayer) and ticks on its own, with no reload.
  startsAt: number;
  endsAt: number;
};

// Runs in the widget's isolated runtime: must stay pure and synchronous, and
// can only use values from its own arguments.
const NextPrayer = (props: NextPrayerProps, environment: WidgetEnvironment) => {
  "widget";
  if (environment.widgetFamily === "accessoryInline") {
    return <Text>{`${props.prayerName} ${props.timeLabel}`}</Text>;
  }
  return (
    <VStack>
      <Text>{props.dateLabel}</Text>
      <Text>{`${props.prayerName} ${props.timeLabel}`}</Text>
      <Text
        timerInterval={{
          lower: new Date(props.startsAt),
          upper: new Date(props.endsAt),
        }}
        countsDown
      />
    </VStack>
  );
};

export default createWidget("NextPrayer", NextPrayer);
