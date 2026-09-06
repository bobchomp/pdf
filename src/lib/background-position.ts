export const BACKGROUND_POSITIONS = [
  "left top",
  "top",
  "right top",
  "left",
  "center",
  "right",
  "left bottom",
  "bottom",
  "right bottom",
] as const;

export type BackgroundPosition = (typeof BACKGROUND_POSITIONS)[number];
