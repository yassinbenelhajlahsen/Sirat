import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { getChatStatus } from "@/services/chat/chatApi";
import { hasDeviceCheckModule } from "@/services/chat/deviceCheck";
import { useChatDevBypass } from "@/utils/devChat";

type ChatStatusView = { visible: boolean; remaining: number | null };

const HIDDEN: ChatStatusView = { visible: false, remaining: null };

export function useChatStatus(): ChatStatusView {
  const [view, setView] = useState<ChatStatusView>(HIDDEN);
  // The dev header changes the answer, so toggling the bypass (or its startup load) must refetch.
  const devBypass = useChatDevBypass();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getChatStatus()
        .then((status) => {
          if (active) setView({ visible: status.enabled && hasDeviceCheckModule(), remaining: status.remaining });
        })
        .catch(() => {
          if (active) setView(HIDDEN);
        });
      return () => {
        active = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when the dev bypass changes
    }, [devBypass]),
  );

  return view;
}
