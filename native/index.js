// MUST be first: patches navigator.userAgent so three's GLTFLoader doesn't
// crash on React Native. Keep above the App (→ three) import.
import './src/polyfills';

import { registerRootComponent } from 'expo';
import App from './App';

// GLTFLoader decodes the glTF JSON chunk with TextDecoder, which Hermes (RN
// 0.81 / SDK 54) provides natively — no expo-three polyfill needed.

registerRootComponent(App);
