import { Text as RNText, TextProps, StyleProp, TextStyle } from "react-native";
import type { TypeStyleName } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

// Dynamic Type is on, capped so the fixed-width layouts (six arc columns, the
// calendar grid) don't fall apart at the accessibility sizes. Callers that
// need a tighter cap pass their own `maxFontSizeMultiplier`.
export const TEXT_MAX_FONT_SCALE = 1.4;

type AppTextProps = TextProps & {
  variant: TypeStyleName;
  color?: string;
  style?: StyleProp<TextStyle>;
};

export function AppText({ variant, color, style, ...rest }: AppTextProps) {
  const { theme } = useTheme();
  const t = theme.type[variant];
  return (
    <RNText
      maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
      style={[
        { fontSize: t.fontSize, lineHeight: t.lineHeight, fontWeight: t.fontWeight, color: color ?? theme.colors.white },
        style,
      ]}
      {...rest}
    />
  );
}

const make = (variant: TypeStyleName) =>
  function Variant(props: Omit<AppTextProps, "variant">) {
    return <AppText variant={variant} {...props} />;
  };

export const LargeTitle = make("largeTitle");
export const Title1 = make("title1");
export const Title2 = make("title2");
export const Title3 = make("title3");
export const Headline = make("headline");
export const Body = make("body");
export const Callout = make("callout");
export const Subhead = make("subhead");
export const Footnote = make("footnote");
export const Caption = make("caption");
