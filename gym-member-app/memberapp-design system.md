@layer properties {
    @supports (((-webkit-hyphens: none)) and (not (margin-trim:inline))) or ((-moz-orient:inline) and (not (color:rgb(from red r g b)))) {
        *,:before,:after,::backdrop {
            --tw-translate-x:0;
            --tw-translate-y: 0;
            --tw-translate-z: 0;
            --tw-scale-x: 1;
            --tw-scale-y: 1;
            --tw-scale-z: 1;
            --tw-rotate-x: initial;
            --tw-rotate-y: initial;
            --tw-rotate-z: initial;
            --tw-skew-x: initial;
            --tw-skew-y: initial;
            --tw-pan-x: initial;
            --tw-pan-y: initial;
            --tw-pinch-zoom: initial;
            --tw-scroll-snap-strictness: proximity;
            --tw-space-y-reverse: 0;
            --tw-space-x-reverse: 0;
            --tw-divide-y-reverse: 0;
            --tw-border-style: solid;
            --tw-gradient-position: initial;
            --tw-gradient-from: #0000;
            --tw-gradient-via: #0000;
            --tw-gradient-to: #0000;
            --tw-gradient-stops: initial;
            --tw-gradient-via-stops: initial;
            --tw-gradient-from-position: 0%;
            --tw-gradient-via-position: 50%;
            --tw-gradient-to-position: 100%;
            --tw-leading: initial;
            --tw-font-weight: initial;
            --tw-tracking: initial;
            --tw-ordinal: initial;
            --tw-slashed-zero: initial;
            --tw-numeric-figure: initial;
            --tw-numeric-spacing: initial;
            --tw-numeric-fraction: initial;
            --tw-shadow: 0 0 #0000;
            --tw-shadow-color: initial;
            --tw-shadow-alpha: 100%;
            --tw-inset-shadow: 0 0 #0000;
            --tw-inset-shadow-color: initial;
            --tw-inset-shadow-alpha: 100%;
            --tw-ring-color: initial;
            --tw-ring-shadow: 0 0 #0000;
            --tw-inset-ring-color: initial;
            --tw-inset-ring-shadow: 0 0 #0000;
            --tw-ring-inset: initial;
            --tw-ring-offset-width: 0px;
            --tw-ring-offset-color: #fff;
            --tw-ring-offset-shadow: 0 0 #0000;
            --tw-outline-style: solid;
            --tw-blur: initial;
            --tw-brightness: initial;
            --tw-contrast: initial;
            --tw-grayscale: initial;
            --tw-hue-rotate: initial;
            --tw-invert: initial;
            --tw-opacity: initial;
            --tw-saturate: initial;
            --tw-sepia: initial;
            --tw-drop-shadow: initial;
            --tw-drop-shadow-color: initial;
            --tw-drop-shadow-alpha: 100%;
            --tw-drop-shadow-size: initial;
            --tw-backdrop-blur: initial;
            --tw-backdrop-brightness: initial;
            --tw-backdrop-contrast: initial;
            --tw-backdrop-grayscale: initial;
            --tw-backdrop-hue-rotate: initial;
            --tw-backdrop-invert: initial;
            --tw-backdrop-opacity: initial;
            --tw-backdrop-saturate: initial;
            --tw-backdrop-sepia: initial;
            --tw-duration: initial;
            --tw-ease: initial;
            --tw-text-shadow-color: initial;
            --tw-text-shadow-alpha: 100%;
            --tw-content: "";
            --tw-divide-x-reverse: 0
        }
    }
}

@layer theme {
    :root,:host {
        --font-sans: ui-sans-serif,system-ui,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji";
        --font-mono: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;
        --color-red-50: oklch(97.1% .013 17.38);
        --color-red-100: oklch(93.6% .032 17.717);
        --color-red-200: oklch(88.5% .062 18.334);
        --color-red-300: oklch(80.8% .114 19.571);
        --color-red-400: oklch(70.4% .191 22.216);
        --color-red-500: oklch(63.7% .237 25.331);
        --color-red-600: oklch(57.7% .245 27.325);
        --color-red-700: oklch(50.5% .213 27.518);
        --color-red-900: oklch(39.6% .141 25.723);
        --color-orange-50: oklch(98% .016 73.684);
        --color-orange-200: oklch(90.1% .076 70.697);
        --color-orange-300: oklch(83.7% .128 66.29);
        --color-orange-600: oklch(64.6% .222 41.116);
        --color-orange-700: oklch(55.3% .195 38.402);
        --color-orange-900: oklch(40.8% .123 38.172);
        --color-amber-50: oklch(98.7% .022 95.277);
        --color-amber-100: oklch(96.2% .059 95.617);
        --color-amber-200: oklch(92.4% .12 95.746);
        --color-amber-300: oklch(87.9% .169 91.605);
        --color-amber-400: oklch(82.8% .189 84.429);
        --color-amber-500: oklch(76.9% .188 70.08);
        --color-amber-600: oklch(66.6% .179 58.318);
        --color-amber-700: oklch(55.5% .163 48.998);
        --color-amber-800: oklch(47.3% .137 46.201);
        --color-amber-900: oklch(41.4% .112 45.904);
        --color-yellow-50: oklch(98.7% .026 102.212);
        --color-yellow-100: oklch(97.3% .071 103.193);
        --color-yellow-200: oklch(94.5% .129 101.54);
        --color-yellow-300: oklch(90.5% .182 98.111);
        --color-yellow-400: oklch(85.2% .199 91.936);
        --color-yellow-500: oklch(79.5% .184 86.047);
        --color-yellow-600: oklch(68.1% .162 75.834);
        --color-yellow-700: oklch(55.4% .135 66.442);
        --color-yellow-800: oklch(47.6% .114 61.907);
        --color-yellow-900: oklch(42.1% .095 57.708);
        --color-yellow-950: oklch(28.6% .066 53.813);
        --color-green-50: oklch(98.2% .018 155.826);
        --color-green-100: oklch(96.2% .044 156.743);
        --color-green-200: oklch(92.5% .084 155.995);
        --color-green-400: oklch(79.2% .209 151.711);
        --color-green-500: oklch(72.3% .219 149.579);
        --color-green-600: oklch(62.7% .194 149.214);
        --color-green-700: oklch(52.7% .154 150.069);
        --color-green-800: oklch(44.8% .119 151.328);
        --color-green-900: oklch(39.3% .095 152.535);
        --color-emerald-50: oklch(97.9% .021 166.113);
        --color-emerald-200: oklch(90.5% .093 164.15);
        --color-emerald-300: oklch(84.5% .143 164.978);
        --color-emerald-400: oklch(76.5% .177 163.223);
        --color-emerald-500: oklch(69.6% .17 162.48);
        --color-emerald-600: oklch(59.6% .145 163.225);
        --color-emerald-700: oklch(50.8% .118 165.612);
        --color-teal-50: oklch(98.4% .014 180.72);
        --color-teal-200: oklch(91% .096 180.426);
        --color-teal-300: oklch(85.5% .138 181.071);
        --color-teal-400: oklch(77.7% .152 181.912);
        --color-teal-700: oklch(51.1% .096 186.391);
        --color-teal-800: oklch(43.7% .078 188.216);
        --color-cyan-50: oklch(98.4% .019 200.873);
        --color-cyan-200: oklch(91.7% .08 205.041);
        --color-cyan-400: oklch(78.9% .154 211.53);
        --color-cyan-500: oklch(71.5% .143 215.221);
        --color-cyan-600: oklch(60.9% .126 221.723);
        --color-cyan-700: oklch(52% .105 223.128);
        --color-sky-50: oklch(97.7% .013 236.62);
        --color-sky-200: oklch(90.1% .058 230.902);
        --color-sky-300: oklch(82.8% .111 230.318);
        --color-sky-500: oklch(68.5% .169 237.323);
        --color-sky-600: oklch(58.8% .158 241.966);
        --color-sky-700: oklch(50% .134 242.749);
        --color-sky-900: oklch(39.1% .09 240.876);
        --color-blue-50: oklch(97% .014 254.604);
        --color-blue-100: oklch(93.2% .032 255.585);
        --color-blue-200: oklch(88.2% .059 254.128);
        --color-blue-300: oklch(80.9% .105 251.813);
        --color-blue-400: oklch(70.7% .165 254.624);
        --color-blue-500: oklch(62.3% .214 259.815);
        --color-blue-600: oklch(54.6% .245 262.881);
        --color-blue-700: oklch(48.8% .243 264.376);
        --color-blue-900: oklch(37.9% .146 265.522);
        --color-indigo-50: oklch(96.2% .018 272.314);
        --color-indigo-200: oklch(87% .065 274.039);
        --color-indigo-300: oklch(78.5% .115 274.713);
        --color-indigo-500: oklch(58.5% .233 277.117);
        --color-indigo-600: oklch(51.1% .262 276.966);
        --color-indigo-700: oklch(45.7% .24 277.023);
        --color-indigo-800: oklch(39.8% .195 277.366);
        --color-violet-50: oklch(96.9% .016 293.756);
        --color-violet-200: oklch(89.4% .057 293.283);
        --color-violet-700: oklch(49.1% .27 292.581);
        --color-purple-300: oklch(82.7% .119 306.383);
        --color-purple-400: oklch(71.4% .203 305.504);
        --color-purple-500: oklch(62.7% .265 303.9);
        --color-fuchsia-50: oklch(97.7% .017 320.058);
        --color-fuchsia-200: oklch(90.3% .076 319.62);
        --color-fuchsia-300: oklch(83.3% .145 321.434);
        --color-fuchsia-600: oklch(59.1% .293 322.896);
        --color-fuchsia-700: oklch(51.8% .253 323.949);
        --color-pink-50: oklch(97.1% .014 343.198);
        --color-pink-100: oklch(94.8% .028 342.258);
        --color-pink-200: oklch(89.9% .061 343.231);
        --color-pink-300: oklch(82.3% .12 346.018);
        --color-pink-400: oklch(71.8% .202 349.761);
        --color-pink-600: oklch(59.2% .249 .584);
        --color-pink-700: oklch(52.5% .223 3.958);
        --color-rose-50: oklch(96.9% .015 12.422);
        --color-rose-200: oklch(89.2% .058 10.001);
        --color-rose-300: oklch(81% .117 11.638);
        --color-rose-400: oklch(71.2% .194 13.428);
        --color-rose-500: oklch(64.5% .246 16.439);
        --color-rose-600: oklch(58.6% .253 17.585);
        --color-rose-700: oklch(51.4% .222 16.935);
        --color-rose-800: oklch(45.5% .188 13.697);
        --color-slate-50: oklch(98.4% .003 247.858);
        --color-slate-100: oklch(96.8% .007 247.896);
        --color-slate-200: oklch(92.9% .013 255.508);
        --color-slate-300: oklch(86.9% .022 252.894);
        --color-slate-400: oklch(70.4% .04 256.788);
        --color-slate-500: oklch(55.4% .046 257.417);
        --color-slate-600: oklch(44.6% .043 257.281);
        --color-slate-700: oklch(37.2% .044 257.287);
        --color-gray-50: oklch(98.5% .002 247.839);
        --color-gray-100: oklch(96.7% .003 264.542);
        --color-gray-200: oklch(92.8% .006 264.531);
        --color-gray-300: oklch(87.2% .01 258.338);
        --color-gray-400: oklch(70.7% .022 261.325);
        --color-gray-500: oklch(55.1% .027 264.364);
        --color-gray-600: oklch(44.6% .03 256.802);
        --color-gray-700: oklch(37.3% .034 259.733);
        --color-gray-900: oklch(21% .034 264.665);
        --color-neutral-50: oklch(98.5% 0 0);
        --color-neutral-100: oklch(97% 0 0);
        --color-neutral-200: oklch(92.2% 0 0);
        --color-neutral-300: oklch(87% 0 0);
        --color-neutral-400: oklch(70.8% 0 0);
        --color-neutral-500: oklch(55.6% 0 0);
        --color-neutral-600: oklch(43.9% 0 0);
        --color-neutral-700: oklch(37.1% 0 0);
        --color-neutral-800: oklch(26.9% 0 0);
        --color-neutral-900: oklch(20.5% 0 0);
        --color-stone-100: oklch(97% .001 106.424);
        --color-stone-200: oklch(92.3% .003 48.717);
        --color-stone-300: oklch(86.9% .005 56.366);
        --color-stone-400: oklch(70.9% .01 56.259);
        --color-black: #000;
        --color-white: #fff;
        --spacing: .25rem;
        --container-xs: 20rem;
        --container-sm: 24rem;
        --container-md: 28rem;
        --container-lg: 32rem;
        --container-xl: 36rem;
        --container-2xl: 42rem;
        --container-3xl: 48rem;
        --container-4xl: 56rem;
        --container-5xl: 64rem;
        --container-6xl: 72rem;
        --container-7xl: 80rem;
        --text-xs: .75rem;
        --text-xs--line-height: calc(1/.75);
        --text-sm: .875rem;
        --text-sm--line-height: calc(1.25/.875);
        --text-base: 1rem;
        --text-base--line-height: 1.5 ;
        --text-lg: 1.125rem;
        --text-lg--line-height: calc(1.75/1.125);
        --text-xl: 1.25rem;
        --text-xl--line-height: calc(1.75/1.25);
        --text-2xl: 1.5rem;
        --text-2xl--line-height: calc(2/1.5);
        --text-3xl: 1.875rem;
        --text-3xl--line-height: 1.2 ;
        --text-4xl: 2.25rem;
        --text-4xl--line-height: calc(2.5/2.25);
        --text-5xl: 3rem;
        --text-5xl--line-height: 1;
        --text-6xl: 3.75rem;
        --text-6xl--line-height: 1;
        --text-7xl: 4.5rem;
        --text-7xl--line-height: 1;
        --text-8xl: 6rem;
        --text-8xl--line-height: 1;
        --text-9xl: 8rem;
        --text-9xl--line-height: 1;
        --font-weight-thin: 100;
        --font-weight-light: 300;
        --font-weight-normal: 400;
        --font-weight-medium: 500;
        --font-weight-semibold: 600;
        --font-weight-bold: 700;
        --font-weight-extrabold: 800;
        --font-weight-black: 900;
        --tracking-tighter: -.05em;
        --tracking-tight: -.025em;
        --tracking-wide: .025em;
        --tracking-wider: .05em;
        --tracking-widest: .1em;
        --leading-tight: 1.25;
        --leading-snug: 1.375;
        --leading-normal: 1.5;
        --leading-relaxed: 1.625;
        --radius-xs: .125rem;
        --radius-sm: .25rem;
        --radius-md: .375rem;
        --radius-lg: .5rem;
        --radius-xl: .75rem;
        --radius-2xl: 1rem;
        --radius-3xl: 1.5rem;
        --radius-4xl: 2rem;
        --drop-shadow-sm: 0 1px 2px #00000026;
        --drop-shadow-md: 0 3px 3px #0000001f;
        --drop-shadow-lg: 0 4px 4px #00000026;
        --ease-in: cubic-bezier(.4,0,1,1);
        --ease-out: cubic-bezier(0,0,.2,1);
        --ease-in-out: cubic-bezier(.4,0,.2,1);
        --animate-spin: spin 1s linear infinite;
        --animate-ping: ping 1s cubic-bezier(0,0,.2,1)infinite;
        --animate-pulse: pulse 2s cubic-bezier(.4,0,.6,1)infinite;
        --blur-sm: 8px;
        --blur-md: 12px;
        --blur-lg: 16px;
        --blur-xl: 24px;
        --blur-2xl: 40px;
        --blur-3xl: 64px;
        --aspect-video: 16/9;
        --default-transition-duration: .15s;
        --default-transition-timing-function: cubic-bezier(.4,0,.2,1);
        --default-font-family: var(--font-sans);
        --default-mono-font-family: var(--font-mono);
        --color-tx: #1f1f1f;
        --color-tx-secondary: #3d3d3d;
        --color-tx-tertiary: #666;
        --color-tx-inverse: #faf8f5;
        --color-tx-brand: #29211d;
        --color-tx-accent: #c4733d;
        --color-sf: #fafafa;
        --color-sf-secondary: #f5f5f5;
        --color-sf-tertiary: #f0f0f0;
        --color-sf-quaternary: #e6e6e6;
        --color-st: #e6e6e6;
        --color-st-secondary: #f0f0f0;
        --color-br-orange: #d5650f;
        --color-br-blue: #393cc1;
        --font-matter: "Matter",sans-serif;
        --font-matter-mono: "Matter Semi Mono",monospace;
        --font-season-mix: "Season Mix",sans-serif;
        --spacing-width-mx: 1400px;
        --spacing-height-mx: 1080px;
        --color-sr-indigo-50: #fafcff;
        --color-sr-indigo-100: #e8effc;
        --color-sr-indigo-200: #d2dff9;
        --color-sr-indigo-300: #a7c0f1;
        --color-sr-indigo-400: #81a0e9;
        --color-sr-indigo-500: #6a88e2;
        --color-sr-indigo-600: #556adc;
        --color-sr-indigo-700: #4250d5;
        --color-sr-indigo-800: #33c;
        --color-sr-indigo-900: #212191;
        --color-sr-indigo-950: #11115b;
        --color-sr-orange-50: #fffbfa;
        --color-sr-orange-100: #feede6;
        --color-sr-orange-200: #fddcce;
        --color-sr-orange-300: #f9bb9e;
        --color-sr-orange-400: #f59970;
        --color-sr-orange-500: #f38858;
        --color-sr-orange-600: #ee7944;
        --color-sr-orange-700: #e96c2f;
        --color-sr-orange-800: #e6651b;
        --color-sr-orange-900: #a5460f;
        --color-sr-orange-950: #682906;
        --color-sr-green-50: #f2f8eb;
        --color-sr-green-100: #e3f1d8;
        --color-sr-green-200: #c8e4b0;
        --color-sr-green-300: #acd587;
        --color-sr-green-400: #90c85b;
        --color-sr-green-500: #83c040;
        --color-sr-green-600: #6ea335;
        --color-sr-green-700: #496d21;
        --color-sr-green-800: #385418;
        --color-sr-green-1000: #152605;
        --color-sr-pink-50: #fceaf0;
        --color-sr-pink-100: #f9d5e1;
        --color-sr-pink-200: #efabc5;
        --color-sr-pink-400: #d4508e;
        --color-sr-pink-500: #b12060;
        --color-sr-pink-600: #9d2055;
        --color-sr-pink-700: #871f4b;
        --color-sr-pink-800: #731e3f;
        --color-sr-pink-950: #4d192c;
        --color-sr-red-50: #fde7e2;
        --color-sr-red-100: #f8d1c6;
        --color-sr-red-200: #eba18f;
        --color-sr-red-300: #db715c;
        --color-sr-red-400: #c43d2b;
        --color-sr-red-500: #b81514;
        --color-sr-red-600: #a21913;
        --color-sr-red-700: #781a11;
        --color-sr-red-800: #781a11;
        --color-sr-yellow-50: #fff8e6;
        --color-sr-yellow-100: #fff0cf;
        --color-sr-yellow-200: #ffe8b7;
        --color-sr-yellow-300: #ffcb79;
        --color-sr-yellow-500: #feb12b;
        --color-sr-yellow-600: #df9c2a;
        --color-sr-yellow-700: #c08827;
        --color-sr-yellow-800: #a27224;
        --color-sr-yellow-950: #362813;
        --color-sr-grey-50: #f9f9f9;
        --color-sr-grey-100: #f5f5f5;
        --color-sr-grey-200: #f0f0f0;
        --color-sr-grey-300: #e6e6e6;
        --color-sr-grey-400: #ccc;
        --color-sr-grey-500: #b3b3b3;
        --color-sr-grey-600: #999;
        --color-sr-grey-700: #666;
        --color-sr-grey-800: #525252;
        --color-sr-grey-950: #292929;
        --color-sr-black: #141414;
        --color-sr-sf-accent-indigo: #e8effc;
        --color-sr-sf-black: #141414;
        --color-ct-primary: #141414;
        --color-ct-secondary: #666;
        --color-ct-tertiary: #999;
        --color-ct-quaternary: #b3b3b3;
        --color-ct-accent-indigo: #33c;
        --color-ct-accent-orange: #e6651b;
        --color-ct-positive-primary: #6ea335;
        --color-ct-danger-primary: #b81514
    }
}

@layer base {
    *,:after,:before,::backdrop {
        box-sizing: border-box;
        border: 0 solid;
        margin: 0;
        padding: 0
    }

    ::file-selector-button {
        box-sizing: border-box;
        border: 0 solid;
        margin: 0;
        padding: 0
    }

    html,: host {
        -webkit-text-size-adjust:100%;
        tab-size: 4;
        line-height: 1.5;
        font-family: var(--default-font-family,ui-sans-serif,system-ui,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji");
        font-feature-settings: var(--default-font-feature-settings,normal);
        font-variation-settings: var(--default-font-variation-settings,normal);
        -webkit-tap-highlight-color: transparent
    }

    hr {
        height: 0;
        color: inherit;
        border-top-width: 1px
    }

    abbr: where([title]) {
        -webkit-text-decoration:underline dotted;
        text-decoration: underline dotted
    }

    h1,h2,h3,h4,h5,h6 {
        font-size: inherit;
        font-weight: inherit
    }

    a {
        color: inherit;
        -webkit-text-decoration: inherit;
        text-decoration: inherit
    }

    b,strong {
        font-weight: bolder
    }

    code,kbd,samp,pre {
        font-family: var(--default-mono-font-family,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace);
        font-feature-settings: var(--default-mono-font-feature-settings,normal);
        font-variation-settings: var(--default-mono-font-variation-settings,normal);
        font-size: 1em
    }

    small {
        font-size: 80%
    }

    sub,sup {
        vertical-align: baseline;
        font-size: 75%;
        line-height: 0;
        position: relative
    }

    sub {
        bottom: -.25em
    }

    sup {
        top: -.5em
    }

    table {
        text-indent: 0;
        border-color: inherit;
        border-collapse: collapse
    }

    :-moz-focusring {
        outline: auto
    }

    progress {
        vertical-align: baseline
    }

    summary {
        display: list-item
    }

    ol,ul,menu {
        list-style: none
    }

    img,svg,video,canvas,audio,iframe,embed,object {
        vertical-align: middle;
        display: block
    }

    img,video {
        max-width: 100%;
        height: auto
    }

    button,input,select,optgroup,textarea {
        font: inherit;
        font-feature-settings: inherit;
        font-variation-settings: inherit;
        letter-spacing: inherit;
        color: inherit;
        opacity: 1;
        background-color: #0000;
        border-radius: 0
    }

    ::file-selector-button {
        font: inherit;
        font-feature-settings: inherit;
        font-variation-settings: inherit;
        letter-spacing: inherit;
        color: inherit;
        opacity: 1;
        background-color: #0000;
        border-radius: 0
    }

    :where(select: is([multiple],[size])) optgroup {
        font-weight:bolder
    }

    :where(select: is([multiple],[size])) optgroup option {
        padding-inline-start:20px
    }

    ::file-selector-button {
        margin-inline-end:4px}

    ::placeholder {
        opacity: 1
    }

    @supports (not ((-webkit-appearance: -apple-pay-button))) or (contain-intrinsic-size:1px) {
        ::placeholder {
            color:currentColor
        }

        @supports (color: color-mix(in lab,red,red)) {
            ::placeholder {
                color:color-mix(in oklab,currentcolor 50%,transparent)
            }
        }
    }

    textarea {
        resize: vertical
    }

    ::-webkit-search-decoration {
        -webkit-appearance: none
    }

    ::-webkit-date-and-time-value {
        min-height: 1lh;
        text-align: inherit
    }

    ::-webkit-datetime-edit {
        display: inline-flex
    }

    ::-webkit-datetime-edit-fields-wrapper {
        padding: 0
    }

    ::-webkit-datetime-edit {
        padding-block:0}

    ::-webkit-datetime-edit-year-field {
        padding-block:0}

    ::-webkit-datetime-edit-month-field {
        padding-block:0}

    ::-webkit-datetime-edit-day-field {
        padding-block:0}

    ::-webkit-datetime-edit-hour-field {
        padding-block:0}

    ::-webkit-datetime-edit-minute-field {
        padding-block:0}

    ::-webkit-datetime-edit-second-field {
        padding-block:0}

    ::-webkit-datetime-edit-millisecond-field {
        padding-block:0}

    ::-webkit-datetime-edit-meridiem-field {
        padding-block:0}

    ::-webkit-calendar-picker-indicator {
        line-height: 1
    }

    :-moz-ui-invalid {
        box-shadow: none
    }

    button,input: where([type=button],[type=reset],[type=submit]) {
        appearance:button
    }

    ::file-selector-button {
        appearance: button
    }

    ::-webkit-inner-spin-button {
        height: auto
    }

    ::-webkit-outer-spin-button {
        height: auto
    }

    [hidden]: where(:not([hidden=until-found])) {
        display:none!important
    }
}

@layer components;@layer utilities {
    .pointer-events-auto {
        pointer-events: auto
    }

    .pointer-events-none {
        pointer-events: none
    }

    .collapse {
        visibility: collapse
    }

    .invisible {
        visibility: hidden
    }

    .visible {
        visibility: visible
    }

    .sr-only {
        clip-path: inset(50%);
        white-space: nowrap;
        border-width: 0;
        width: 1px;
        height: 1px;
        margin: -1px;
        padding: 0;
        position: absolute;
        overflow: hidden
    }

    .absolute {
        position: absolute
    }

    .fixed {
        position: fixed
    }

    .relative {
        position: relative
    }

    .static {
        position: static
    }

    .sticky {
        position: sticky
    }

    .inset-0 {
        inset: calc(var(--spacing)*0)
    }

    .inset-\[-0\.5px\] {
        inset: -.5px
    }

    .inset-\[-1px\] {
        inset: -1px
    }

    .inset-\[-4px\] {
        inset: -4px
    }

    .inset-\[-8\%\] {
        inset: -8%
    }

    .inset-\[-12\%\] {
        inset: -12%
    }

    .inset-\[-40\%\] {
        inset: -40%
    }

    .inset-\[-100\%\] {
        inset: -100%
    }

    .inset-\[3px\] {
        inset: 3px
    }

    .inset-\[8\%\] {
        inset: 8%
    }

    .inset-x-0 {
        inset-inline: calc(var(--spacing)*0)
    }

    .inset-x-4 {
        inset-inline: calc(var(--spacing)*4)
    }

    .inset-x-5 {
        inset-inline: calc(var(--spacing)*5)
    }

    .inset-x-\[2px\] {
        inset-inline: 2px
    }

    .inset-y-0 {
        inset-block: calc(var(--spacing)*0)
    }

    .-top-2 {
        top: calc(var(--spacing)*-2)
    }

    .-top-5 {
        top: calc(var(--spacing)*-5)
    }

    .-top-6 {
        top: calc(var(--spacing)*-6)
    }

    .-top-7 {
        top: calc(var(--spacing)*-7)
    }

    .-top-8 {
        top: calc(var(--spacing)*-8)
    }

    .-top-9 {
        top: calc(var(--spacing)*-9)
    }

    .-top-24 {
        top: calc(var(--spacing)*-24)
    }

    .top-0 {
        top: calc(var(--spacing)*0)
    }

    .top-1 {
        top: calc(var(--spacing)*1)
    }

    .top-1\/2 {
        top: 50%
    }

    .top-1\/4 {
        top: 25%
    }

    .top-2 {
        top: calc(var(--spacing)*2)
    }

    .top-2\.5 {
        top: calc(var(--spacing)*2.5)
    }

    .top-3 {
        top: calc(var(--spacing)*3)
    }

    .top-4 {
        top: calc(var(--spacing)*4)
    }

    .top-5 {
        top: calc(var(--spacing)*5)
    }

    .top-6 {
        top: calc(var(--spacing)*6)
    }

    .top-8 {
        top: calc(var(--spacing)*8)
    }

    .top-10 {
        top: calc(var(--spacing)*10)
    }

    .top-14 {
        top: calc(var(--spacing)*14)
    }

    .top-24 {
        top: calc(var(--spacing)*24)
    }

    .top-28 {
        top: calc(var(--spacing)*28)
    }

    .top-\[-90\%\] {
        top: -90%
    }

    .top-\[-120\%\] {
        top: -120%
    }

    .top-\[-150\%\] {
        top: -150%
    }

    .top-\[8\%\] {
        top: 8%
    }

    .top-\[10px\] {
        top: 10px
    }

    .top-\[12\.5vh\] {
        top: 12.5vh
    }

    .top-\[12px\] {
        top: 12px
    }

    .top-\[28\%\] {
        top: 28%
    }

    .top-\[28px\] {
        top: 28px
    }

    .top-\[50\%\] {
        top: 50%
    }

    .top-\[50px\] {
        top: 50px
    }

    .top-\[54\%\] {
        top: 54%
    }

    .top-\[55\%\] {
        top: 55%
    }

    .top-\[110px\] {
        top: 110px
    }

    .top-\[155px\] {
        top: 155px
    }

    .top-\[175px\] {
        top: 175px
    }

    .top-\[220px\] {
        top: 220px
    }

    .top-\[225px\] {
        top: 225px
    }

    .top-\[302px\] {
        top: 302px
    }

    .top-\[calc\(100\%\+0\.375rem\)\] {
        top: calc(100% + .375rem)
    }

    .top-full {
        top: 100%
    }

    .-right-2 {
        right: calc(var(--spacing)*-2)
    }

    .-right-5 {
        right: calc(var(--spacing)*-5)
    }

    .-right-6 {
        right: calc(var(--spacing)*-6)
    }

    .-right-8 {
        right: calc(var(--spacing)*-8)
    }

    .-right-12 {
        right: calc(var(--spacing)*-12)
    }

    .-right-\[2px\] {
        right: -2px
    }

    .-right-\[10vw\] {
        right: -10vw
    }

    .-right-\[60px\] {
        right: -60px
    }

    .right-0 {
        right: calc(var(--spacing)*0)
    }

    .right-1\.5 {
        right: calc(var(--spacing)*1.5)
    }

    .right-1\/12 {
        right: 8.33333%
    }

    .right-2 {
        right: calc(var(--spacing)*2)
    }

    .right-2\.5 {
        right: calc(var(--spacing)*2.5)
    }

    .right-3 {
        right: calc(var(--spacing)*3)
    }

    .right-3\.5 {
        right: calc(var(--spacing)*3.5)
    }

    .right-4 {
        right: calc(var(--spacing)*4)
    }

    .right-5 {
        right: calc(var(--spacing)*5)
    }

    .right-6 {
        right: calc(var(--spacing)*6)
    }

    .right-8 {
        right: calc(var(--spacing)*8)
    }

    .right-10 {
        right: calc(var(--spacing)*10)
    }

    .right-\[-8\%\] {
        right: -8%
    }

    .right-\[-10px\] {
        right: -10px
    }

    .right-\[16px\] {
        right: 16px
    }

    .-bottom-1 {
        bottom: calc(var(--spacing)*-1)
    }

    .-bottom-2 {
        bottom: calc(var(--spacing)*-2)
    }

    .-bottom-4 {
        bottom: calc(var(--spacing)*-4)
    }

    .-bottom-8 {
        bottom: calc(var(--spacing)*-8)
    }

    .-bottom-14 {
        bottom: calc(var(--spacing)*-14)
    }

    .bottom-0 {
        bottom: calc(var(--spacing)*0)
    }

    .bottom-1 {
        bottom: calc(var(--spacing)*1)
    }

    .bottom-2 {
        bottom: calc(var(--spacing)*2)
    }

    .bottom-2\.5 {
        bottom: calc(var(--spacing)*2.5)
    }

    .bottom-3 {
        bottom: calc(var(--spacing)*3)
    }

    .bottom-4 {
        bottom: calc(var(--spacing)*4)
    }

    .bottom-5 {
        bottom: calc(var(--spacing)*5)
    }

    .bottom-6 {
        bottom: calc(var(--spacing)*6)
    }

    .bottom-8 {
        bottom: calc(var(--spacing)*8)
    }

    .bottom-10 {
        bottom: calc(var(--spacing)*10)
    }

    .bottom-12 {
        bottom: calc(var(--spacing)*12)
    }

    .bottom-14 {
        bottom: calc(var(--spacing)*14)
    }

    .bottom-24 {
        bottom: calc(var(--spacing)*24)
    }

    .bottom-32 {
        bottom: calc(var(--spacing)*32)
    }

    .bottom-\[-16px\] {
        bottom: -16px
    }

    .bottom-\[-20px\] {
        bottom: -20px
    }

    .bottom-\[4\.5rem\] {
        bottom: 4.5rem
    }

    .bottom-\[6\%\] {
        bottom: 6%
    }

    .bottom-\[8px\] {
        bottom: 8px
    }

    .bottom-\[12px\] {
        bottom: 12px
    }

    .bottom-\[14\%\] {
        bottom: 14%
    }

    .bottom-\[40\%\] {
        bottom: 40%
    }

    .bottom-\[50px\] {
        bottom: 50px
    }

    .bottom-full {
        bottom: 100%
    }

    .-left-2 {
        left: calc(var(--spacing)*-2)
    }

    .-left-4 {
        left: calc(var(--spacing)*-4)
    }

    .-left-9 {
        left: calc(var(--spacing)*-9)
    }

    .-left-\[2px\] {
        left: -2px
    }

    .-left-\[10vw\] {
        left: -10vw
    }

    .-left-\[60px\] {
        left: -60px
    }

    .left-0 {
        left: calc(var(--spacing)*0)
    }

    .left-1\.5 {
        left: calc(var(--spacing)*1.5)
    }

    .left-1\/2 {
        left: 50%
    }

    .left-1\/12 {
        left: 8.33333%
    }

    .left-2 {
        left: calc(var(--spacing)*2)
    }

    .left-2\.5 {
        left: calc(var(--spacing)*2.5)
    }

    .left-3 {
        left: calc(var(--spacing)*3)
    }

    .left-3\.5 {
        left: calc(var(--spacing)*3.5)
    }

    .left-4 {
        left: calc(var(--spacing)*4)
    }

    .left-5 {
        left: calc(var(--spacing)*5)
    }

    .left-6 {
        left: calc(var(--spacing)*6)
    }

    .left-8 {
        left: calc(var(--spacing)*8)
    }

    .left-10 {
        left: calc(var(--spacing)*10)
    }

    .left-14 {
        left: calc(var(--spacing)*14)
    }

    .left-\[-7\%\] {
        left: -7%
    }

    .left-\[16px\] {
        left: 16px
    }

    .left-\[20\%\] {
        left: 20%
    }

    .left-\[80\%\] {
        left: 80%
    }

    .left-\[calc\(50\%-338px\)\] {
        left: calc(50% - 338px)
    }

    .isolate {
        isolation: isolate
    }

    .-z-0 {
        z-index: -0
    }

    .-z-1 {
        z-index: -1
    }

    .-z-10 {
        z-index: -10
    }

    .-z-40 {
        z-index: -40
    }

    .z-0 {
        z-index: 0
    }

    .z-1 {
        z-index: 1
    }

    .z-2 {
        z-index: 2
    }

    .z-3 {
        z-index: 3
    }

    .z-10 {
        z-index: 10
    }

    .z-20 {
        z-index: 20
    }

    .z-30 {
        z-index: 30
    }

    .z-40 {
        z-index: 40
    }

    .z-50 {
        z-index: 50
    }

    .z-100 {
        z-index: 100
    }

    .z-10000 {
        z-index: 10000
    }

    .z-99999 {
        z-index: 99999
    }

    .z-\[0\] {
        z-index: 0
    }

    .z-\[1\] {
        z-index: 1
    }

    .z-\[2\] {
        z-index: 2
    }

    .z-\[3\] {
        z-index: 3
    }

    .z-\[100\] {
        z-index: 100
    }

    .z-\[9999\] {
        z-index: 9999
    }

    .z-\[10000\] {
        z-index: 10000
    }

    .z-\[10001\] {
        z-index: 10001
    }

    .z-\[99999\] {
        z-index: 99999
    }

    .order-1 {
        order: 1
    }

    .order-2 {
        order: 2
    }

    .order-3 {
        order: 3
    }

    .order-4 {
        order: 4
    }

    .order-5 {
        order: 5
    }

    .order-first {
        order: -9999
    }

    .col-span-2 {
        grid-column: span 2/span 2
    }

    .col-span-12 {
        grid-column: span 12/span 12
    }

    .col-span-full {
        grid-column: 1/-1
    }

    .col-start-2 {
        grid-column-start: 2
    }

    .row-span-2 {
        grid-row: span 2/span 2
    }

    .container {
        width: 100%
    }

    @media(min-width: 40rem) {
        .container {
            max-width:40rem
        }
    }

    @media(min-width: 48rem) {
        .container {
            max-width:48rem
        }
    }

    @media(min-width: 64rem) {
        .container {
            max-width:64rem
        }
    }

    @media(min-width: 80rem) {
        .container {
            max-width:80rem
        }
    }

    @media(min-width: 96rem) {
        .container {
            max-width:96rem
        }
    }

    .-m-1 {
        margin: calc(var(--spacing)*-1)
    }

    .-m-2\.5 {
        margin: calc(var(--spacing)*-2.5)
    }

    .-m-3 {
        margin: calc(var(--spacing)*-3)
    }

    .-m-6 {
        margin: calc(var(--spacing)*-6)
    }

    .m-0 {
        margin: calc(var(--spacing)*0)
    }

    .m-auto {
        margin: auto
    }

    .-mx-0\.5 {
        margin-inline: calc(var(--spacing)*-.5)
    }

    .-mx-1 {
        margin-inline:calc(var(--spacing)*-1)}

    .-mx-2 {
        margin-inline: calc(var(--spacing)*-2)
    }

    .-mx-4 {
        margin-inline:calc(var(--spacing)*-4)}

    .-mx-5 {
        margin-inline: calc(var(--spacing)*-5)
    }

    .-mx-\[calc\(\(100vw-100\%\)\/2\)\] {
        margin-inline: calc(50% - 50vw)
    }

    .mx-0 {
        margin-inline:calc(var(--spacing)*0)}

    .mx-0\.5 {
        margin-inline: calc(var(--spacing)*.5)
    }

    .mx-1 {
        margin-inline:calc(var(--spacing)*1)}

    .mx-1\.5 {
        margin-inline: calc(var(--spacing)*1.5)
    }

    .mx-2 {
        margin-inline:calc(var(--spacing)*2)}

    .mx-2\.5 {
        margin-inline: calc(var(--spacing)*2.5)
    }

    .mx-4 {
        margin-inline:calc(var(--spacing)*4)}

    .mx-5 {
        margin-inline: calc(var(--spacing)*5)
    }

    .mx-6 {
        margin-inline:calc(var(--spacing)*6)}

    .mx-auto {
        margin-inline: auto
    }

    .my-1 {
        margin-block:calc(var(--spacing)*1)}

    .my-2 {
        margin-block: calc(var(--spacing)*2)
    }

    .my-3 {
        margin-block:calc(var(--spacing)*3)}

    .my-4 {
        margin-block: calc(var(--spacing)*4)
    }

    .my-5 {
        margin-block:calc(var(--spacing)*5)}

    .my-6 {
        margin-block: calc(var(--spacing)*6)
    }

    .my-8 {
        margin-block:calc(var(--spacing)*8)}

    .my-10 {
        margin-block: calc(var(--spacing)*10)
    }

    .my-12 {
        margin-block:calc(var(--spacing)*12)}

    .my-16 {
        margin-block: calc(var(--spacing)*16)
    }

    .my-auto {
        margin-block:auto}

    .-mt-1 {
        margin-top: calc(var(--spacing)*-1)
    }

    .-mt-2 {
        margin-top: calc(var(--spacing)*-2)
    }

    .-mt-3 {
        margin-top: calc(var(--spacing)*-3)
    }

    .-mt-6 {
        margin-top: calc(var(--spacing)*-6)
    }

    .-mt-8 {
        margin-top: calc(var(--spacing)*-8)
    }

    .-mt-10 {
        margin-top: calc(var(--spacing)*-10)
    }

    .-mt-12 {
        margin-top: calc(var(--spacing)*-12)
    }

    .-mt-20 {
        margin-top: calc(var(--spacing)*-20)
    }

    .-mt-24 {
        margin-top: calc(var(--spacing)*-24)
    }

    .mt-0 {
        margin-top: calc(var(--spacing)*0)
    }

    .mt-0\.5 {
        margin-top: calc(var(--spacing)*.5)
    }

    .mt-1 {
        margin-top: calc(var(--spacing)*1)
    }

    .mt-1\.5 {
        margin-top: calc(var(--spacing)*1.5)
    }

    .mt-2 {
        margin-top: calc(var(--spacing)*2)
    }

    .mt-2\.5 {
        margin-top: calc(var(--spacing)*2.5)
    }

    .mt-3 {
        margin-top: calc(var(--spacing)*3)
    }

    .mt-3\.5 {
        margin-top: calc(var(--spacing)*3.5)
    }

    .mt-4 {
        margin-top: calc(var(--spacing)*4)
    }

    .mt-5 {
        margin-top: calc(var(--spacing)*5)
    }

    .mt-6 {
        margin-top: calc(var(--spacing)*6)
    }

    .mt-7 {
        margin-top: calc(var(--spacing)*7)
    }

    .mt-8 {
        margin-top: calc(var(--spacing)*8)
    }

    .mt-9 {
        margin-top: calc(var(--spacing)*9)
    }

    .mt-10 {
        margin-top: calc(var(--spacing)*10)
    }

    .mt-12 {
        margin-top: calc(var(--spacing)*12)
    }

    .mt-14 {
        margin-top: calc(var(--spacing)*14)
    }

    .mt-16 {
        margin-top: calc(var(--spacing)*16)
    }

    .mt-20 {
        margin-top: calc(var(--spacing)*20)
    }

    .mt-24 {
        margin-top: calc(var(--spacing)*24)
    }

    .mt-32 {
        margin-top: calc(var(--spacing)*32)
    }

    .mt-40 {
        margin-top: calc(var(--spacing)*40)
    }

    .mt-\[7px\] {
        margin-top: 7px
    }

    .mt-auto {
        margin-top: auto
    }

    .-mr-6 {
        margin-right: calc(var(--spacing)*-6)
    }

    .mr-0\.5 {
        margin-right: calc(var(--spacing)*.5)
    }

    .mr-1 {
        margin-right: calc(var(--spacing)*1)
    }

    .mr-2 {
        margin-right: calc(var(--spacing)*2)
    }

    .mr-3 {
        margin-right: calc(var(--spacing)*3)
    }

    .mr-4 {
        margin-right: calc(var(--spacing)*4)
    }

    .mr-10 {
        margin-right: calc(var(--spacing)*10)
    }

    .-mb-1 {
        margin-bottom: calc(var(--spacing)*-1)
    }

    .-mb-2 {
        margin-bottom: calc(var(--spacing)*-2)
    }

    .-mb-4 {
        margin-bottom: calc(var(--spacing)*-4)
    }

    .-mb-6 {
        margin-bottom: calc(var(--spacing)*-6)
    }

    .-mb-16 {
        margin-bottom: calc(var(--spacing)*-16)
    }

    .-mb-20 {
        margin-bottom: calc(var(--spacing)*-20)
    }

    .-mb-32 {
        margin-bottom: calc(var(--spacing)*-32)
    }

    .-mb-40 {
        margin-bottom: calc(var(--spacing)*-40)
    }

    .-mb-\[40px\] {
        margin-bottom: -40px
    }

    .-mb-px {
        margin-bottom: -1px
    }

    .mb-0 {
        margin-bottom: calc(var(--spacing)*0)
    }

    .mb-0\.5 {
        margin-bottom: calc(var(--spacing)*.5)
    }

    .mb-1 {
        margin-bottom: calc(var(--spacing)*1)
    }

    .mb-1\.5 {
        margin-bottom: calc(var(--spacing)*1.5)
    }

    .mb-2 {
        margin-bottom: calc(var(--spacing)*2)
    }

    .mb-2\.5 {
        margin-bottom: calc(var(--spacing)*2.5)
    }

    .mb-3 {
        margin-bottom: calc(var(--spacing)*3)
    }

    .mb-3\.5 {
        margin-bottom: calc(var(--spacing)*3.5)
    }

    .mb-4 {
        margin-bottom: calc(var(--spacing)*4)
    }

    .mb-5 {
        margin-bottom: calc(var(--spacing)*5)
    }

    .mb-6 {
        margin-bottom: calc(var(--spacing)*6)
    }

    .mb-7 {
        margin-bottom: calc(var(--spacing)*7)
    }

    .mb-8 {
        margin-bottom: calc(var(--spacing)*8)
    }

    .mb-9 {
        margin-bottom: calc(var(--spacing)*9)
    }

    .mb-10 {
        margin-bottom: calc(var(--spacing)*10)
    }

    .mb-12 {
        margin-bottom: calc(var(--spacing)*12)
    }

    .mb-14 {
        margin-bottom: calc(var(--spacing)*14)
    }

    .mb-16 {
        margin-bottom: calc(var(--spacing)*16)
    }

    .mb-20 {
        margin-bottom: calc(var(--spacing)*20)
    }

    .mb-\[1px\] {
        margin-bottom: 1px
    }

    .mb-\[2px\] {
        margin-bottom: 2px
    }

    .-ml-1 {
        margin-left: calc(var(--spacing)*-1)
    }

    .-ml-2 {
        margin-left: calc(var(--spacing)*-2)
    }

    .ml-0 {
        margin-left: calc(var(--spacing)*0)
    }

    .ml-0\.5 {
        margin-left: calc(var(--spacing)*.5)
    }

    .ml-1 {
        margin-left: calc(var(--spacing)*1)
    }

    .ml-1\.5 {
        margin-left: calc(var(--spacing)*1.5)
    }

    .ml-2 {
        margin-left: calc(var(--spacing)*2)
    }

    .ml-2\.5 {
        margin-left: calc(var(--spacing)*2.5)
    }

    .ml-3 {
        margin-left: calc(var(--spacing)*3)
    }

    .ml-4 {
        margin-left: calc(var(--spacing)*4)
    }

    .ml-9 {
        margin-left: calc(var(--spacing)*9)
    }

    .ml-auto {
        margin-left: auto
    }

    .ml-px {
        margin-left: 1px
    }

    .box-border {
        box-sizing: border-box
    }

    .line-clamp-1 {
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        display: -webkit-box;
        overflow: hidden
    }

    .line-clamp-2 {
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        display: -webkit-box;
        overflow: hidden
    }

    .line-clamp-3 {
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        display: -webkit-box;
        overflow: hidden
    }

    .line-clamp-4 {
        -webkit-line-clamp: 4;
        -webkit-box-orient: vertical;
        display: -webkit-box;
        overflow: hidden
    }

    .block {
        display: block
    }

    .contents {
        display: contents
    }

    .flex {
        display: flex
    }

    .grid {
        display: grid
    }

    .hidden {
        display: none
    }

    .inline {
        display: inline
    }

    .inline-block {
        display: inline-block
    }

    .inline-flex {
        display: inline-flex
    }

    .table {
        display: table
    }

    .aspect-3\/4 {
        aspect-ratio: 3/4
    }

    .aspect-4\/3 {
        aspect-ratio: 4/3
    }

    .aspect-\[1\/1\.4\] {
        aspect-ratio: 1/1.4
    }

    .aspect-\[4\/3\] {
        aspect-ratio: 4/3
    }

    .aspect-\[21\/9\] {
        aspect-ratio: 21/9
    }

    .aspect-\[202\/32\] {
        aspect-ratio: 202/32
    }

    .aspect-\[448\/220\] {
        aspect-ratio: 448/220
    }

    .aspect-\[506\/600\] {
        aspect-ratio: 506/600
    }

    .aspect-auto {
        aspect-ratio: auto
    }

    .aspect-square {
        aspect-ratio: 1
    }

    .aspect-video {
        aspect-ratio: var(--aspect-video)
    }

    .size-5 {
        width: calc(var(--spacing)*5);
        height: calc(var(--spacing)*5)
    }

    .size-6 {
        width: calc(var(--spacing)*6);
        height: calc(var(--spacing)*6)
    }

    .size-8 {
        width: calc(var(--spacing)*8);
        height: calc(var(--spacing)*8)
    }

    .size-9 {
        width: calc(var(--spacing)*9);
        height: calc(var(--spacing)*9)
    }

    .size-10 {
        width: calc(var(--spacing)*10);
        height: calc(var(--spacing)*10)
    }

    .size-14 {
        width: calc(var(--spacing)*14);
        height: calc(var(--spacing)*14)
    }

    .size-16 {
        width: calc(var(--spacing)*16);
        height: calc(var(--spacing)*16)
    }

    .size-24 {
        width: calc(var(--spacing)*24);
        height: calc(var(--spacing)*24)
    }

    .size-\[3px\] {
        width: 3px;
        height: 3px
    }

    .size-\[22px\] {
        width: 22px;
        height: 22px
    }

    .size-\[28px\] {
        width: 28px;
        height: 28px
    }

    .size-\[52px\] {
        width: 52px;
        height: 52px
    }

    .size-\[100px\] {
        width: 100px;
        height: 100px
    }

    .size-\[160px\] {
        width: 160px;
        height: 160px
    }

    .size-\[200px\] {
        width: 200px;
        height: 200px
    }

    .size-full {
        width: 100%;
        height: 100%
    }

    .h-0\.5 {
        height: calc(var(--spacing)*.5)
    }

    .h-1 {
        height: calc(var(--spacing)*1)
    }

    .h-1\.5 {
        height: calc(var(--spacing)*1.5)
    }

    .h-1\/2 {
        height: 50%
    }

    .h-1\/5 {
        height: 20%
    }

    .h-2 {
        height: calc(var(--spacing)*2)
    }

    .h-2\.5 {
        height: calc(var(--spacing)*2.5)
    }

    .h-3 {
        height: calc(var(--spacing)*3)
    }

    .h-3\.5 {
        height: calc(var(--spacing)*3.5)
    }

    .h-4 {
        height: calc(var(--spacing)*4)
    }

    .h-4\.5 {
        height: calc(var(--spacing)*4.5)
    }

    .h-5 {
        height: calc(var(--spacing)*5)
    }

    .h-5\.5 {
        height: calc(var(--spacing)*5.5)
    }

    .h-6 {
        height: calc(var(--spacing)*6)
    }

    .h-7 {
        height: calc(var(--spacing)*7)
    }

    .h-8 {
        height: calc(var(--spacing)*8)
    }

    .h-8\! {
        height: calc(var(--spacing)*8)!important
    }

    .h-8\.5 {
        height: calc(var(--spacing)*8.5)
    }

    .h-9 {
        height: calc(var(--spacing)*9)
    }

    .h-10 {
        height: calc(var(--spacing)*10)
    }

    .h-10\! {
        height: calc(var(--spacing)*10)!important
    }

    .h-11 {
        height: calc(var(--spacing)*11)
    }

    .h-12 {
        height: calc(var(--spacing)*12)
    }

    .h-14 {
        height: calc(var(--spacing)*14)
    }

    .h-14\! {
        height: calc(var(--spacing)*14)!important
    }

    .h-15 {
        height: calc(var(--spacing)*15)
    }

    .h-16 {
        height: calc(var(--spacing)*16)
    }

    .h-20 {
        height: calc(var(--spacing)*20)
    }

    .h-20\! {
        height: calc(var(--spacing)*20)!important
    }

    .h-24 {
        height: calc(var(--spacing)*24)
    }

    .h-28 {
        height: calc(var(--spacing)*28)
    }

    .h-36 {
        height: calc(var(--spacing)*36)
    }

    .h-40 {
        height: calc(var(--spacing)*40)
    }

    .h-48 {
        height: calc(var(--spacing)*48)
    }

    .h-60 {
        height: calc(var(--spacing)*60)
    }

    .h-64 {
        height: calc(var(--spacing)*64)
    }

    .h-72 {
        height: calc(var(--spacing)*72)
    }

    .h-80 {
        height: calc(var(--spacing)*80)
    }

    .h-96 {
        height: calc(var(--spacing)*96)
    }

    .h-\[0\.8em\] {
        height: .8em
    }

    .h-\[1\.2em\] {
        height: 1.2em
    }

    .h-\[1\.5px\] {
        height: 1.5px
    }

    .h-\[1em\] {
        height: 1em
    }

    .h-\[1px\] {
        height: 1px
    }

    .h-\[2px\] {
        height: 2px
    }

    .h-\[3px\] {
        height: 3px
    }

    .h-\[4px\] {
        height: 4px
    }

    .h-\[7px\] {
        height: 7px
    }

    .h-\[10px\] {
        height: 10px
    }

    .h-\[12px\] {
        height: 12px
    }

    .h-\[14px\] {
        height: 14px
    }

    .h-\[15px\] {
        height: 15px
    }

    .h-\[18px\] {
        height: 18px
    }

    .h-\[20px\] {
        height: 20px
    }

    .h-\[22px\] {
        height: 22px
    }

    .h-\[26\.667px\] {
        height: 26.667px
    }

    .h-\[28px\] {
        height: 28px
    }

    .h-\[30\%\] {
        height: 30%
    }

    .h-\[30px\] {
        height: 30px
    }

    .h-\[32px\] {
        height: 32px
    }

    .h-\[36px\] {
        height: 36px
    }

    .h-\[40px\] {
        height: 40px
    }

    .h-\[44px\] {
        height: 44px
    }

    .h-\[45px\] {
        height: 45px
    }

    .h-\[46px\] {
        height: 46px
    }

    .h-\[50px\] {
        height: 50px
    }

    .h-\[52px\] {
        height: 52px
    }

    .h-\[54px\] {
        height: 54px
    }

    .h-\[60vh\] {
        height: 60vh
    }

    .h-\[68px\] {
        height: 68px
    }

    .h-\[72px\] {
        height: 72px
    }

    .h-\[75\%\] {
        height: 75%
    }

    .h-\[80px\] {
        height: 80px
    }

    .h-\[84px\] {
        height: 84px
    }

    .h-\[88px\] {
        height: 88px
    }

    .h-\[90\%\] {
        height: 90%
    }

    .h-\[100px\] {
        height: 100px
    }

    .h-\[112px\] {
        height: 112px
    }

    .h-\[120px\] {
        height: 120px
    }

    .h-\[135px\] {
        height: 135px
    }

    .h-\[136px\] {
        height: 136px
    }

    .h-\[140px\] {
        height: 140px
    }

    .h-\[180px\] {
        height: 180px
    }

    .h-\[185px\] {
        height: 185px
    }

    .h-\[200px\] {
        height: 200px
    }

    .h-\[200vh\] {
        height: 200vh
    }

    .h-\[220px\] {
        height: 220px
    }

    .h-\[240px\] {
        height: 240px
    }

    .h-\[250px\] {
        height: 250px
    }

    .h-\[260px\] {
        height: 260px
    }

    .h-\[278px\] {
        height: 278px
    }

    .h-\[280px\] {
        height: 280px
    }

    .h-\[300px\] {
        height: 300px
    }

    .h-\[320px\] {
        height: 320px
    }

    .h-\[340px\] {
        height: 340px
    }

    .h-\[360px\] {
        height: 360px
    }

    .h-\[380px\] {
        height: 380px
    }

    .h-\[400px\] {
        height: 400px
    }

    .h-\[420px\] {
        height: 420px
    }

    .h-\[460px\] {
        height: 460px
    }

    .h-\[480px\] {
        height: 480px
    }

    .h-\[501px\] {
        height: 501px
    }

    .h-\[540px\] {
        height: 540px
    }

    .h-\[550px\] {
        height: 550px
    }

    .h-\[560px\] {
        height: 560px
    }

    .h-\[620px\] {
        height: 620px
    }

    .h-\[650px\] {
        height: 650px
    }

    .h-\[calc\(100\%-8px\)\] {
        height: calc(100% - 8px)
    }

    .h-auto {
        height: auto
    }

    .h-fit {
        height: fit-content
    }

    .h-full {
        height: 100%
    }

    .h-px {
        height: 1px
    }

    .h-screen {
        height: 100vh
    }

    .h-svh {
        height: 100svh
    }

    .max-h-0 {
        max-height: calc(var(--spacing)*0)
    }

    .max-h-16 {
        max-height: calc(var(--spacing)*16)
    }

    .max-h-20 {
        max-height: calc(var(--spacing)*20)
    }

    .max-h-24 {
        max-height: calc(var(--spacing)*24)
    }

    .max-h-32 {
        max-height: calc(var(--spacing)*32)
    }

    .max-h-40 {
        max-height: calc(var(--spacing)*40)
    }

    .max-h-48 {
        max-height: calc(var(--spacing)*48)
    }

    .max-h-52 {
        max-height: calc(var(--spacing)*52)
    }

    .max-h-64 {
        max-height: calc(var(--spacing)*64)
    }

    .max-h-72 {
        max-height: calc(var(--spacing)*72)
    }

    .max-h-\[40\%\] {
        max-height: 40%
    }

    .max-h-\[60\%\] {
        max-height: 60%
    }

    .max-h-\[60vh\] {
        max-height: 60vh
    }

    .max-h-\[65px\] {
        max-height: 65px
    }

    .max-h-\[70vh\] {
        max-height: 70vh
    }

    .max-h-\[75dvh\] {
        max-height: 75dvh
    }

    .max-h-\[80vh\] {
        max-height: 80vh
    }

    .max-h-\[85vh\] {
        max-height: 85vh
    }

    .max-h-\[120px\] {
        max-height: 120px
    }

    .max-h-\[160px\] {
        max-height: 160px
    }

    .max-h-\[200px\] {
        max-height: 200px
    }

    .max-h-\[220px\] {
        max-height: 220px
    }

    .max-h-\[240px\] {
        max-height: 240px
    }

    .max-h-\[250px\] {
        max-height: 250px
    }

    .max-h-\[280px\] {
        max-height: 280px
    }

    .max-h-\[300px\] {
        max-height: 300px
    }

    .max-h-\[320px\] {
        max-height: 320px
    }

    .max-h-\[400px\] {
        max-height: 400px
    }

    .max-h-\[420px\] {
        max-height: 420px
    }

    .max-h-\[500px\] {
        max-height: 500px
    }

    .max-h-\[600px\] {
        max-height: 600px
    }

    .max-h-\[calc\(100vh-2rem\)\] {
        max-height: calc(100vh - 2rem)
    }

    .max-h-\[min\(70vh\,560px\)\] {
        max-height: min(70vh,560px)
    }

    .max-h-\[min\(75vh\,640px\)\] {
        max-height: min(75vh,640px)
    }

    .max-h-full {
        max-height: 100%
    }

    .max-h-height-mx {
        max-height: var(--spacing-height-mx)
    }

    .\!min-h-0 {
        min-height: calc(var(--spacing)*0)!important
    }

    .min-h-0 {
        min-height: calc(var(--spacing)*0)
    }

    .min-h-0\! {
        min-height: calc(var(--spacing)*0)!important
    }

    .min-h-4 {
        min-height: calc(var(--spacing)*4)
    }

    .min-h-6 {
        min-height: calc(var(--spacing)*6)
    }

    .min-h-8 {
        min-height: calc(var(--spacing)*8)
    }

    .min-h-10 {
        min-height: calc(var(--spacing)*10)
    }

    .min-h-20\! {
        min-height: calc(var(--spacing)*20)!important
    }

    .min-h-\[1\.75rem\] {
        min-height: 1.75rem
    }

    .min-h-\[4\.5rem\] {
        min-height: 4.5rem
    }

    .min-h-\[20px\] {
        min-height: 20px
    }

    .min-h-\[32px\] {
        min-height: 32px
    }

    .min-h-\[40px\] {
        min-height: 40px
    }

    .min-h-\[44px\] {
        min-height: 44px
    }

    .min-h-\[45px\] {
        min-height: 45px
    }

    .min-h-\[48px\] {
        min-height: 48px
    }

    .min-h-\[70vh\] {
        min-height: 70vh
    }

    .min-h-\[72px\] {
        min-height: 72px
    }

    .min-h-\[100px\] {
        min-height: 100px
    }

    .min-h-\[120px\] {
        min-height: 120px
    }

    .min-h-\[140px\] {
        min-height: 140px
    }

    .min-h-\[150px\] {
        min-height: 150px
    }

    .min-h-\[160px\] {
        min-height: 160px
    }

    .min-h-\[180px\] {
        min-height: 180px
    }

    .min-h-\[200px\] {
        min-height: 200px
    }

    .min-h-\[220px\] {
        min-height: 220px
    }

    .min-h-\[248px\] {
        min-height: 248px
    }

    .min-h-\[260px\] {
        min-height: 260px
    }

    .min-h-\[280px\] {
        min-height: 280px
    }

    .min-h-\[300dvh\] {
        min-height: 300dvh
    }

    .min-h-\[300px\] {
        min-height: 300px
    }

    .min-h-\[320px\] {
        min-height: 320px
    }

    .min-h-\[360px\] {
        min-height: 360px
    }

    .min-h-\[380px\] {
        min-height: 380px
    }

    .min-h-\[400px\] {
        min-height: 400px
    }

    .min-h-\[420px\] {
        min-height: 420px
    }

    .min-h-\[450px\] {
        min-height: 450px
    }

    .min-h-\[460px\] {
        min-height: 460px
    }

    .min-h-\[480px\] {
        min-height: 480px
    }

    .min-h-\[500dvh\] {
        min-height: 500dvh
    }

    .min-h-\[500px\] {
        min-height: 500px
    }

    .min-h-\[600px\] {
        min-height: 600px
    }

    .min-h-\[640px\] {
        min-height: 640px
    }

    .min-h-\[720px\] {
        min-height: 720px
    }

    .min-h-\[calc\(100vh-\(--spacing\(28\)\)\)\] {
        min-height: calc(100vh - (calc(var(--spacing)*28)))
    }

    .min-h-\[calc\(100vh-80px\)\] {
        min-height: calc(100vh - 80px)
    }

    .min-h-\[inherit\] {
        min-height: inherit
    }

    .min-h-auto {
        min-height: auto
    }

    .min-h-dvh {
        min-height: 100dvh
    }

    .min-h-screen {
        min-height: 100vh
    }

    .w-0\.5 {
        width: calc(var(--spacing)*.5)
    }

    .w-1 {
        width: calc(var(--spacing)*1)
    }

    .w-1\.5 {
        width: calc(var(--spacing)*1.5)
    }

    .w-1\/2 {
        width: 50%
    }

    .w-2 {
        width: calc(var(--spacing)*2)
    }

    .w-2\.5 {
        width: calc(var(--spacing)*2.5)
    }

    .w-3 {
        width: calc(var(--spacing)*3)
    }

    .w-3\.5 {
        width: calc(var(--spacing)*3.5)
    }

    .w-3\/12 {
        width: 25%
    }

    .w-4 {
        width: calc(var(--spacing)*4)
    }

    .w-4\.5 {
        width: calc(var(--spacing)*4.5)
    }

    .w-5 {
        width: calc(var(--spacing)*5)
    }

    .w-5\.5 {
        width: calc(var(--spacing)*5.5)
    }

    .w-6 {
        width: calc(var(--spacing)*6)
    }

    .w-7 {
        width: calc(var(--spacing)*7)
    }

    .w-8 {
        width: calc(var(--spacing)*8)
    }

    .w-8\! {
        width: calc(var(--spacing)*8)!important
    }

    .w-8\/12 {
        width: 66.6667%
    }

    .w-9 {
        width: calc(var(--spacing)*9)
    }

    .w-9\/12 {
        width: 75%
    }

    .w-10 {
        width: calc(var(--spacing)*10)
    }

    .w-10\! {
        width: calc(var(--spacing)*10)!important
    }

    .w-10\/12 {
        width: 83.3333%
    }

    .w-11 {
        width: calc(var(--spacing)*11)
    }

    .w-11\/12 {
        width: 91.6667%
    }

    .w-12 {
        width: calc(var(--spacing)*12)
    }

    .w-14 {
        width: calc(var(--spacing)*14)
    }

    .w-14\! {
        width: calc(var(--spacing)*14)!important
    }

    .w-16 {
        width: calc(var(--spacing)*16)
    }

    .w-20 {
        width: calc(var(--spacing)*20)
    }

    .w-20\! {
        width: calc(var(--spacing)*20)!important
    }

    .w-24 {
        width: calc(var(--spacing)*24)
    }

    .w-28 {
        width: calc(var(--spacing)*28)
    }

    .w-32 {
        width: calc(var(--spacing)*32)
    }

    .w-36 {
        width: calc(var(--spacing)*36)
    }

    .w-40 {
        width: calc(var(--spacing)*40)
    }

    .w-48 {
        width: calc(var(--spacing)*48)
    }

    .w-52 {
        width: calc(var(--spacing)*52)
    }

    .w-60 {
        width: calc(var(--spacing)*60)
    }

    .w-64 {
        width: calc(var(--spacing)*64)
    }

    .w-72 {
        width: calc(var(--spacing)*72)
    }

    .w-80 {
        width: calc(var(--spacing)*80)
    }

    .w-\[0\.8em\] {
        width: .8em
    }

    .w-\[1\.5px\] {
        width: 1.5px
    }

    .w-\[2\.5px\] {
        width: 2.5px
    }

    .w-\[2px\] {
        width: 2px
    }

    .w-\[3px\] {
        width: 3px
    }

    .w-\[7px\] {
        width: 7px
    }

    .w-\[10px\] {
        width: 10px
    }

    .w-\[15px\] {
        width: 15px
    }

    .w-\[18px\] {
        width: 18px
    }

    .w-\[20\%\] {
        width: 20%
    }

    .w-\[22px\] {
        width: 22px
    }

    .w-\[26\.667px\] {
        width: 26.667px
    }

    .w-\[28px\] {
        width: 28px
    }

    .w-\[30\%\] {
        width: 30%
    }

    .w-\[30px\] {
        width: 30px
    }

    .w-\[32px\] {
        width: 32px
    }

    .w-\[34px\] {
        width: 34px
    }

    .w-\[36\%\] {
        width: 36%
    }

    .w-\[36px\] {
        width: 36px
    }

    .w-\[40\%\] {
        width: 40%
    }

    .w-\[44px\] {
        width: 44px
    }

    .w-\[45\%\] {
        width: 45%
    }

    .w-\[45px\] {
        width: 45px
    }

    .w-\[50px\] {
        width: 50px
    }

    .w-\[52\%\] {
        width: 52%
    }

    .w-\[54\%\] {
        width: 54%
    }

    .w-\[54px\] {
        width: 54px
    }

    .w-\[60px\] {
        width: 60px
    }

    .w-\[68px\] {
        width: 68px
    }

    .w-\[70\%\] {
        width: 70%
    }

    .w-\[70px\] {
        width: 70px
    }

    .w-\[72px\] {
        width: 72px
    }

    .w-\[80\%\] {
        width: 80%
    }

    .w-\[80px\] {
        width: 80px
    }

    .w-\[80vw\] {
        width: 80vw
    }

    .w-\[82px\] {
        width: 82px
    }

    .w-\[85\%\] {
        width: 85%
    }

    .w-\[88\%\] {
        width: 88%
    }

    .w-\[90\%\] {
        width: 90%
    }

    .w-\[90px\] {
        width: 90px
    }

    .w-\[90vw\] {
        width: 90vw
    }

    .w-\[92\%\] {
        width: 92%
    }

    .w-\[95\%\] {
        width: 95%
    }

    .w-\[95vw\] {
        width: 95vw
    }

    .w-\[100px\] {
        width: 100px
    }

    .w-\[104px\] {
        width: 104px
    }

    .w-\[108px\] {
        width: 108px
    }

    .w-\[120px\] {
        width: 120px
    }

    .w-\[135\%\] {
        width: 135%
    }

    .w-\[140px\] {
        width: 140px
    }

    .w-\[151px\] {
        width: 151px
    }

    .w-\[158px\] {
        width: 158px
    }

    .w-\[160\%\] {
        width: 160%
    }

    .w-\[180px\] {
        width: 180px
    }

    .w-\[185px\] {
        width: 185px
    }

    .w-\[200px\] {
        width: 200px
    }

    .w-\[202px\] {
        width: 202px
    }

    .w-\[210px\] {
        width: 210px
    }

    .w-\[220px\] {
        width: 220px
    }

    .w-\[260px\] {
        width: 260px
    }

    .w-\[280px\] {
        width: 280px
    }

    .w-\[300px\] {
        width: 300px
    }

    .w-\[360px\] {
        width: 360px
    }

    .w-\[380px\] {
        width: 380px
    }

    .w-\[387px\] {
        width: 387px
    }

    .w-\[414px\] {
        width: 414px
    }

    .w-\[500px\] {
        width: 500px
    }

    .w-\[676px\] {
        width: 676px
    }

    .w-\[900px\] {
        width: 900px
    }

    .w-auto {
        width: auto
    }

    .w-fit {
        width: fit-content
    }

    .w-full {
        width: 100%
    }

    .w-max {
        width: max-content
    }

    .w-px {
        width: 1px
    }

    .w-screen {
        width: 100vw
    }

    .\!max-w-\[760px\] {
        max-width: 760px!important
    }

    .max-w-2xl {
        max-width: var(--container-2xl)
    }

    .max-w-3xl {
        max-width: var(--container-3xl)
    }

    .max-w-4xl {
        max-width: var(--container-4xl)
    }

    .max-w-5xl {
        max-width: var(--container-5xl)
    }

    .max-w-6xl {
        max-width: var(--container-6xl)
    }

    .max-w-7xl {
        max-width: var(--container-7xl)
    }

    .max-w-20 {
        max-width: calc(var(--spacing)*20)
    }

    .max-w-\[5px\] {
        max-width: 5px
    }

    .max-w-\[15ch\] {
        max-width: 15ch
    }

    .max-w-\[18ch\] {
        max-width: 18ch
    }

    .max-w-\[20ch\] {
        max-width: 20ch
    }

    .max-w-\[22ch\] {
        max-width: 22ch
    }

    .max-w-\[22rem\] {
        max-width: 22rem
    }

    .max-w-\[24ch\] {
        max-width: 24ch
    }

    .max-w-\[26ch\] {
        max-width: 26ch
    }

    .max-w-\[32\%\] {
        max-width: 32%
    }

    .max-w-\[40ch\] {
        max-width: 40ch
    }

    .max-w-\[45px\] {
        max-width: 45px
    }

    .max-w-\[50\%\] {
        max-width: 50%
    }

    .max-w-\[52ch\] {
        max-width: 52ch
    }

    .max-w-\[54ch\] {
        max-width: 54ch
    }

    .max-w-\[56ch\] {
        max-width: 56ch
    }

    .max-w-\[58ch\] {
        max-width: 58ch
    }

    .max-w-\[60\%\] {
        max-width: 60%
    }

    .max-w-\[60ch\] {
        max-width: 60ch
    }

    .max-w-\[62ch\] {
        max-width: 62ch
    }

    .max-w-\[66\%\] {
        max-width: 66%
    }

    .max-w-\[70\%\] {
        max-width: 70%
    }

    .max-w-\[70ch\] {
        max-width: 70ch
    }

    .max-w-\[80\%\] {
        max-width: 80%
    }

    .max-w-\[85\%\] {
        max-width: 85%
    }

    .max-w-\[88\%\] {
        max-width: 88%
    }

    .max-w-\[90\%\] {
        max-width: 90%
    }

    .max-w-\[110px\] {
        max-width: 110px
    }

    .max-w-\[120px\] {
        max-width: 120px
    }

    .max-w-\[130px\] {
        max-width: 130px
    }

    .max-w-\[140px\] {
        max-width: 140px
    }

    .max-w-\[150px\] {
        max-width: 150px
    }

    .max-w-\[160px\] {
        max-width: 160px
    }

    .max-w-\[200px\] {
        max-width: 200px
    }

    .max-w-\[220px\] {
        max-width: 220px
    }

    .max-w-\[240px\] {
        max-width: 240px
    }

    .max-w-\[280px\] {
        max-width: 280px
    }

    .max-w-\[320px\] {
        max-width: 320px
    }

    .max-w-\[340px\] {
        max-width: 340px
    }

    .max-w-\[350px\] {
        max-width: 350px
    }

    .max-w-\[360px\] {
        max-width: 360px
    }

    .max-w-\[380px\] {
        max-width: 380px
    }

    .max-w-\[400px\] {
        max-width: 400px
    }

    .max-w-\[440px\] {
        max-width: 440px
    }

    .max-w-\[445px\] {
        max-width: 445px
    }

    .max-w-\[480px\] {
        max-width: 480px
    }

    .max-w-\[483px\] {
        max-width: 483px
    }

    .max-w-\[500px\] {
        max-width: 500px
    }

    .max-w-\[506px\] {
        max-width: 506px
    }

    .max-w-\[520px\] {
        max-width: 520px
    }

    .max-w-\[540px\] {
        max-width: 540px
    }

    .max-w-\[560px\] {
        max-width: 560px
    }

    .max-w-\[600px\] {
        max-width: 600px
    }

    .max-w-\[609px\] {
        max-width: 609px
    }

    .max-w-\[620px\] {
        max-width: 620px
    }

    .max-w-\[640px\] {
        max-width: 640px
    }

    .max-w-\[680px\] {
        max-width: 680px
    }

    .max-w-\[700px\] {
        max-width: 700px
    }

    .max-w-\[704px\] {
        max-width: 704px
    }

    .max-w-\[720px\] {
        max-width: 720px
    }

    .max-w-\[760px\] {
        max-width: 760px
    }

    .max-w-\[770px\] {
        max-width: 770px
    }

    .max-w-\[800px\] {
        max-width: 800px
    }

    .max-w-\[820px\] {
        max-width: 820px
    }

    .max-w-\[860px\] {
        max-width: 860px
    }

    .max-w-\[880px\] {
        max-width: 880px
    }

    .max-w-\[900px\] {
        max-width: 900px
    }

    .max-w-\[920px\] {
        max-width: 920px
    }

    .max-w-\[958px\] {
        max-width: 958px
    }

    .max-w-\[960px\] {
        max-width: 960px
    }

    .max-w-\[972px\] {
        max-width: 972px
    }

    .max-w-\[1000px\] {
        max-width: 1000px
    }

    .max-w-\[1080px\] {
        max-width: 1080px
    }

    .max-w-\[1100px\] {
        max-width: 1100px
    }

    .max-w-\[1400px\] {
        max-width: 1400px
    }

    .max-w-\[calc\(100\%-2rem\)\] {
        max-width: calc(100% - 2rem)
    }

    .max-w-\[calc\(100vw-2rem\)\] {
        max-width: calc(100vw - 2rem)
    }

    .max-w-full {
        max-width: 100%
    }

    .max-w-lg {
        max-width: var(--container-lg)
    }

    .max-w-md {
        max-width: var(--container-md)
    }

    .max-w-none {
        max-width: none
    }

    .max-w-sm {
        max-width: var(--container-sm)
    }

    .max-w-width-mx {
        max-width: var(--spacing-width-mx)
    }

    .max-w-xl {
        max-width: var(--container-xl)
    }

    .max-w-xs {
        max-width: var(--container-xs)
    }

    .\!min-w-0 {
        min-width: calc(var(--spacing)*0)!important
    }

    .min-w-0 {
        min-width: calc(var(--spacing)*0)
    }

    .min-w-0\! {
        min-width: calc(var(--spacing)*0)!important
    }

    .min-w-4 {
        min-width: calc(var(--spacing)*4)
    }

    .min-w-5 {
        min-width: calc(var(--spacing)*5)
    }

    .min-w-10 {
        min-width: calc(var(--spacing)*10)
    }

    .min-w-20\! {
        min-width: calc(var(--spacing)*20)!important
    }

    .min-w-36 {
        min-width: calc(var(--spacing)*36)
    }

    .min-w-52 {
        min-width: calc(var(--spacing)*52)
    }

    .min-w-\[2px\] {
        min-width: 2px
    }

    .min-w-\[4\.5rem\] {
        min-width: 4.5rem
    }

    .min-w-\[8\%\] {
        min-width: 8%
    }

    .min-w-\[10\.25rem\] {
        min-width: 10.25rem
    }

    .min-w-\[32px\] {
        min-width: 32px
    }

    .min-w-\[40px\] {
        min-width: 40px
    }

    .min-w-\[44px\] {
        min-width: 44px
    }

    .min-w-\[45px\] {
        min-width: 45px
    }

    .min-w-\[72px\] {
        min-width: 72px
    }

    .min-w-\[80px\] {
        min-width: 80px
    }

    .min-w-\[120px\] {
        min-width: 120px
    }

    .min-w-\[140px\] {
        min-width: 140px
    }

    .min-w-\[160px\] {
        min-width: 160px
    }

    .min-w-\[180px\] {
        min-width: 180px
    }

    .min-w-\[200px\] {
        min-width: 200px
    }

    .min-w-\[210px\] {
        min-width: 210px
    }

    .min-w-\[220px\] {
        min-width: 220px
    }

    .min-w-\[280px\] {
        min-width: 280px
    }

    .min-w-\[480px\] {
        min-width: 480px
    }

    .min-w-\[500px\] {
        min-width: 500px
    }

    .min-w-\[520px\] {
        min-width: 520px
    }

    .min-w-\[600px\] {
        min-width: 600px
    }

    .min-w-full {
        min-width: 100%
    }

    .min-w-max {
        min-width: max-content
    }

    .min-w-px {
        min-width: 1px
    }

    .flex-1 {
        flex: 1
    }

    .flex-2 {
        flex: 2
    }

    .flex-shrink {
        flex-shrink: 1
    }

    .flex-shrink-0 {
        flex-shrink: 0
    }

    .shrink {
        flex-shrink: 1
    }

    .shrink-0 {
        flex-shrink: 0
    }

    .grow {
        flex-grow: 1
    }

    .table-auto {
        table-layout: auto
    }

    .table-fixed {
        table-layout: fixed
    }

    .border-collapse {
        border-collapse: collapse
    }

    .origin-center {
        transform-origin: 50%
    }

    .origin-left {
        transform-origin: 0
    }

    .-translate-x-1\/2 {
        --tw-translate-x: -50% ;
        translate: var(--tw-translate-x)var(--tw-translate-y)
    }

    .-translate-x-\[60\%\] {
        --tw-translate-x: -60% ;
        translate: var(--tw-translate-x)var(--tw-translate-y)
    }

    .-translate-x-\[130\%\] {
        --tw-translate-x: -130% ;
        translate: var(--tw-translate-x)var(--tw-translate-y)
    }

    .-translate-x-full {
        --tw-translate-x: -100%;
        translate: var(--tw-translate-x)var(--tw-translate-y)
    }

    .translate-x-1\/2 {
        --tw-translate-x: 50% ;
        translate: var(--tw-translate-x)var(--tw-translate-y)
    }

    .translate-x-6 {
        --tw-translate-x: calc(var(--spacing)*6);
        translate: var(--tw-translate-x)var(--tw-translate-y)
    }

    .translate-x-\[3px\] {
        --tw-translate-x: 3px;
        translate: var(--tw-translate-x)var(--tw-translate-y)
    }

    .translate-x-\[18px\] {
        --tw-translate-x: 18px;
        translate: var(--tw-translate-x)var(--tw-translate-y)
    }

    .-translate-y-1\.5 {
        --tw-translate-y: calc(var(--spacing)*-1.5);
        translate: var(--tw-translate-x)var(--tw-translate-y)
    }

    .-translate-y-1\/2 {
        --tw-translate-y: -50% ;
        translate: var(--tw-translate-x)var(--tw-translate-y)
    }

    .-translate-y-\[4\.5px\] {
        --tw-translate-y: -4.5px ;
        translate: var(--tw-translate-x)var(--tw-translate-y)
    }

    .-translate-y-\[40\%\] {
        --tw-translate-y: -40% ;
        translate: var(--tw-translate-x)var(--tw-translate-y)
    }

    .-translate-y-\[48\%\] {
        --tw-translate-y: -48% ;
        translate: var(--tw-translate-x)var(--tw-translate-y)
    }

    .-translate-y-\[90\%\] {
        --tw-translate-y: -90% ;
        translate: var(--tw-translate-x)var(--tw-translate-y)
    }

    .translate-y-0 {
        --tw-translate-y: calc(var(--spacing)*0);
        translate: var(--tw-translate-x)var(--tw-translate-y)
    }

    .translate-y-1 {
        --tw-translate-y: calc(var(--spacing)*1);
        translate: var(--tw-translate-x)var(--tw-translate-y)
    }

    .translate-y-1\.5 {
        --tw-translate-y: calc(var(--spacing)*1.5);
        translate: var(--tw-translate-x)var(--tw-translate-y)
    }

    .translate-y-1\/2 {
        --tw-translate-y: 50% ;
        translate: var(--tw-translate-x)var(--tw-translate-y)
    }

    .translate-y-1\/3 {
        --tw-translate-y: calc(1/3*100%);
        translate: var(--tw-translate-x)var(--tw-translate-y)
    }

    .translate-y-2 {
        --tw-translate-y: calc(var(--spacing)*2);
        translate: var(--tw-translate-x)var(--tw-translate-y)
    }

    .translate-y-\[4\.5px\] {
        --tw-translate-y: 4.5px;
        translate: var(--tw-translate-x)var(--tw-translate-y)
    }

    .translate-y-\[35\%\] {
        --tw-translate-y: 35%;
        translate: var(--tw-translate-x)var(--tw-translate-y)
    }

    .scale-60 {
        --tw-scale-x: 60%;
        --tw-scale-y: 60%;
        --tw-scale-z: 60%;
        scale: var(--tw-scale-x)var(--tw-scale-y)
    }

    .scale-70 {
        --tw-scale-x: 70%;
        --tw-scale-y: 70%;
        --tw-scale-z: 70%;
        scale: var(--tw-scale-x)var(--tw-scale-y)
    }

    .scale-75 {
        --tw-scale-x: 75%;
        --tw-scale-y: 75%;
        --tw-scale-z: 75%;
        scale: var(--tw-scale-x)var(--tw-scale-y)
    }

    .scale-85 {
        --tw-scale-x: 85%;
        --tw-scale-y: 85%;
        --tw-scale-z: 85%;
        scale: var(--tw-scale-x)var(--tw-scale-y)
    }

    .scale-90 {
        --tw-scale-x: 90%;
        --tw-scale-y: 90%;
        --tw-scale-z: 90%;
        scale: var(--tw-scale-x)var(--tw-scale-y)
    }

    .scale-100 {
        --tw-scale-x: 100%;
        --tw-scale-y: 100%;
        --tw-scale-z: 100%;
        scale: var(--tw-scale-x)var(--tw-scale-y)
    }

    .scale-105 {
        --tw-scale-x: 105%;
        --tw-scale-y: 105%;
        --tw-scale-z: 105%;
        scale: var(--tw-scale-x)var(--tw-scale-y)
    }

    .scale-110 {
        --tw-scale-x: 110%;
        --tw-scale-y: 110%;
        --tw-scale-z: 110%;
        scale: var(--tw-scale-x)var(--tw-scale-y)
    }

    .scale-115 {
        --tw-scale-x: 115%;
        --tw-scale-y: 115%;
        --tw-scale-z: 115%;
        scale: var(--tw-scale-x)var(--tw-scale-y)
    }

    .scale-125 {
        --tw-scale-x: 125%;
        --tw-scale-y: 125%;
        --tw-scale-z: 125%;
        scale: var(--tw-scale-x)var(--tw-scale-y)
    }

    .-scale-x-100 {
        --tw-scale-x: -100% ;
        scale: var(--tw-scale-x)var(--tw-scale-y)
    }

    .scale-x-0 {
        --tw-scale-x: 0%;
        scale: var(--tw-scale-x)var(--tw-scale-y)
    }

    .scale-x-175 {
        --tw-scale-x: 175%;
        scale: var(--tw-scale-x)var(--tw-scale-y)
    }

    .scale-x-200 {
        --tw-scale-x: 200%;
        scale: var(--tw-scale-x)var(--tw-scale-y)
    }

    .scale-x-\[-1\] {
        --tw-scale-x: -1;
        scale: var(--tw-scale-x)var(--tw-scale-y)
    }

    .scale-x-\[210\%\] {
        --tw-scale-x: 210%;
        scale: var(--tw-scale-x)var(--tw-scale-y)
    }

    .-scale-y-100 {
        --tw-scale-y: -100% ;
        scale: var(--tw-scale-x)var(--tw-scale-y)
    }

    .scale-y-100 {
        --tw-scale-y: 100%;
        scale: var(--tw-scale-x)var(--tw-scale-y)
    }

    .scale-y-125 {
        --tw-scale-y: 125%;
        scale: var(--tw-scale-x)var(--tw-scale-y)
    }

    .scale-y-150 {
        --tw-scale-y: 150%;
        scale: var(--tw-scale-x)var(--tw-scale-y)
    }

    .scale-y-\[280\%\] {
        --tw-scale-y: 280%;
        scale: var(--tw-scale-x)var(--tw-scale-y)
    }

    .scale-\[0\.99\] {
        scale: .99
    }

    .scale-\[1\.01\] {
        scale: 1.01
    }

    .scale-\[1\.02\] {
        scale: 1.02
    }

    .scale-\[1\.18\] {
        scale: 1.18
    }

    .scale-\[2\.05\] {
        scale: 2.05
    }

    .-rotate-15 {
        rotate: -15deg
    }

    .-rotate-18 {
        rotate: -18deg
    }

    .-rotate-45 {
        rotate: -45deg
    }

    .-rotate-90 {
        rotate: -90deg
    }

    .rotate-0 {
        rotate: none
    }

    .rotate-6 {
        rotate: 6deg
    }

    .rotate-12 {
        rotate: 12deg
    }

    .rotate-30 {
        rotate: 30deg
    }

    .rotate-45 {
        rotate: 45deg
    }

    .rotate-90 {
        rotate: 90deg
    }

    .rotate-180 {
        rotate: 180deg
    }

    .rotate-\[-15deg\] {
        rotate: -15deg
    }

    .rotate-\[-25deg\] {
        rotate: -25deg
    }

    .rotate-\[15deg\] {
        rotate: 15deg
    }

    .rotate-\[20deg\] {
        rotate: 20deg
    }

    .transform {
        transform: var(--tw-rotate-x,)var(--tw-rotate-y,)var(--tw-rotate-z,)var(--tw-skew-x,)var(--tw-skew-y,)
    }

    .animate-\[ask-dot-pulse_1\.2s_ease-in-out_infinite\] {
        animation: 1.2s ease-in-out infinite ask-dot-pulse
    }

    .animate-\[ask-dot-pulse_1s_ease-in-out_infinite\] {
        animation: 1s ease-in-out infinite ask-dot-pulse
    }

    .animate-\[ask-logo-pulse_2s_ease-in-out_infinite\] {
        animation: 2s ease-in-out infinite ask-logo-pulse
    }

    .animate-\[ask-viz-enter_300ms_ease-out_both\] {
        animation: .3s ease-out both ask-viz-enter
    }

    .animate-\[aurora-spin_var\(--aurora-speed\)_linear_infinite\] {
        animation: aurora-spin var(--aurora-speed)linear infinite
    }

    .animate-\[blink_1s_ease-in-out_infinite\] {
        animation: 1s ease-in-out infinite blink
    }

    .animate-\[ceramic-drift-alt_12s_ease-in-out_infinite\] {
        animation: 12s ease-in-out infinite ceramic-drift-alt
    }

    .animate-\[ceramic-drift_16s_ease-in-out_infinite\] {
        animation: 16s ease-in-out infinite ceramic-drift
    }

    .animate-\[fadeSlideIn_0\.3s_ease-out\] {
        animation: .3s ease-out fadeSlideIn
    }

    .animate-\[fadeSlideIn_0\.4s_ease-out\] {
        animation: .4s ease-out fadeSlideIn
    }

    .animate-\[fadeSlideIn_0\.15s_ease-out\] {
        animation: .15s ease-out fadeSlideIn
    }

    .animate-\[indeterminate_1\.5s_ease-in-out_infinite\] {
        animation: 1.5s ease-in-out infinite indeterminate
    }

    .animate-\[lm-drift-alt_8s_ease-in-out_infinite\] {
        animation: 8s ease-in-out infinite lm-drift-alt
    }

    .animate-\[lm-drift_6s_ease-in-out_infinite\] {
        animation: 6s ease-in-out infinite lm-drift
    }

    .animate-\[playPulse_2s_ease-in-out_infinite\] {
        animation: 2s ease-in-out infinite playPulse
    }

    .animate-\[scrollDot_1\.8s_ease-in-out_infinite\] {
        animation: 1.8s ease-in-out infinite scrollDot
    }

    .animate-\[shake_0\.4s_ease-in-out\] {
        animation: .4s ease-in-out shake
    }

    .animate-\[shimmer_4s_ease-in-out_infinite_2s\] {
        animation: 4s ease-in-out 2s infinite shimmer
    }

    .animate-\[stone-drift_14s_ease-in-out_infinite\] {
        animation: 14s ease-in-out infinite stone-drift
    }

    .animate-\[ticker-marquee_150s_linear_infinite\] {
        animation: 150s linear infinite ticker-marquee
    }

    .animate-\[wiggle_0\.8s_ease-in-out\] {
        animation: .8s ease-in-out wiggle
    }

    .animate-ping {
        animation: var(--animate-ping)
    }

    .animate-pulse {
        animation: var(--animate-pulse)
    }

    .animate-spin {
        animation: var(--animate-spin)
    }

    .cursor-crosshair {
        cursor: crosshair
    }

    .cursor-default {
        cursor: default
    }

    .cursor-ew-resize {
        cursor: ew-resize
    }

    .cursor-grab {
        cursor: grab
    }

    .cursor-not-allowed {
        cursor: not-allowed
    }

    .cursor-pointer {
        cursor: pointer
    }

    .touch-pan-y {
        --tw-pan-y: pan-y;
        touch-action: var(--tw-pan-x,)var(--tw-pan-y,)var(--tw-pinch-zoom,)
    }

    .\[touch-action\: pan-x\] {
        touch-action:pan-x
    }

    .touch-manipulation {
        touch-action: manipulation
    }

    .resize {
        resize: both
    }

    .resize-none {
        resize: none
    }

    .resize-y {
        resize: vertical
    }

    .snap-x {
        scroll-snap-type: x var(--tw-scroll-snap-strictness)
    }

    .snap-mandatory {
        --tw-scroll-snap-strictness: mandatory
    }

    .snap-start {
        scroll-snap-align: start
    }

    .scroll-mt-24 {
        scroll-margin-top: calc(var(--spacing)*24)
    }

    .scroll-mt-28 {
        scroll-margin-top: calc(var(--spacing)*28)
    }

    .scroll-mt-40 {
        scroll-margin-top: calc(var(--spacing)*40)
    }

    .scroll-px-4 {
        scroll-padding-inline: calc(var(--spacing)*4)
    }

    .list-inside {
        list-style-position: inside
    }

    .list-decimal {
        list-style-type: decimal
    }

    .list-disc {
        list-style-type: disc
    }

    .list-none {
        list-style-type: none
    }

    .appearance-none {
        appearance: none
    }

    .grid-cols-1 {
        grid-template-columns: repeat(1,minmax(0,1fr))
    }

    .grid-cols-2 {
        grid-template-columns: repeat(2,minmax(0,1fr))
    }

    .grid-cols-3 {
        grid-template-columns: repeat(3,minmax(0,1fr))
    }

    .grid-cols-4 {
        grid-template-columns: repeat(4,minmax(0,1fr))
    }

    .grid-cols-5 {
        grid-template-columns: repeat(5,minmax(0,1fr))
    }

    .grid-cols-6 {
        grid-template-columns: repeat(6,minmax(0,1fr))
    }

    .grid-cols-12 {
        grid-template-columns: repeat(12,minmax(0,1fr))
    }

    .grid-cols-\[1fr_auto\] {
        grid-template-columns: 1fr auto
    }

    .grid-cols-\[180px_1fr_1fr_1fr\] {
        grid-template-columns: 180px 1fr 1fr 1fr
    }

    .grid-cols-\[auto_1fr\] {
        grid-template-columns: auto 1fr
    }

    .grid-cols-\[auto_1fr_auto_auto\] {
        grid-template-columns: auto 1fr auto auto
    }

    .grid-rows-2 {
        grid-template-rows: repeat(2,minmax(0,1fr))
    }

    .grid-rows-\[0fr\] {
        grid-template-rows: 0fr
    }

    .grid-rows-\[1fr\] {
        grid-template-rows: 1fr
    }

    .flex-col {
        flex-direction: column
    }

    .flex-col-reverse {
        flex-direction: column-reverse
    }

    .flex-row {
        flex-direction: row
    }

    .flex-row-reverse {
        flex-direction: row-reverse
    }

    .flex-nowrap {
        flex-wrap: nowrap
    }

    .flex-wrap {
        flex-wrap: wrap
    }

    .items-baseline {
        align-items: baseline
    }

    .items-center {
        align-items: center
    }

    .items-end {
        align-items: flex-end
    }

    .items-start {
        align-items: flex-start
    }

    .items-stretch {
        align-items: stretch
    }

    .justify-around {
        justify-content: space-around
    }

    .justify-between {
        justify-content: space-between
    }

    .justify-center {
        justify-content: center
    }

    .justify-end {
        justify-content: flex-end
    }

    .justify-evenly {
        justify-content: space-evenly
    }

    .justify-start {
        justify-content: flex-start
    }

    .justify-items-center {
        justify-items: center
    }

    .\!gap-2 {
        gap: calc(var(--spacing)*2)!important
    }

    .gap-0 {
        gap: calc(var(--spacing)*0)
    }

    .gap-0\.5 {
        gap: calc(var(--spacing)*.5)
    }

    .gap-1 {
        gap: calc(var(--spacing)*1)
    }

    .gap-1\.5 {
        gap: calc(var(--spacing)*1.5)
    }

    .gap-2 {
        gap: calc(var(--spacing)*2)
    }

    .gap-2\.5 {
        gap: calc(var(--spacing)*2.5)
    }

    .gap-3 {
        gap: calc(var(--spacing)*3)
    }

    .gap-3\.5 {
        gap: calc(var(--spacing)*3.5)
    }

    .gap-4 {
        gap: calc(var(--spacing)*4)
    }

    .gap-4\.5 {
        gap: calc(var(--spacing)*4.5)
    }

    .gap-5 {
        gap: calc(var(--spacing)*5)
    }

    .gap-6 {
        gap: calc(var(--spacing)*6)
    }

    .gap-7 {
        gap: calc(var(--spacing)*7)
    }

    .gap-8 {
        gap: calc(var(--spacing)*8)
    }

    .gap-9 {
        gap: calc(var(--spacing)*9)
    }

    .gap-10 {
        gap: calc(var(--spacing)*10)
    }

    .gap-12 {
        gap: calc(var(--spacing)*12)
    }

    .gap-16 {
        gap: calc(var(--spacing)*16)
    }

    .gap-20 {
        gap: calc(var(--spacing)*20)
    }

    .gap-24 {
        gap: calc(var(--spacing)*24)
    }

    .gap-28 {
        gap: calc(var(--spacing)*28)
    }

    .gap-32 {
        gap: calc(var(--spacing)*32)
    }

    .gap-40 {
        gap: calc(var(--spacing)*40)
    }

    .gap-\[1px\] {
        gap: 1px
    }

    .gap-\[2px\] {
        gap: 2px
    }

    .gap-\[3px\] {
        gap: 3px
    }

    .gap-\[5px\] {
        gap: 5px
    }

    .gap-\[6px\] {
        gap: 6px
    }

    .gap-\[8px\] {
        gap: 8px
    }

    .gap-\[10px\] {
        gap: 10px
    }

    .gap-\[12px\] {
        gap: 12px
    }

    .gap-\[16px\] {
        gap: 16px
    }

    .gap-\[20px\] {
        gap: 20px
    }

    .gap-\[36px\] {
        gap: 36px
    }

    .gap-\[50px\] {
        gap: 50px
    }

    .gap-\[400px\] {
        gap: 400px
    }

    :where(.space-y-0\.5>: not(:last-child)) {
        --tw-space-y-reverse:0;
        margin-block-start:calc(calc(var(--spacing)*.5)*var(--tw-space-y-reverse));margin-block-end: calc(calc(var(--spacing)*.5)*calc(1 - var(--tw-space-y-reverse)))
    }

    :where(.space-y-1>:not(:last-child)) {
        --tw-space-y-reverse: 0;
        margin-block-start:calc(calc(var(--spacing)*1)*var(--tw-space-y-reverse));margin-block-end: calc(calc(var(--spacing)*1)*calc(1 - var(--tw-space-y-reverse)))
    }

    :where(.space-y-1\.5>: not(:last-child)) {
        --tw-space-y-reverse:0;
        margin-block-start:calc(calc(var(--spacing)*1.5)*var(--tw-space-y-reverse));margin-block-end: calc(calc(var(--spacing)*1.5)*calc(1 - var(--tw-space-y-reverse)))
    }

    :where(.space-y-2>:not(:last-child)) {
        --tw-space-y-reverse: 0;
        margin-block-start:calc(calc(var(--spacing)*2)*var(--tw-space-y-reverse));margin-block-end: calc(calc(var(--spacing)*2)*calc(1 - var(--tw-space-y-reverse)))
    }

    :where(.space-y-2\.5>: not(:last-child)) {
        --tw-space-y-reverse:0;
        margin-block-start:calc(calc(var(--spacing)*2.5)*var(--tw-space-y-reverse));margin-block-end: calc(calc(var(--spacing)*2.5)*calc(1 - var(--tw-space-y-reverse)))
    }

    :where(.space-y-3>:not(:last-child)) {
        --tw-space-y-reverse: 0;
        margin-block-start:calc(calc(var(--spacing)*3)*var(--tw-space-y-reverse));margin-block-end: calc(calc(var(--spacing)*3)*calc(1 - var(--tw-space-y-reverse)))
    }

    :where(.space-y-4>:not(:last-child)) {
        --tw-space-y-reverse: 0;
        margin-block-start:calc(calc(var(--spacing)*4)*var(--tw-space-y-reverse));margin-block-end: calc(calc(var(--spacing)*4)*calc(1 - var(--tw-space-y-reverse)))
    }

    :where(.space-y-5>:not(:last-child)) {
        --tw-space-y-reverse: 0;
        margin-block-start:calc(calc(var(--spacing)*5)*var(--tw-space-y-reverse));margin-block-end: calc(calc(var(--spacing)*5)*calc(1 - var(--tw-space-y-reverse)))
    }

    :where(.space-y-8>:not(:last-child)) {
        --tw-space-y-reverse: 0;
        margin-block-start:calc(calc(var(--spacing)*8)*var(--tw-space-y-reverse));margin-block-end: calc(calc(var(--spacing)*8)*calc(1 - var(--tw-space-y-reverse)))
    }

    :where(.space-y-16>:not(:last-child)) {
        --tw-space-y-reverse: 0;
        margin-block-start:calc(calc(var(--spacing)*16)*var(--tw-space-y-reverse));margin-block-end: calc(calc(var(--spacing)*16)*calc(1 - var(--tw-space-y-reverse)))
    }

    :where(.space-y-\[3px\]>: not(:last-child)) {
        --tw-space-y-reverse:0;
        margin-block-start:calc(3px*var(--tw-space-y-reverse));margin-block-end: calc(3px*calc(1 - var(--tw-space-y-reverse)))
    }

    .gap-x-3 {
        column-gap: calc(var(--spacing)*3)
    }

    .gap-x-4 {
        column-gap: calc(var(--spacing)*4)
    }

    .gap-x-5 {
        column-gap: calc(var(--spacing)*5)
    }

    .gap-x-6 {
        column-gap: calc(var(--spacing)*6)
    }

    .gap-x-8 {
        column-gap: calc(var(--spacing)*8)
    }

    .gap-x-10 {
        column-gap: calc(var(--spacing)*10)
    }

    .gap-x-12 {
        column-gap: calc(var(--spacing)*12)
    }

    .gap-x-\[5px\] {
        column-gap: 5px
    }

    .gap-x-\[6px\] {
        column-gap: 6px
    }

    .gap-x-\[10px\] {
        column-gap: 10px
    }

    :where(.space-x-12>:not(:last-child)) {
        --tw-space-x-reverse: 0;
        margin-inline-start:calc(calc(var(--spacing)*12)*var(--tw-space-x-reverse));margin-inline-end: calc(calc(var(--spacing)*12)*calc(1 - var(--tw-space-x-reverse)))
    }

    .gap-y-0 {
        row-gap: calc(var(--spacing)*0)
    }

    .gap-y-1 {
        row-gap: calc(var(--spacing)*1)
    }

    .gap-y-1\.5 {
        row-gap: calc(var(--spacing)*1.5)
    }

    .gap-y-2 {
        row-gap: calc(var(--spacing)*2)
    }

    .gap-y-3 {
        row-gap: calc(var(--spacing)*3)
    }

    .gap-y-5 {
        row-gap: calc(var(--spacing)*5)
    }

    .gap-y-6 {
        row-gap: calc(var(--spacing)*6)
    }

    .gap-y-8 {
        row-gap: calc(var(--spacing)*8)
    }

    .gap-y-10 {
        row-gap: calc(var(--spacing)*10)
    }

    .gap-y-16 {
        row-gap: calc(var(--spacing)*16)
    }

    .gap-y-\[4px\] {
        row-gap: 4px
    }

    :where(.divide-y>:not(:last-child)) {
        --tw-divide-y-reverse: 0;
        border-bottom-style: var(--tw-border-style);
        border-top-style: var(--tw-border-style);
        border-top-width: calc(1px*var(--tw-divide-y-reverse));
        border-bottom-width: calc(1px*calc(1 - var(--tw-divide-y-reverse)))
    }

    :where(.divide-gray-100>:not(:last-child)) {
        border-color: var(--color-gray-100)
    }

    :where(.divide-st>:not(:last-child)) {
        border-color: var(--color-st)
    }

    :where(.divide-st-secondary>:not(:last-child)) {
        border-color: var(--color-st-secondary)
    }

    :where(.divide-white\/10>: not(:last-child)) {
        border-color:#ffffff1a
    }

    @supports (color: color-mix(in lab,red,red)) {
        :where(.divide-white\/10>:not(:last-child)) {
            border-color:color-mix(in oklab,var(--color-white)10%,transparent)
        }
    }

    .self-center {
        align-self: center
    }

    .self-end {
        align-self: flex-end
    }

    .self-start {
        align-self: flex-start
    }

    .self-stretch {
        align-self: stretch
    }

    .justify-self-center {
        justify-self: center
    }

    .truncate {
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden
    }

    .overflow-auto {
        overflow: auto
    }

    .overflow-clip {
        overflow: clip
    }

    .overflow-hidden {
        overflow: hidden
    }

    .overflow-visible {
        overflow: visible
    }

    .overflow-x-auto {
        overflow-x: auto
    }

    .overflow-x-clip {
        overflow-x: clip
    }

    .overflow-x-hidden {
        overflow-x: hidden
    }

    .overflow-x-visible {
        overflow-x: visible
    }

    .overflow-y-auto {
        overflow-y: auto
    }

    .overflow-y-hidden {
        overflow-y: hidden
    }

    .overflow-y-scroll {
        overflow-y: scroll
    }

    .overflow-y-visible {
        overflow-y: visible
    }

    .overscroll-contain {
        overscroll-behavior: contain
    }

    .overscroll-none {
        overscroll-behavior: none
    }

    .overscroll-x-contain {
        overscroll-behavior-x: contain
    }

    .scroll-smooth {
        scroll-behavior: smooth
    }

    .\!rounded-none {
        border-radius: 0!important
    }

    .rounded {
        border-radius: .25rem
    }

    .rounded-2xl {
        border-radius: var(--radius-2xl)
    }

    .rounded-3xl {
        border-radius: var(--radius-3xl)
    }

    .rounded-4xl {
        border-radius: var(--radius-4xl)
    }

    .rounded-\[1\.9rem\] {
        border-radius: 1.9rem
    }

    .rounded-\[2px\] {
        border-radius: 2px
    }

    .rounded-\[3px\] {
        border-radius: 3px
    }

    .rounded-\[4px\] {
        border-radius: 4px
    }

    .rounded-\[5px\] {
        border-radius: 5px
    }

    .rounded-\[6px\] {
        border-radius: 6px
    }

    .rounded-\[8px\] {
        border-radius: 8px
    }

    .rounded-\[9px\] {
        border-radius: 9px
    }

    .rounded-\[10px\] {
        border-radius: 10px
    }

    .rounded-\[11px\] {
        border-radius: 11px
    }

    .rounded-\[12px\] {
        border-radius: 12px
    }

    .rounded-\[13px\] {
        border-radius: 13px
    }

    .rounded-\[14px\] {
        border-radius: 14px
    }

    .rounded-\[16px\] {
        border-radius: 16px
    }

    .rounded-\[18px\] {
        border-radius: 18px
    }

    .rounded-\[20px\] {
        border-radius: 20px
    }

    .rounded-\[22px\] {
        border-radius: 22px
    }

    .rounded-\[24px\] {
        border-radius: 24px
    }

    .rounded-\[26px\] {
        border-radius: 26px
    }

    .rounded-\[28px\] {
        border-radius: 28px
    }

    .rounded-\[30px\] {
        border-radius: 30px
    }

    .rounded-\[32px\] {
        border-radius: 32px
    }

    .rounded-\[34px\] {
        border-radius: 34px
    }

    .rounded-\[36px\] {
        border-radius: 36px
    }

    .rounded-\[40px\] {
        border-radius: 40px
    }

    .rounded-\[42px\] {
        border-radius: 42px
    }

    .rounded-\[44px\] {
        border-radius: 44px
    }

    .rounded-\[46px\] {
        border-radius: 46px
    }

    .rounded-\[48px\] {
        border-radius: 48px
    }

    .rounded-\[50px\] {
        border-radius: 50px
    }

    .rounded-\[56px\] {
        border-radius: 56px
    }

    .rounded-\[60px\] {
        border-radius: 60px
    }

    .rounded-\[64px\] {
        border-radius: 64px
    }

    .rounded-\[80px\] {
        border-radius: 80px
    }

    .rounded-\[99px\] {
        border-radius: 99px
    }

    .rounded-\[inherit\] {
        border-radius: inherit
    }

    .rounded-full {
        border-radius: 3.40282e38px
    }

    .rounded-full\! {
        border-radius: 3.40282e38px!important
    }

    .rounded-lg {
        border-radius: var(--radius-lg)
    }

    .rounded-md {
        border-radius: var(--radius-md)
    }

    .rounded-none {
        border-radius: 0
    }

    .rounded-none\! {
        border-radius: 0!important
    }

    .rounded-sm {
        border-radius: var(--radius-sm)
    }

    .rounded-xl {
        border-radius: var(--radius-xl)
    }

    .rounded-xs {
        border-radius: var(--radius-xs)
    }

    .rounded-t-3xl {
        border-top-left-radius: var(--radius-3xl);
        border-top-right-radius: var(--radius-3xl)
    }

    .rounded-t-\[2px\] {
        border-top-left-radius: 2px;
        border-top-right-radius: 2px
    }

    .rounded-t-\[4px\] {
        border-top-left-radius: 4px;
        border-top-right-radius: 4px
    }

    .rounded-t-\[5px\] {
        border-top-left-radius: 5px;
        border-top-right-radius: 5px
    }

    .rounded-t-\[20px\] {
        border-top-left-radius: 20px;
        border-top-right-radius: 20px
    }

    .rounded-t-\[28px\] {
        border-top-left-radius: 28px;
        border-top-right-radius: 28px
    }

    .rounded-t-xl {
        border-top-left-radius: var(--radius-xl);
        border-top-right-radius: var(--radius-xl)
    }

    .rounded-l-full {
        border-top-left-radius: 3.40282e38px;
        border-bottom-left-radius: 3.40282e38px
    }

    .rounded-l-lg {
        border-top-left-radius: var(--radius-lg);
        border-bottom-left-radius: var(--radius-lg)
    }

    .rounded-l-sm {
        border-top-left-radius: var(--radius-sm);
        border-bottom-left-radius: var(--radius-sm)
    }

    .rounded-l-xl {
        border-top-left-radius: var(--radius-xl);
        border-bottom-left-radius: var(--radius-xl)
    }

    .rounded-tl-\[5px\] {
        border-top-left-radius: 5px
    }

    .rounded-tl-\[24px\] {
        border-top-left-radius: 24px
    }

    .rounded-tl-md {
        border-top-left-radius: var(--radius-md)
    }

    .rounded-tl-sm {
        border-top-left-radius: var(--radius-sm)
    }

    .rounded-r {
        border-top-right-radius: .25rem;
        border-bottom-right-radius: .25rem
    }

    .rounded-r-full {
        border-top-right-radius: 3.40282e38px;
        border-bottom-right-radius: 3.40282e38px
    }

    .rounded-r-sm {
        border-top-right-radius: var(--radius-sm);
        border-bottom-right-radius: var(--radius-sm)
    }

    .rounded-r-xl {
        border-top-right-radius: var(--radius-xl);
        border-bottom-right-radius: var(--radius-xl)
    }

    .rounded-tr-\[5px\] {
        border-top-right-radius: 5px
    }

    .rounded-tr-md {
        border-top-right-radius: var(--radius-md)
    }

    .rounded-tr-sm {
        border-top-right-radius: var(--radius-sm)
    }

    .rounded-b-2xl {
        border-bottom-right-radius: var(--radius-2xl);
        border-bottom-left-radius: var(--radius-2xl)
    }

    .rounded-b-4xl {
        border-bottom-right-radius: var(--radius-4xl);
        border-bottom-left-radius: var(--radius-4xl)
    }

    .rounded-b-\[20px\] {
        border-bottom-right-radius: 20px;
        border-bottom-left-radius: 20px
    }

    .rounded-b-\[28px\] {
        border-bottom-right-radius: 28px;
        border-bottom-left-radius: 28px
    }

    .rounded-b-\[32px\] {
        border-bottom-right-radius: 32px;
        border-bottom-left-radius: 32px
    }

    .rounded-b-xl {
        border-bottom-right-radius: var(--radius-xl);
        border-bottom-left-radius: var(--radius-xl)
    }

    .rounded-bl-\[24px\] {
        border-bottom-left-radius: 24px
    }

    .border {
        border-style: var(--tw-border-style);
        border-width: 1px
    }

    .border-0 {
        border-style: var(--tw-border-style);
        border-width: 0
    }

    .border-2 {
        border-style: var(--tw-border-style);
        border-width: 2px
    }

    .border-3 {
        border-style: var(--tw-border-style);
        border-width: 3px
    }

    .border-4 {
        border-style: var(--tw-border-style);
        border-width: 4px
    }

    .border-\[0\.5px\] {
        border-style: var(--tw-border-style);
        border-width: .5px
    }

    .border-\[1\.5px\] {
        border-style: var(--tw-border-style);
        border-width: 1.5px
    }

    .border-\[3px\] {
        border-style: var(--tw-border-style);
        border-width: 3px
    }

    .border-x {
        border-inline-style:var(--tw-border-style);border-inline-width: 1px
    }

    .border-y {
        border-block-style:var(--tw-border-style);border-block-width: 1px
    }

    .border-y-2 {
        border-block-style:var(--tw-border-style);border-block-width: 2px
    }

    .border-t {
        border-top-style: var(--tw-border-style);
        border-top-width: 1px
    }

    .border-t-0 {
        border-top-style: var(--tw-border-style);
        border-top-width: 0
    }

    .border-t-2 {
        border-top-style: var(--tw-border-style);
        border-top-width: 2px
    }

    .border-t-4 {
        border-top-style: var(--tw-border-style);
        border-top-width: 4px
    }

    .border-r {
        border-right-style: var(--tw-border-style);
        border-right-width: 1px
    }

    .border-r-0 {
        border-right-style: var(--tw-border-style);
        border-right-width: 0
    }

    .border-b {
        border-bottom-style: var(--tw-border-style);
        border-bottom-width: 1px
    }

    .border-b-0 {
        border-bottom-style: var(--tw-border-style);
        border-bottom-width: 0
    }

    .border-b-2 {
        border-bottom-style: var(--tw-border-style);
        border-bottom-width: 2px
    }

    .border-l {
        border-left-style: var(--tw-border-style);
        border-left-width: 1px
    }

    .border-l-2 {
        border-left-style: var(--tw-border-style);
        border-left-width: 2px
    }

    .border-l-3 {
        border-left-style: var(--tw-border-style);
        border-left-width: 3px
    }

    .border-l-4 {
        border-left-style: var(--tw-border-style);
        border-left-width: 4px
    }

    .border-dashed {
        --tw-border-style: dashed;
        border-style: dashed
    }

    .border-dotted {
        --tw-border-style: dotted;
        border-style: dotted
    }

    .border-none {
        --tw-border-style: none;
        border-style: none
    }

    .border-solid {
        --tw-border-style: solid;
        border-style: solid
    }

    .border-\[\#2a2a2a\] {
        border-color: #2a2a2a
    }

    .border-\[\#555\] {
        border-color: #555
    }

    .border-\[\#4346e0\] {
        border-color: #4346e0
    }

    .border-\[\#7375ce\] {
        border-color: #7375ce
    }

    .border-\[\#131313\] {
        border-color: #131313
    }

    .border-\[\#292929\] {
        border-color: #292929
    }

    .border-\[\#383994\] {
        border-color: #383994
    }

    .border-\[\#909090\] {
        border-color: #909090
    }

    .border-\[\#D5D5D5\] {
        border-color: #d5d5d5
    }

    .border-\[\#F8F8F8\] {
        border-color: #f8f8f8
    }

    .border-\[\#c4b8a8\] {
        border-color: #c4b8a8
    }

    .border-\[\#e0ddd8\] {
        border-color: #e0ddd8
    }

    .border-\[\#e5e5e5\] {
        border-color: #e5e5e5
    }

    .border-\[\#e6e6e6\] {
        border-color: #e6e6e6
    }

    .border-\[\#e8e8e8\] {
        border-color: #e8e8e8
    }

    .border-\[\#f0b27a\] {
        border-color: #f0b27a
    }

    .border-\[\#f0f0f0\] {
        border-color: #f0f0f0
    }

    .border-\[\#f5f5f5\] {
        border-color: #f5f5f5
    }

    .border-\[\#f6f6f6\] {
        border-color: #f6f6f6
    }

    .border-amber-200 {
        border-color: var(--color-amber-200)
    }

    .border-amber-300 {
        border-color: var(--color-amber-300)
    }

    .border-black\/5 {
        border-color: #0000000d
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-black\/5 {
            border-color:color-mix(in oklab,var(--color-black)5%,transparent)
        }
    }

    .border-black\/\[0\.04\] {
        border-color: #0000000a
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-black\/\[0\.04\] {
            border-color:color-mix(in oklab,var(--color-black)4%,transparent)
        }
    }

    .border-blue-200 {
        border-color: var(--color-blue-200)
    }

    .border-blue-300 {
        border-color: var(--color-blue-300)
    }

    .border-br-blue {
        border-color: var(--color-br-blue)
    }

    .border-br-orange {
        border-color: var(--color-br-orange)
    }

    .border-ct-accent-indigo\/30 {
        border-color: #3333cc4d
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-ct-accent-indigo\/30 {
            border-color:color-mix(in oklab,var(--color-ct-accent-indigo)30%,transparent)
        }
    }

    .border-ct-accent-orange {
        border-color: var(--color-ct-accent-orange)
    }

    .border-current {
        border-color: currentColor
    }

    .border-cyan-200 {
        border-color: var(--color-cyan-200)
    }

    .border-emerald-200 {
        border-color: var(--color-emerald-200)
    }

    .border-emerald-300 {
        border-color: var(--color-emerald-300)
    }

    .border-fuchsia-200 {
        border-color: var(--color-fuchsia-200)
    }

    .border-fuchsia-300 {
        border-color: var(--color-fuchsia-300)
    }

    .border-gray-50 {
        border-color: var(--color-gray-50)
    }

    .border-gray-100 {
        border-color: var(--color-gray-100)
    }

    .border-gray-200 {
        border-color: var(--color-gray-200)
    }

    .border-gray-300 {
        border-color: var(--color-gray-300)
    }

    .border-gray-900 {
        border-color: var(--color-gray-900)
    }

    .border-green-200 {
        border-color: var(--color-green-200)
    }

    .border-indigo-200 {
        border-color: var(--color-indigo-200)
    }

    .border-indigo-300 {
        border-color: var(--color-indigo-300)
    }

    .border-indigo-500 {
        border-color: var(--color-indigo-500)
    }

    .border-neutral-100 {
        border-color: var(--color-neutral-100)
    }

    .border-neutral-200 {
        border-color: var(--color-neutral-200)
    }

    .border-neutral-200\/60 {
        border-color: #e5e5e599
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-neutral-200\/60 {
            border-color:color-mix(in oklab,var(--color-neutral-200)60%,transparent)
        }
    }

    .border-neutral-300 {
        border-color: var(--color-neutral-300)
    }

    .border-orange-200 {
        border-color: var(--color-orange-200)
    }

    .border-orange-300 {
        border-color: var(--color-orange-300)
    }

    .border-pink-200 {
        border-color: var(--color-pink-200)
    }

    .border-red-100 {
        border-color: var(--color-red-100)
    }

    .border-red-200 {
        border-color: var(--color-red-200)
    }

    .border-red-300 {
        border-color: var(--color-red-300)
    }

    .border-red-400 {
        border-color: var(--color-red-400)
    }

    .border-red-400\! {
        border-color: var(--color-red-400)!important
    }

    .border-rose-200 {
        border-color: var(--color-rose-200)
    }

    .border-rose-300 {
        border-color: var(--color-rose-300)
    }

    .border-sf-quaternary {
        border-color: var(--color-sf-quaternary)
    }

    .border-sf-tertiary {
        border-color: var(--color-sf-tertiary)
    }

    .border-sf-tertiary\/50 {
        border-color: #f0f0f080
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-sf-tertiary\/50 {
            border-color:color-mix(in oklab,var(--color-sf-tertiary)50%,transparent)
        }
    }

    .border-sf\/10 {
        border-color: #fafafa1a
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-sf\/10 {
            border-color:color-mix(in oklab,var(--color-sf)10%,transparent)
        }
    }

    .border-sf\/25 {
        border-color: #fafafa40
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-sf\/25 {
            border-color:color-mix(in oklab,var(--color-sf)25%,transparent)
        }
    }

    .border-sky-200 {
        border-color: var(--color-sky-200)
    }

    .border-sky-300 {
        border-color: var(--color-sky-300)
    }

    .border-slate-200 {
        border-color: var(--color-slate-200)
    }

    .border-slate-300 {
        border-color: var(--color-slate-300)
    }

    .border-sr-green-100 {
        border-color: var(--color-sr-green-100)
    }

    .border-sr-green-200 {
        border-color: var(--color-sr-green-200)
    }

    .border-sr-green-200\/75 {
        border-color: #c8e4b0bf
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-sr-green-200\/75 {
            border-color:color-mix(in oklab,var(--color-sr-green-200)75%,transparent)
        }
    }

    .border-sr-green-300 {
        border-color: var(--color-sr-green-300)
    }

    .border-sr-grey-500 {
        border-color: var(--color-sr-grey-500)
    }

    .border-sr-indigo-50 {
        border-color: var(--color-sr-indigo-50)
    }

    .border-sr-indigo-100 {
        border-color: var(--color-sr-indigo-100)
    }

    .border-sr-indigo-200 {
        border-color: var(--color-sr-indigo-200)
    }

    .border-sr-indigo-200\/50 {
        border-color: #d2dff980
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-sr-indigo-200\/50 {
            border-color:color-mix(in oklab,var(--color-sr-indigo-200)50%,transparent)
        }
    }

    .border-sr-indigo-200\/75 {
        border-color: #d2dff9bf
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-sr-indigo-200\/75 {
            border-color:color-mix(in oklab,var(--color-sr-indigo-200)75%,transparent)
        }
    }

    .border-sr-indigo-300 {
        border-color: var(--color-sr-indigo-300)
    }

    .border-sr-indigo-400 {
        border-color: var(--color-sr-indigo-400)
    }

    .border-sr-indigo-600 {
        border-color: var(--color-sr-indigo-600)
    }

    .border-sr-indigo-800 {
        border-color: var(--color-sr-indigo-800)
    }

    .border-sr-orange-100 {
        border-color: var(--color-sr-orange-100)
    }

    .border-sr-orange-200 {
        border-color: var(--color-sr-orange-200)
    }

    .border-sr-orange-200\/40 {
        border-color: #fddcce66
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-sr-orange-200\/40 {
            border-color:color-mix(in oklab,var(--color-sr-orange-200)40%,transparent)
        }
    }

    .border-sr-orange-200\/75 {
        border-color: #fddccebf
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-sr-orange-200\/75 {
            border-color:color-mix(in oklab,var(--color-sr-orange-200)75%,transparent)
        }
    }

    .border-sr-orange-300 {
        border-color: var(--color-sr-orange-300)
    }

    .border-sr-orange-400\/30 {
        border-color: #f599704d
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-sr-orange-400\/30 {
            border-color:color-mix(in oklab,var(--color-sr-orange-400)30%,transparent)
        }
    }

    .border-sr-orange-400\/40 {
        border-color: #f5997066
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-sr-orange-400\/40 {
            border-color:color-mix(in oklab,var(--color-sr-orange-400)40%,transparent)
        }
    }

    .border-sr-orange-400\/60 {
        border-color: #f5997099
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-sr-orange-400\/60 {
            border-color:color-mix(in oklab,var(--color-sr-orange-400)60%,transparent)
        }
    }

    .border-sr-orange-600 {
        border-color: var(--color-sr-orange-600)
    }

    .border-sr-pink-100 {
        border-color: var(--color-sr-pink-100)
    }

    .border-sr-pink-200 {
        border-color: var(--color-sr-pink-200)
    }

    .border-sr-red-100 {
        border-color: var(--color-sr-red-100)
    }

    .border-sr-red-200 {
        border-color: var(--color-sr-red-200)
    }

    .border-sr-red-400 {
        border-color: var(--color-sr-red-400)
    }

    .border-sr-red-500 {
        border-color: var(--color-sr-red-500)
    }

    .border-sr-red-500\/30 {
        border-color: #b815144d
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-sr-red-500\/30 {
            border-color:color-mix(in oklab,var(--color-sr-red-500)30%,transparent)
        }
    }

    .border-sr-sf-black {
        border-color: var(--color-sr-sf-black)
    }

    .border-sr-yellow-200 {
        border-color: var(--color-sr-yellow-200)
    }

    .border-st {
        border-color: var(--color-st)
    }

    .border-st-secondary {
        border-color: var(--color-st-secondary)
    }

    .border-st-secondary\/30 {
        border-color: #f0f0f04d
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-st-secondary\/30 {
            border-color:color-mix(in oklab,var(--color-st-secondary)30%,transparent)
        }
    }

    .border-st-secondary\/35 {
        border-color: #f0f0f059
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-st-secondary\/35 {
            border-color:color-mix(in oklab,var(--color-st-secondary)35%,transparent)
        }
    }

    .border-st-secondary\/40 {
        border-color: #f0f0f066
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-st-secondary\/40 {
            border-color:color-mix(in oklab,var(--color-st-secondary)40%,transparent)
        }
    }

    .border-st-secondary\/50 {
        border-color: #f0f0f080
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-st-secondary\/50 {
            border-color:color-mix(in oklab,var(--color-st-secondary)50%,transparent)
        }
    }

    .border-st-secondary\/60 {
        border-color: #f0f0f099
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-st-secondary\/60 {
            border-color:color-mix(in oklab,var(--color-st-secondary)60%,transparent)
        }
    }

    .border-st-secondary\/70 {
        border-color: #f0f0f0b3
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-st-secondary\/70 {
            border-color:color-mix(in oklab,var(--color-st-secondary)70%,transparent)
        }
    }

    .border-st-secondary\/75 {
        border-color: #f0f0f0bf
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-st-secondary\/75 {
            border-color:color-mix(in oklab,var(--color-st-secondary)75%,transparent)
        }
    }

    .border-st-secondary\/80 {
        border-color: #f0f0f0cc
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-st-secondary\/80 {
            border-color:color-mix(in oklab,var(--color-st-secondary)80%,transparent)
        }
    }

    .border-st\/25 {
        border-color: #e6e6e640
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-st\/25 {
            border-color:color-mix(in oklab,var(--color-st)25%,transparent)
        }
    }

    .border-st\/30 {
        border-color: #e6e6e64d
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-st\/30 {
            border-color:color-mix(in oklab,var(--color-st)30%,transparent)
        }
    }

    .border-st\/40 {
        border-color: #e6e6e666
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-st\/40 {
            border-color:color-mix(in oklab,var(--color-st)40%,transparent)
        }
    }

    .border-st\/50 {
        border-color: #e6e6e680
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-st\/50 {
            border-color:color-mix(in oklab,var(--color-st)50%,transparent)
        }
    }

    .border-st\/60 {
        border-color: #e6e6e699
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-st\/60 {
            border-color:color-mix(in oklab,var(--color-st)60%,transparent)
        }
    }

    .border-st\/75 {
        border-color: #e6e6e6bf
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-st\/75 {
            border-color:color-mix(in oklab,var(--color-st)75%,transparent)
        }
    }

    .border-stone-100 {
        border-color: var(--color-stone-100)
    }

    .border-stone-200 {
        border-color: var(--color-stone-200)
    }

    .border-stone-300\/45 {
        border-color: #d6d3d173
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-stone-300\/45 {
            border-color:color-mix(in oklab,var(--color-stone-300)45%,transparent)
        }
    }

    .border-teal-200 {
        border-color: var(--color-teal-200)
    }

    .border-transparent {
        border-color: #0000
    }

    .border-tx {
        border-color: var(--color-tx)
    }

    .border-tx-secondary\/10 {
        border-color: #3d3d3d1a
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-tx-secondary\/10 {
            border-color:color-mix(in oklab,var(--color-tx-secondary)10%,transparent)
        }
    }

    .border-tx\/5 {
        border-color: #1f1f1f0d
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-tx\/5 {
            border-color:color-mix(in oklab,var(--color-tx)5%,transparent)
        }
    }

    .border-tx\/8 {
        border-color: #1f1f1f14
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-tx\/8 {
            border-color:color-mix(in oklab,var(--color-tx)8%,transparent)
        }
    }

    .border-tx\/10 {
        border-color: #1f1f1f1a
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-tx\/10 {
            border-color:color-mix(in oklab,var(--color-tx)10%,transparent)
        }
    }

    .border-tx\/20 {
        border-color: #1f1f1f33
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-tx\/20 {
            border-color:color-mix(in oklab,var(--color-tx)20%,transparent)
        }
    }

    .border-violet-200 {
        border-color: var(--color-violet-200)
    }

    .border-white {
        border-color: var(--color-white)
    }

    .border-white\/5 {
        border-color: #ffffff0d
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-white\/5 {
            border-color:color-mix(in oklab,var(--color-white)5%,transparent)
        }
    }

    .border-white\/10 {
        border-color: #ffffff1a
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-white\/10 {
            border-color:color-mix(in oklab,var(--color-white)10%,transparent)
        }
    }

    .border-white\/12 {
        border-color: #ffffff1f
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-white\/12 {
            border-color:color-mix(in oklab,var(--color-white)12%,transparent)
        }
    }

    .border-white\/15 {
        border-color: #ffffff26
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-white\/15 {
            border-color:color-mix(in oklab,var(--color-white)15%,transparent)
        }
    }

    .border-white\/18 {
        border-color: #ffffff2e
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-white\/18 {
            border-color:color-mix(in oklab,var(--color-white)18%,transparent)
        }
    }

    .border-white\/20 {
        border-color: #fff3
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-white\/20 {
            border-color:color-mix(in oklab,var(--color-white)20%,transparent)
        }
    }

    .border-white\/25 {
        border-color: #ffffff40
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-white\/25 {
            border-color:color-mix(in oklab,var(--color-white)25%,transparent)
        }
    }

    .border-white\/30 {
        border-color: #ffffff4d
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-white\/30 {
            border-color:color-mix(in oklab,var(--color-white)30%,transparent)
        }
    }

    .border-white\/40 {
        border-color: #fff6
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-white\/40 {
            border-color:color-mix(in oklab,var(--color-white)40%,transparent)
        }
    }

    .border-white\/45 {
        border-color: #ffffff73
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-white\/45 {
            border-color:color-mix(in oklab,var(--color-white)45%,transparent)
        }
    }

    .border-white\/50 {
        border-color: #ffffff80
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-white\/50 {
            border-color:color-mix(in oklab,var(--color-white)50%,transparent)
        }
    }

    .border-yellow-200 {
        border-color: var(--color-yellow-200)
    }

    .border-yellow-300 {
        border-color: var(--color-yellow-300)
    }

    .border-t-br-orange {
        border-top-color: var(--color-br-orange)
    }

    .border-t-sr-indigo-600 {
        border-top-color: var(--color-sr-indigo-600)
    }

    .border-t-transparent {
        border-top-color: #0000
    }

    .border-t-tx {
        border-top-color: var(--color-tx)
    }

    .border-t-tx-tertiary {
        border-top-color: var(--color-tx-tertiary)
    }

    .border-t-white {
        border-top-color: var(--color-white)
    }

    .border-t-white\/80 {
        border-top-color: #fffc
    }

    @supports (color: color-mix(in lab,red,red)) {
        .border-t-white\/80 {
            border-top-color:color-mix(in oklab,var(--color-white)80%,transparent)
        }
    }

    .bg-\[\#0f0e0d\] {
        background-color: #0f0e0d
    }

    .bg-\[\#0f0f1a\] {
        background-color: #0f0f1a
    }

    .bg-\[\#1a1a1a\] {
        background-color: #1a1a1a
    }

    .bg-\[\#1a1816\] {
        background-color: #1a1816
    }

    .bg-\[\#1e1e1e\] {
        background-color: #1e1e1e
    }

    .bg-\[\#2a2a2a\] {
        background-color: #2a2a2a
    }

    .bg-\[\#2a2c33\] {
        background-color: #2a2c33
    }

    .bg-\[\#2d2d2d\] {
        background-color: #2d2d2d
    }

    .bg-\[\#3a2a18\] {
        background-color: #3a2a18
    }

    .bg-\[\#111\] {
        background-color: #111
    }

    .bg-\[\#818cf8\] {
        background-color: #818cf8
    }

    .bg-\[\#7289DA\] {
        background-color: #7289da
    }

    .bg-\[\#18181b\] {
        background-color: #18181b
    }

    .bg-\[\#131313\] {
        background-color: #131313
    }

    .bg-\[\#F9730C\] {
        background-color: #f9730c
    }

    .bg-\[\#e0f5e0\] {
        background-color: #e0f5e0
    }

    .bg-\[\#e8e8ff\] {
        background-color: #e8e8ff
    }

    .bg-\[\#e8f4ff\] {
        background-color: #e8f4ff
    }

    .bg-\[\#ecfdf5\] {
        background-color: #ecfdf5
    }

    .bg-\[\#ededed\] {
        background-color: #ededed
    }

    .bg-\[\#f0eeeb\] {
        background-color: #f0eeeb
    }

    .bg-\[\#f0f0f0\] {
        background-color: #f0f0f0
    }

    .bg-\[\#f3f3f3\] {
        background-color: #f3f3f3
    }

    .bg-\[\#f4f2ee\] {
        background-color: #f4f2ee
    }

    .bg-\[\#f5e8ff\] {
        background-color: #f5e8ff
    }

    .bg-\[\#f5f5f5\] {
        background-color: #f5f5f5
    }

    .bg-\[\#f7f7f9\] {
        background-color: #f7f7f9
    }

    .bg-\[\#f9a24d\] {
        background-color: #f9a24d
    }

    .bg-\[\#fafaf8\] {
        background-color: #fafaf8
    }

    .bg-\[\#fafafa\] {
        background-color: #fafafa
    }

    .bg-\[\#fee9d5\] {
        background-color: #fee9d5
    }

    .bg-\[\#fef3e0\] {
        background-color: #fef3e0
    }

    .bg-\[\#fefefe\] {
        background-color: #fefefe
    }

    .bg-\[\#ffdcb8\] {
        background-color: #ffdcb8
    }

    .bg-\[\#fff3e6\] {
        background-color: #fff3e6
    }

    .bg-\[\#fff4eb\] {
        background-color: #fff4eb
    }

    .bg-\[\#fff5d6\] {
        background-color: #fff5d6
    }

    .bg-\[\#fff7f0\] {
        background-color: #fff7f0
    }

    .bg-\[\#fffefa\] {
        background-color: #fffefa
    }

    .bg-\[rgba\(40\,30\,20\,0\.04\)\] {
        background-color: #281e140a
    }

    .bg-\[rgba\(60\,60\,60\,0\.07\)\] {
        background-color: #3c3c3c12
    }

    .bg-\[rgba\(66\,80\,213\,0\.07\)\] {
        background-color: #4250d512
    }

    .bg-\[rgba\(180\,160\,130\,0\.09\)\] {
        background-color: #b4a08217
    }

    .bg-\[rgba\(217\,217\,217\,0\.5\)\] {
        background-color: #d9d9d980
    }

    .bg-\[rgba\(230\,237\,229\,0\.4\)\] {
        background-color: #e6ede566
    }

    .bg-\[rgba\(255\,255\,255\,0\.05\)\] {
        background-color: #ffffff0d
    }

    .bg-amber-50 {
        background-color: var(--color-amber-50)
    }

    .bg-amber-50\/50 {
        background-color: #fffbeb80
    }

    @supports (color: color-mix(in lab,red,red)) {
        .bg-amber-50\/50 {
            background-color:color-mix(in oklab,var(--color-amber-50)50%,transparent)
        }
    }

    .bg-amber-50\/60 {
        background-color: #fffbeb99
    }

    @supports (color: color-mix(in lab,red,red)) {
        .bg-amber-50\/60 {
            background-color:color-mix(in oklab,var(--color-amber-50)60%,transparent)
        }
    }

    .bg-amber-100 {
        background-color: var(--color-amber-100)
    }

    .bg-amber-400 {
        background-color: var(--color-amber-400)
    }

    .bg-amber-500 {
        background-color: var(--color-amber-500)
    }

    .bg-black {
        background-color: var(--color-black)
    }

    .bg-black\/5 {
        background-color: #0000000d
    }

    @supports (color: color-mix(in lab,red,red)) {
        .bg-black\/5 {
            background-color:color-mix(in oklab,var(--color-black)5%,transparent)
        }
    }

    .bg-black\/15 {
        background-color: #00000026
    }

    @supports (color: color-mix(in lab,red,red)) {
        .bg-black\/15 {
            background-color:color-mix(in oklab,var(--color-black)15%,transparent)
        }
    }

    .bg-black\/20 {
        background-color: #0003
    }

    @supports (color: color-mix(in lab,red,red)) {
        .bg-black\/20 {
            background-color:color-mix(in oklab,var(--color-black)20%,transparent)
        }
    }

    .bg-black\/25 {
        background-color: #00000040
    }

    @supports (color: color-mix(in lab,red,red)) {
        .bg-black\/25 {
            background-color:color-mix(in oklab,var(--color-black)25%,transparent)
        }
    }

    .bg-black\/30 {
        background-color: #0000004d
    }

    @supports (color: color-mix(in lab,red,red)) {
        .bg-black\/30 {
            background-color:color-mix(in oklab,var(--color-black)30%,transparent)
        }
    }

    .bg-black\/35 {
        background-color: #00000059
    }

    @supports (color: color-mix(in lab,red,red)) {
        .bg-black\/35 {
            background-color:color-mix(in oklab,var(--color-black)35%,transparent)
        }
    }

    .bg-black\/40 {
        background-color: #0006
    }

    @supports (color: color-mix(in lab,red,red)) {
        .bg-black\/40 {
            background-color:color-mix(in oklab,var(--color-black)40%,transparent)
        }
    }

    .bg-black\/50 {
        background-color: #00000080
    }

    @supports (color: color-mix(in lab,red,red)) {
        .bg-black\/50 {
            background-color:color-mix(in oklab,var(--color-black)50%,transparent)
        }
    }

    .bg-black\/60 {
        background-color: #0009
    }

    @supports (color: color-mix(in lab,red,red)) {
        .bg-black\/60 {
            background-color:color-mix(in oklab,var(--color-black)60%,transparent)
        }
    }

    .bg-black\/65 {
        background-color: #000000a6
    }

    @supp