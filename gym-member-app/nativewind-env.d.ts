/// <reference types="nativewind/types" />

// TS6 (TS2882) requires a declaration for side-effect imports like `import './global.css'`
// (the Tailwind entry consumed by the NativeWind Metro transform).
declare module '*.css';
