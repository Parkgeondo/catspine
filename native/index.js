import { registerRootComponent } from 'expo';
import App from './App';

// expo-three patches THREE globals (TextDecoder, atob, etc.) used by GLTFLoader.
// Importing it once at startup is enough; keep this above any THREE usage.
import 'expo-three';

registerRootComponent(App);
