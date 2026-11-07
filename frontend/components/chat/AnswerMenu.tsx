import { Button, ContextMenu, Host, RNHostView } from "@expo/ui/swift-ui";
import { Children, cloneElement, type ReactElement, type ReactNode } from "react";
import { AccessibilityInfo, Clipboard, StyleSheet, View, type AccessibilityActionEvent, type ViewProps } from "react-native";

type Props = { children: ReactNode; copy: string; canReport: boolean; onReport: () => void; maxWidth: number };

// The native long-press menu: the bubble lifts and Copy/Report show beneath it, like Messages.
export default function AnswerMenu({ children, copy, canReport, onReport, maxWidth }: Props) {
  const onCopy = () => Clipboard.setString(copy);

  // VoiceOver focuses the hosted RN view, not the SwiftUI menu around it, so Copy and Report are offered as actions on it.
  const child = Children.only(children) as ReactElement<ViewProps>;
  const accessible = cloneElement(child, {
    accessibilityActions: [
      ...(child.props.accessibilityActions ?? []),
      { name: "copy", label: "Copy" },
      ...(canReport ? [{ name: "report", label: "Report" }] : []),
    ],
    onAccessibilityAction: (e: AccessibilityActionEvent) => {
      const name = e.nativeEvent.actionName;
      if (name === "copy") {
        onCopy();
        AccessibilityInfo.announceForAccessibility("Copied");
      } else if (name === "report") onReport();
      else child.props.onAccessibilityAction?.(e);
    },
  });

  return (
    <View>
      {/* RN lays out a hidden copy so the row is the bubble's real height from the first frame; a matchContents Host reports its size late and sometimes short, so text spilled into the next message. */}
      <View
        testID="answer-menu-spacer"
        style={[styles.spacer, { maxWidth }]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {child}
      </View>
      <Host style={StyleSheet.absoluteFill}>
        <ContextMenu>
          <ContextMenu.Items>
            <Button label="Copy" systemImage="doc.on.doc" onPress={onCopy} />
            {canReport ? <Button label="Report" systemImage="flag" role="destructive" onPress={onReport} /> : null}
          </ContextMenu.Items>
          <ContextMenu.Trigger>
            <RNHostView matchContents>
              {/* RNHostView measures its child with only that child's own point-valued min/max size and no parent width, so without this the text never wraps. */}
              <View style={{ maxWidth }}>{accessible}</View>
            </RNHostView>
          </ContextMenu.Trigger>
        </ContextMenu>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({ spacer: { opacity: 0 } });
