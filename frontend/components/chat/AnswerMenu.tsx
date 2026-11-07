import { Children, cloneElement, type ReactElement, type ReactNode } from "react";
import { AccessibilityInfo, Clipboard, type AccessibilityActionEvent, type ViewProps } from "react-native";

import HoldMenuView from "@/components/chat/HoldMenuView";

type Props = { children: ReactNode; copy: string; canReport: boolean; onReport: () => void };

// The native hold menu: the bubble lifts and Copy/Report show beneath it, like Messages.
export default function AnswerMenu({ children, copy, canReport, onReport }: Props) {
  const onCopy = () => Clipboard.setString(copy);

  // VoiceOver focuses the bubble, not the native menu around it, so Copy and Report are offered as actions on it.
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
    // NEEDS NATIVE BUILD: native hold menu for chat answers (modules/sirat-context-menu)
    <HoldMenuView canReport={canReport} onCopy={onCopy} onReport={onReport}>
      {accessible}
    </HoldMenuView>
  );
}
