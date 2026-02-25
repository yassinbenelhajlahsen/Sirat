export {};

declare global {
  var freezeTestTime: (isoDate: string | Date) => void;
  var resetTestTime: () => void;
}
