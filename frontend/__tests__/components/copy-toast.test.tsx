import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import CopyToast from "@/components/CopyToast";
import { ThemeProvider } from "@/context/ThemeContext";

function positionOf(placement?: "top" | "bottom", topOffset?: number) {
  const { getByText } = render(
    <ThemeProvider>
      <CopyToast visible message="Sent. Thank you!" onHide={jest.fn()} placement={placement} topOffset={topOffset} />
    </ThemeProvider>,
  );
  let node: any = getByText("Sent. Thank you!");
  while (node && StyleSheet.flatten(node.props.style)?.position !== "absolute") node = node.parent;
  return StyleSheet.flatten(node.props.style);
}

it("sits near the bottom by default", () => {
  const style = positionOf();
  expect(style.bottom).toBe(100);
  expect(style.top).toBeUndefined();
});

it("clears a header when given a top offset", () => {
  const style = positionOf("top", 100);
  expect(style.top).toBe(116);
});

it("sits at the top when placement is top", () => {
  const style = positionOf("top");
  expect(style.top).toBe(16);
  expect(style.bottom).toBeUndefined();
});
