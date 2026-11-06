import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { getChatStatus } from "@/services/chat/chatApi";
import { hasDeviceCheckModule } from "@/services/chat/deviceCheck";

type ChatStatusView = { visible: boolean; remaining: number | null };

const HIDDEN: ChatStatusView = { visible: false, remaining: null };

export function useChatStatus(): ChatStatusView {
  const [view, setView] = useState<ChatStatusView>(HIDDEN);

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
    }, []),
  );

  return view;
}
