// Polyfill requestIdleCallback/cancelIdleCallback for browsers that don't support it
if (typeof window !== 'undefined') {
  if (!window.requestIdleCallback) {
    window.requestIdleCallback = function (cb) {
      const start = Date.now();
      return setTimeout(function () {
        cb({
          didTimeout: false,
          timeRemaining: function () {
            return Math.max(0, 50 - (Date.now() - start));
          }
        });
      }, 1);
    };
  }

  if (!window.cancelIdleCallback) {
    window.cancelIdleCallback = function (id) {
      clearTimeout(id);
    };
  }
} 