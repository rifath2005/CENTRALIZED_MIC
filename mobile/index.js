// 1. Shims for Hermes engine (DOMException, TextEncoder/Decoder)
import './src/shim-domexception';

// 2. LiveKit React Native required globals (WebRTC RTCPeerConnection, navigator.mediaDevices, etc.)
import { registerGlobals } from '@livekit/react-native';
registerGlobals();

// 3. Application Registry
import { AppRegistry } from 'react-native';
import App from './App';

AppRegistry.registerComponent('wireless-mic-mobile', () => App);
