module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // Reanimated 4 (Expo SDK 54) moved its Babel plugin to react-native-worklets.
      // This MUST be the last plugin. On Reanimated 3, swap for
      // 'react-native-reanimated/plugin'.
      'react-native-worklets/plugin',
    ],
  };
};
