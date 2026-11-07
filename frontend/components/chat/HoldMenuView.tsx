// NEEDS NATIVE BUILD: native hold menu for chat answers (modules/sirat-context-menu)
import { requireNativeView, requireOptionalNativeModule } from "expo";
import type { ComponentType } from "react";
import { View, type ViewProps } from "react-native";

type Props = ViewProps & { canReport: boolean; onCopy: () => void; onReport: () => void };

// Optional probe: Android and builds without the module get the children in a plain View, with no menu.
const Native: ComponentType<Props> | null = requireOptionalNativeModule("SiratContextMenu")
  ? requireNativeView<Props>("SiratContextMenu")
  : null;

export default function HoldMenuView({ canReport, onCopy, onReport, ...rest }: Props) {
  return Native ? <Native {...rest} canReport={canReport} onCopy={onCopy} onReport={onReport} /> : <View {...rest} />;
}
