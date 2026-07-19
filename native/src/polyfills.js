// three.js GLTFLoader (and a few other loaders) assume that when `navigator`
// exists, `navigator.userAgent` is a string — it does browser-quirk detection
// like `navigator.userAgent.match(/Version\/(\d+)/)`. React Native DEFINES
// `navigator` but leaves `userAgent` undefined, so that `.match` throws
// "Cannot read property 'match' of undefined".
//
// Give it a harmless non-Safari / non-Firefox UA string. This must run before
// any GLTFLoader parse, so it is imported first in index.js.
if (typeof navigator !== 'undefined' && typeof navigator.userAgent === 'undefined') {
  try {
    navigator.userAgent = 'react-native';
  } catch {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'react-native',
      configurable: true,
      writable: true,
    });
  }
}
