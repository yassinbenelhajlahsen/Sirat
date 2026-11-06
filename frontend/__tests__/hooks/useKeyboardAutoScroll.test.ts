import { act, renderHook } from "@testing-library/react-native";
import { Keyboard } from "react-native";

let mockFocused = true;
jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused }));

import { useKeyboardAutoScroll } from "@/hooks/useKeyboardAutoScroll";

type Handler = (e?: any) => void;
let handlers: Record<string, Handler>;

beforeEach(() => {
  mockFocused = true;
  handlers = {};
  jest.spyOn(Keyboard, "addListener").mockImplementation((event: any, fn: any) => {
    handlers[event] = fn;
    return { remove: jest.fn() } as any;
  });
  jest.spyOn(global, "requestAnimationFrame").mockImplementation((cb: any) => { cb(0); return 0; });
});

afterEach(() => jest.restoreAllMocks());

function setup() {
  const hook = renderHook(() => useKeyboardAutoScroll());
  const scrollView = { scrollToEnd: jest.fn(), scrollTo: jest.fn() };
  (hook.result.current.scrollViewRef as any).current = scrollView;
  return { hook, scrollView };
}

const SHOW = { endCoordinates: { height: 300 } };

it("scrolls Home when the keyboard opens while Home is in front", () => {
  const { hook, scrollView } = setup();
  act(() => handlers.keyboardWillShow(SHOW));
  expect(scrollView.scrollToEnd).toHaveBeenCalled();
  expect(hook.result.current.keyboardHeight).toBe(300);
});

it("ignores the keyboard while another screen is on top", () => {
  mockFocused = false;
  const { hook, scrollView } = setup();
  act(() => handlers.keyboardWillShow(SHOW));
  act(() => handlers.keyboardWillHide());
  expect(scrollView.scrollToEnd).not.toHaveBeenCalled();
  expect(scrollView.scrollTo).not.toHaveBeenCalled();
  expect(hook.result.current.keyboardHeight).toBe(0);
});

it("drops the keyboard padding without scrolling if Home lost focus while the keyboard was open", () => {
  const { hook, scrollView } = setup();
  act(() => handlers.keyboardWillShow(SHOW));
  mockFocused = false;
  hook.rerender({});
  act(() => handlers.keyboardWillHide());
  expect(scrollView.scrollTo).not.toHaveBeenCalled();
  expect(hook.result.current.keyboardHeight).toBe(0);
});
