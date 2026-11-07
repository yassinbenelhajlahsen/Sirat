import { Children, cloneElement, type ReactElement, type ReactNode } from "react";
import { Clipboard, Pressable, type AccessibilityActionEvent, type ViewProps } from "react-native";

import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import { showActionMenu } from "@/utils/actionMenu";

type Props = { children: ReactNode; copy: string; canReport: boolean; onReport: () => void };

const MENU_ACTION = "menu";

// Long press opens the action sheet. A SwiftUI ContextMenu laid the RN bubble out at unconstrained width, so text never wrapped.
export default function AnswerMenu({ children, copy, canReport, onReport }: Props) {
  const { theme } = useTheme();
  const haptic = useHaptics();
  const open = () => {
    haptic("light");
    showActionMenu({
      theme,
      options: [
        { label: "Copy", onPress: () => Clipboard.setString(copy) },
        ...(canReport ? [{ label: "Report", onPress: onReport, destructive: true }] : []),
      ],
    });
  };

  // The child is the one VoiceOver element, so the menu is offered there as an action; a double-tap-and-hold could land on a number tag.
  const child = Children.only(children) as ReactElement<ViewProps>;
  const menuLabel = canReport ? "Copy or report" : "Copy";
  const accessible = cloneElement(child, {
    accessibilityActions: [...(child.props.accessibilityActions ?? []), { name: MENU_ACTION, label: menuLabel }],
    onAccessibilityAction: (e: AccessibilityActionEvent) =>
      e.nativeEvent.actionName === MENU_ACTION ? open() : child.props.onAccessibilityAction?.(e),
  });

  return (
    <Pressable accessible={false} onLongPress={open} delayLongPress={400}>
      {accessible}
    </Pressable>
  );
}
