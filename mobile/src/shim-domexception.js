// Polyfill DOMException for React Native Hermes engine
// This must be loaded before any LiveKit or WebRTC module
if (typeof global.DOMException === 'undefined') {
  class DOMException extends Error {
    constructor(message = '', name = 'Error') {
      super(message);
      this.name = name;
      this.message = message;
      switch (name) {
        case 'IndexSizeError': this.code = 1; break;
        case 'HierarchyRequestError': this.code = 3; break;
        case 'WrongDocumentError': this.code = 4; break;
        case 'InvalidCharacterError': this.code = 5; break;
        case 'NoModificationAllowedError': this.code = 7; break;
        case 'NotFoundError': this.code = 8; break;
        case 'NotSupportedError': this.code = 9; break;
        case 'InUseAttributeError': this.code = 10; break;
        case 'InvalidStateError': this.code = 11; break;
        case 'SyntaxError': this.code = 12; break;
        case 'InvalidModificationError': this.code = 13; break;
        case 'NamespaceError': this.code = 14; break;
        case 'InvalidAccessError': this.code = 15; break;
        case 'SecurityError': this.code = 18; break;
        case 'NetworkError': this.code = 19; break;
        case 'AbortError': this.code = 20; break;
        case 'URLMismatchError': this.code = 21; break;
        case 'QuotaExceededError': this.code = 22; break;
        case 'TimeoutError': this.code = 23; break;
        case 'InvalidNodeTypeError': this.code = 24; break;
        case 'DataCloneError': this.code = 25; break;
        default: this.code = 0; break;
      }
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, DOMException);
      }
    }
  }

  global.DOMException = DOMException;
  if (typeof globalThis !== 'undefined') {
    globalThis.DOMException = DOMException;
  }
  if (typeof window !== 'undefined') {
    window.DOMException = DOMException;
  }
}

// Polyfill WeakRef for Hermes engine (required by LiveKit Client 2.x)
if (typeof global.WeakRef === 'undefined') {
  class WeakRefPolyfill {
    constructor(target) {
      this._target = target;
    }
    deref() {
      return this._target;
    }
  }

  global.WeakRef = WeakRefPolyfill;
  if (typeof globalThis !== 'undefined') {
    globalThis.WeakRef = WeakRefPolyfill;
  }
  if (typeof window !== 'undefined') {
    window.WeakRef = WeakRefPolyfill;
  }
}

// Polyfill FinalizationRegistry for Hermes engine
if (typeof global.FinalizationRegistry === 'undefined') {
  class FinalizationRegistryPolyfill {
    constructor(cleanupCallback) {
      this._cleanupCallback = cleanupCallback;
    }
    register(target, heldValue, unregisterToken) {}
    unregister(unregisterToken) {}
  }

  global.FinalizationRegistry = FinalizationRegistryPolyfill;
  if (typeof globalThis !== 'undefined') {
    globalThis.FinalizationRegistry = FinalizationRegistryPolyfill;
  }
  if (typeof window !== 'undefined') {
    window.FinalizationRegistry = FinalizationRegistryPolyfill;
  }
}

// Fallback for performance.now()
if (typeof global.performance === 'undefined') {
  global.performance = {
    now: () => Date.now(),
  };
} else if (typeof global.performance.now === 'undefined') {
  global.performance.now = () => Date.now();
}

// Fallback for TextEncoder / TextDecoder if not provided by JS engine
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = class TextEncoder {
    encode(str = '') {
      const utf8 = unescape(encodeURIComponent(str));
      const result = new Uint8Array(utf8.length);
      for (let i = 0; i < utf8.length; i++) {
        result[i] = utf8.charCodeAt(i);
      }
      return result;
    }
  };
}

if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = class TextDecoder {
    decode(bytes) {
      if (!bytes || bytes.length === 0) return '';
      let str = '';
      for (let i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i]);
      }
      return decodeURIComponent(escape(str));
    }
  };
}
