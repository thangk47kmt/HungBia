export type ControlsProbe = {
  setKeys: (codes: string[]) => void;
  getX: () => number;
};

declare global {
  interface Window {
    __controlsTest?: ControlsProbe;
  }
}
