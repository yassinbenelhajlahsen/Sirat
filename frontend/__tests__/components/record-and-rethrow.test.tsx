import { Component, type ReactNode } from "react";
import { act, render } from "@testing-library/react-native";
import { Text } from "react-native";
import RecordAndRethrow from "@/components/RecordAndRethrow";

const mockRecordError = jest.fn();
let resolveFlush: () => void = () => {};
jest.mock("@/services/diagnostics", () => ({
  recordError: (...args: unknown[]) => mockRecordError(...args),
  flushDiagnostics: () => new Promise<void>((resolve) => { resolveFlush = resolve; }),
}));

class Outer extends Component<{ children: ReactNode }, { caught: Error | null }> {
  state = { caught: null as Error | null };
  static getDerivedStateFromError(caught: Error) { return { caught }; }
  render() {
    return this.state.caught ? <Text>{`caught ${this.state.caught.message}`}</Text> : this.props.children;
  }
}

const retry = async () => {};

it("records the error, then rethrows it once the log is saved", async () => {
  const silence = jest.spyOn(console, "error").mockImplementation(() => {});
  const err = new Error("render boom");
  const { queryByText, findByText } = render(
    <Outer>
      <RecordAndRethrow error={err} retry={retry} />
    </Outer>,
  );
  expect(mockRecordError).toHaveBeenCalledWith("render", err);
  expect(queryByText("caught render boom")).toBeNull();
  await act(async () => { resolveFlush(); });
  expect(await findByText("caught render boom")).toBeTruthy();
  silence.mockRestore();
});
