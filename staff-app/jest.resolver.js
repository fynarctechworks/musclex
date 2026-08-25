const path = require('path');

/**
 * Strip `.native` resolution for the animation stack.
 *
 * react-native-reanimated 4 and react-native-worklets ship `.native.ts`
 * entrypoints that reach for native modules (`createShareable`, the Worklets
 * TurboModule) which do not exist under jsdom. Both ship web implementations;
 * this resolver makes jest pick those.
 *
 * react-native-worklets ships exactly this resolver for itself
 * (react-native-worklets/jest/resolver.js) — reanimated needs the same
 * treatment, and its files are what RNR's `progress` component pulls in.
 *
 * TRADE-OFF: component tests therefore exercise reanimated's WEB behaviour.
 * That is fine for "does this mount and render", which is what our tests
 * assert. Actual animation behaviour on device is NOT covered here and stays
 * on-device QA.
 *
 * @type {import('jest-resolve').SyncResolver}
 */
module.exports = (request, options) => {
  const { defaultResolver } = options;
  const animationPkg = /react-native-(worklets|reanimated)/;

  if (animationPkg.test(options.basedir) || animationPkg.test(request)) {
    return defaultResolver(request, {
      ...options,
      extensions: options.extensions?.filter((ext) => !ext.includes('native')),
    });
  }

  return defaultResolver(request, options);
};
