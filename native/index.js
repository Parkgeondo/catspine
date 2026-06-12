import { registerRootComponent } from 'expo';
import App from './App';

// GLTFLoader decodes the glTF JSON chunk with TextDecoder, which Hermes (RN
// 0.81 / SDK 54) provides natively — no expo-three polyfill needed. If a future
// runtime lacks it, add a TextDecoder polyfill here before any THREE usage.

registerRootComponent(App);
