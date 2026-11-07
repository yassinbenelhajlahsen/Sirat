// frontend/components/chat/ChatHeaderTitle.tsx
import { StyleSheet, View } from "react-native";

import { Caption, Headline } from "@/components/ui/Text";
import { useTheme } from "@/context/ThemeContext";

type Props = { remaining: number | null; allowance: number | null };

export default function ChatHeaderTitle({ remaining, allowance }: Props) {
  const { theme } = useTheme();
  return (
    <View style={styles.wrap}>
      <Headline>Ask</Headline>
      {remaining !== null && allowance !== null ? (
        <Caption color={theme.colors.textTertiary}>{`${remaining} of ${allowance} left`}</Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { alignItems: "center" } });
