/* eslint-disable @typescript-eslint/no-unused-vars */
import "@shopify/flash-list";

declare module "@shopify/flash-list" {
  interface FlashListProps<TItem> {
    estimatedItemSize?: number;
    disableAutoLayout?: boolean;
    onScrollToIndexFailed?: (info: {
      index: number;
      averageItemLength: number;
    }) => void;
  }
}
