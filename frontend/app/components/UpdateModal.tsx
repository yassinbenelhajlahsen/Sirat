import { withOpacity } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { Modal, Pressable, Text, View } from "react-native";

type UpdateModalProps = {
  visible: boolean;
  isRestarting: boolean;
  onLater: () => void;
  onRestart: () => void;
};

export default function UpdateModal({
  visible,
  isRestarting,
  onLater,
  onRestart,
}: UpdateModalProps) {
  const { theme } = useTheme();
  const isLightTheme = theme.name === "light";

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onLater}
      statusBarTranslucent
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: 22,
          backgroundColor: withOpacity(theme.colors.black, isLightTheme ? 0.24 : 0.58),
        }}
      >
        <View
          style={{
            borderRadius: 18,
            borderWidth: 1,
            borderColor: withOpacity(theme.colors.accent, 0.45),
            backgroundColor: isLightTheme ? theme.colors.primaryLift : theme.colors.primaryDeep,
            paddingHorizontal: 18,
            paddingVertical: 18,
          }}
        >
          <Text
            style={{
              color: theme.colors.white,
              fontFamily: "SFProDisplay-Bold",
              fontSize: 20,
            }}
          >
            Update Ready
          </Text>

          <Text
            style={{
              marginTop: 10,
              color: withOpacity(theme.colors.white, 0.78),
              fontFamily: "SFProDisplay-Regular",
              fontSize: 15,
              lineHeight: 21,
            }}
          >
            A new version has finished downloading. Restart now to apply it.
          </Text>

          <View style={{ flexDirection: "row", marginTop: 18, gap: 10 }}>
            <Pressable
              onPress={onLater}
              style={{
                flex: 1,
                alignItems: "center",
                borderRadius: 12,
                paddingVertical: 12,
                backgroundColor: isLightTheme
                  ? theme.colors.primarySurfaceAlt
                  : withOpacity(theme.colors.white, 0.08),
              }}
            >
              <Text
                style={{
                  color: theme.colors.white,
                  fontFamily: "SFProDisplay-Semibold",
                  fontSize: 15,
                }}
              >
                Later
              </Text>
            </Pressable>

            <Pressable
              onPress={onRestart}
              style={{
                flex: 1,
                alignItems: "center",
                borderRadius: 12,
                paddingVertical: 12,
                backgroundColor: theme.colors.accent,
                opacity: isRestarting ? 0.7 : 1,
              }}
              disabled={isRestarting}
            >
              <Text
                style={{
                  color: theme.colors.onAccent,
                  fontFamily: "SFProDisplay-Semibold",
                  fontSize: 15,
                }}
              >
                {isRestarting ? "Restarting..." : "Restart"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
