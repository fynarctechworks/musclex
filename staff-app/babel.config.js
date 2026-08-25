// Metro infers babel-preset-expo without this file, but jest-expo's transform
// does not — without it, route files importing expo-router fail to parse with
// "Cannot use import statement outside a module". member-app never hit this
// because it has no tests that mount a screen.
module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
