import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import CopyToast from "@/components/CopyToast";
import { ThemeProvider } from "@/context/ThemeContext";

function positionOf(placement?: "top" | "bottom") {
  const { getByText } = render(
    <ThemeProvider>
      <CopyToast visible message="Thanks, we got it" onHide={jest.fn()} placement={placement} />
    </ThemeProvider>,
  );
  let node: any = getByText("Thanks, we got it");
  while (node && StyleSheet.flatten(node.props.style)?.position !== "absolute") node = node.parent;
  return StyleSheet.flatten(node.props.style);
}

it("sits near the bottom by default", () => {
  const style = positionOf();
  expect(style.bottom).toBe(100);
  expect(style.top).toBeUndefined();
});

it("sits at the top when placement is top", () => {
  const style = positionOf("top");
  expect(style.top).toBe(16);
  expect(style.bottom).toBeUndefined();
});
