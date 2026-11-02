import { Group, Host, BottomSheet, RNHostView } from "@expo/ui/swift-ui";
import {
  interactiveDismissDisabled,
  preferredColorScheme,
  presentationBackgroundInteraction,
  presentationDetents,
  presentationDragIndicator,
  presentationSizing,
} from "@expo/ui/swift-ui/modifiers";
import { useMemo, useRef, type ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import SheetTitleBar from "@/components/ui/SheetTitleBar";
import { useTheme } from "@/context/ThemeContext";

export type NativeSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Fractions of screen height the sheet can rest at. Omit to fit the content. */
  detents?: number[];
  /** Blocks swipe-down and the close button, e.g. while a save is in flight. */
  dismissDisabled?: boolean;
  /** Keep the screen behind touchable while the sheet is up (maps). */
  backgroundInteraction?: boolean;
  children: ReactNode;
};

/**
 * Apple's own sheet (UISheetPresentationController via SwiftUI). The system
 * draws the sheet material, drag indicator and swipe-down dismissal.
 * `onClose` fires once per close, whether from swipe or the in-sheet button.
 */
export default function NativeSheet({
  visible,
  onClose,
  title,
  detents,
  dismissDisabled = false,
  backgroundInteraction = false,
  children,
}: NativeSheetProps) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const fit = !detents || detents.length === 0;

  // Parents clear their selection (prayer, ayah, habit) the moment they close
  // the sheet. Keep showing what was on screen until it has slid away, or the
  // title and rows change mid-dismiss and the layout jumps.
  const shown = useRef({ title, children });
  if (visible) shown.current = { title, children };

  const modifiers = useMemo(
    () => [
      preferredColorScheme(theme.name === "light" ? "light" : "dark"),
      ...(fit
        ? [presentationSizing("fitted")]
        : [presentationDetents(detents.map((fraction) => ({ fraction })))]),
      presentationDragIndicator("visible"),
      interactiveDismissDisabled(dismissDisabled),
      ...(backgroundInteraction ? [presentationBackgroundInteraction("enabled")] : []),
    ],
    [fit, detents, dismissDisabled, backgroundInteraction, theme.name],
  );

  return (
    <Host style={styles.host} pointerEvents="none">
      <BottomSheet
        isPresented={visible}
        // Native fires this only for gestures; a prop-driven close is silent,
        // so the in-sheet button calls onClose itself and nothing double-fires.
        onIsPresentedChange={(presented) => {
          if (!presented) onClose();
        }}
        fitToContents={fit}
      >
        <Group modifiers={modifiers}>
          <RNHostView matchContents={fit}>
            <GestureHandlerRootView style={fit ? { width } : styles.fill}>
              <SheetTitleBar title={shown.current.title} onClose={onClose} closeDisabled={dismissDisabled} />
              {shown.current.children}
            </GestureHandlerRootView>
          </RNHostView>
        </Group>
      </BottomSheet>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", width: 0, height: 0 },
  fill: { flexGrow: 1, height: 0 },
});
