import aestheticsData from './aesthetics.json' with { type: 'json' };

export const aesthetics = aestheticsData;

export function getDialHourMarkers() {
  return aesthetics.dial.hourMarkers;
}

export function getDialHands() {
  return aesthetics.dial.hands;
}

export function getDialSubdials() {
  return aesthetics.dial.subdials;
}

export function getLighting() {
  return aesthetics.lighting;
}

export function getCamera() {
  return aesthetics.camera;
}

export function getRendering() {
  return aesthetics.rendering;
}

export function getMaterials() {
  return aesthetics.materials;
}
