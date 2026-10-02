// jsdom always reports a visible document; tests switch it explicitly
let visibility: DocumentVisibilityState = 'visible';

Object.defineProperty(document, 'visibilityState', {
  configurable: true,
  get: () => visibility,
});

export function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event('visibilitychange'));
}
