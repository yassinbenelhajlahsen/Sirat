import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import FeedbackSheet from "@/components/settings/FeedbackSheet";
import { ThemeProvider } from "@/context/ThemeContext";

jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

const mockSubmit = jest.fn();
jest.mock("@/services/feedback", () => ({ submitFeedback: (...args: unknown[]) => mockSubmit(...args) }));

let mockEmail: string | null = null;
jest.mock("@/hooks/useAuthState", () => ({
  useAuthState: () => ({ isLoaded: true, isSignedIn: mockEmail !== null, userId: null, email: mockEmail, firstName: null }),
}));

const DISCLOSURE = "Includes diagnostic info to help us fix the issue.";

function renderSheet(props: Partial<{ onSent: jest.Mock; onClose: jest.Mock }> = {}) {
  const onSent = props.onSent ?? jest.fn();
  const onClose = props.onClose ?? jest.fn();
  const utils = render(
    <ThemeProvider>
      <FeedbackSheet visible onClose={onClose} onSent={onSent} />
    </ThemeProvider>,
  );
  return { ...utils, onSent, onClose };
}

beforeEach(() => {
  mockSubmit.mockReset();
  mockSubmit.mockResolvedValue(undefined);
  mockEmail = null;
});

it("disables Send while the message is blank", () => {
  const { getByLabelText, getByPlaceholderText } = renderSheet();
  expect(getByLabelText("Send").props.accessibilityState?.disabled).toBe(true);
  fireEvent.changeText(getByPlaceholderText("What's on your mind?"), "   ");
  expect(getByLabelText("Send").props.accessibilityState?.disabled).toBe(true);
});

it("prefills the email when signed in", () => {
  mockEmail = "me@example.com";
  const { getByPlaceholderText } = renderSheet();
  expect(getByPlaceholderText("Email (if you'd like a reply)").props.value).toBe("me@example.com");
});

it("leaves the email blank when signed out", () => {
  const { getByPlaceholderText } = renderSheet();
  expect(getByPlaceholderText("Email (if you'd like a reply)").props.value).toBe("");
});

it("shows the disclosure only for bugs", () => {
  const { getByRole, queryByText, getByPlaceholderText } = renderSheet();
  expect(queryByText(DISCLOSURE)).toBeNull();
  fireEvent.press(getByRole("radio", { name: "Bug" }));
  expect(queryByText(DISCLOSURE)).not.toBeNull();
  expect(getByPlaceholderText("What went wrong?")).toBeTruthy();
});

it("sends a bug report and calls onSent", async () => {
  const { getByRole, getByPlaceholderText, getByLabelText, onSent } = renderSheet();
  fireEvent.press(getByRole("radio", { name: "Bug" }));
  fireEvent.changeText(getByPlaceholderText("What went wrong?"), "Crash on Quran");
  await act(async () => { fireEvent.press(getByLabelText("Send")); });
  expect(mockSubmit).toHaveBeenCalledWith({ type: "bug", message: "Crash on Quran", email: "", signedIn: false });
  expect(onSent).toHaveBeenCalled();
});

it("passes the sign-in state when signed in", async () => {
  mockEmail = "me@example.com";
  const { getByRole, getByPlaceholderText, getByLabelText } = renderSheet();
  fireEvent.press(getByRole("radio", { name: "Bug" }));
  fireEvent.changeText(getByPlaceholderText("What went wrong?"), "Crash");
  await act(async () => { fireEvent.press(getByLabelText("Send")); });
  expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({ signedIn: true }));
});

it("asks for a valid email without sending", async () => {
  const { getByPlaceholderText, getByLabelText, findByText, onSent } = renderSheet();
  fireEvent.changeText(getByPlaceholderText("What's on your mind?"), "Love it");
  fireEvent.changeText(getByPlaceholderText("Email (if you'd like a reply)"), "name@gmail");
  await act(async () => { fireEvent.press(getByLabelText("Send")); });
  expect(await findByText("Check the email address.")).toBeTruthy();
  expect(mockSubmit).not.toHaveBeenCalled();
  expect(onSent).not.toHaveBeenCalled();
});

it("keeps the text and shows an error when sending fails", async () => {
  mockSubmit.mockRejectedValue(new Error("offline"));
  const { getByPlaceholderText, getByLabelText, findByText, onSent } = renderSheet();
  fireEvent.changeText(getByPlaceholderText("What's on your mind?"), "Love it");
  await act(async () => { fireEvent.press(getByLabelText("Send")); });
  expect(await findByText("Couldn't send. Please try again.")).toBeTruthy();
  expect(getByPlaceholderText("What's on your mind?").props.value).toBe("Love it");
  await waitFor(() => expect(onSent).not.toHaveBeenCalled());
});
