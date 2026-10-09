import { render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import QuranDataGate from "@/components/quran/QuranDataGate";

let mockLoaded = false;
let mockResolve: () => void = () => {};
jest.mock("@/services/quranData", () => ({
  isQuranDataLoaded: () => mockLoaded,
  preloadQuranData: () =>
    new Promise<void>((resolve) => {
      mockResolve = () => {
        mockLoaded = true;
        resolve();
      };
    }),
}));

const Child = jest.fn(() => <Text>reader</Text>);

beforeEach(() => {
  mockLoaded = false;
  Child.mockClear();
});

describe("QuranDataGate", () => {
  it("does not render the reader until the Quran data has loaded", async () => {
    const { queryByText } = render(
      <QuranDataGate>
        <Child />
      </QuranDataGate>,
    );
    expect(Child).not.toHaveBeenCalled();
    expect(queryByText("reader")).toBeNull();

    mockResolve();
    await waitFor(() => expect(queryByText("reader")).toBeTruthy());
  });

  it("renders straight away when the data is already loaded", () => {
    mockLoaded = true;
    const { getByText } = render(
      <QuranDataGate>
        <Child />
      </QuranDataGate>,
    );
    expect(getByText("reader")).toBeTruthy();
  });
});
