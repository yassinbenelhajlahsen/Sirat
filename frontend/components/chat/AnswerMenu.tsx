import { Button, ContextMenu, Host, RNHostView } from "@expo/ui/swift-ui";
import type { ReactNode } from "react";
import { Clipboard, View } from "react-native";

type Props = { children: ReactNode; copy: string; canReport: boolean; onReport: () => void };

// The native long-press menu. Everything menu-specific stays here, so swapping to ActionSheetIOS is a one-file change.
export default function AnswerMenu({ children, copy, canReport, onReport }: Props) {
  return (
    <Host matchContents>
      <ContextMenu>
        <ContextMenu.Items>
          <Button label="Copy" systemImage="doc.on.doc" onPress={() => Clipboard.setString(copy)} />
          {canReport ? <Button label="Report" systemImage="flag" role="destructive" onPress={onReport} /> : null}
        </ContextMenu.Items>
        <ContextMenu.Trigger>
          <RNHostView matchContents>
            <View>{children}</View>
          </RNHostView>
        </ContextMenu.Trigger>
      </ContextMenu>
    </Host>
  );
}
