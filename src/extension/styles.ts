export const styles = `
  .tribe-extension-root {
    position: absolute;
    inset: 0;
    pointer-events: none;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .tribe-rive-frame {
    position: absolute;
    pointer-events: auto;
    min-width: 320px;
    min-height: 180px;
    border: 2px dashed rgba(240, 193, 90, 0.85);
    background:
      linear-gradient(135deg, rgba(14, 111, 104, 0.22), rgba(240, 193, 90, 0.16)),
      rgba(24, 63, 59, 0.18);
  }

  .tribe-rive-canvas {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
    outline: 0;
  }

  .tribe-rive-status {
    position: absolute;
    left: 16px;
    bottom: 16px;
    max-width: min(320px, calc(100% - 32px));
    padding: 10px 12px;
    border-radius: 8px;
    background: rgba(24, 63, 59, 0.88);
    color: #ffffff;
    font-size: 13px;
    line-height: 1.35;
    pointer-events: none;
    z-index: 2;
  }
`

export const commandHarnessStyles = `
  :host {
    position: relative;
  }

  .tribe-command-harness {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 2147483647;
    display: grid;
    gap: 8px;
    width: min(260px, calc(100vw - 32px));
    padding: 10px;
    border: 1px solid rgba(24, 63, 59, 0.22);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
    color: #183f3b;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    pointer-events: auto;
  }

  .tribe-command-harness.is-epic-native-passthrough-right {
    right: auto;
    left: 16px;
  }

  .tribe-command-harness.is-completion-handoff {
    display: none !important;
    pointer-events: none !important;
  }

  .tribe-command-harness__title {
    margin: 0;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.2;
  }

  .tribe-command-harness__controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .tribe-command-harness__button {
    min-height: 36px;
    border: 0;
    border-radius: 6px;
    background: #f0c15a;
    color: #111827;
    cursor: pointer;
    font: 800 13px/1 Inter, ui-sans-serif, system-ui, sans-serif;
    letter-spacing: 0;
  }

  .tribe-command-harness__button:hover,
  .tribe-command-harness__button:focus-visible {
    background: #ffd978;
    outline: 2px solid rgba(24, 63, 59, 0.45);
    outline-offset: 2px;
  }

  .tribe-command-harness__preview {
    display: grid;
    gap: 4px;
  }

  .tribe-command-harness__stage {
    box-sizing: border-box;
    position: relative;
    width: 100%;
    aspect-ratio: 3 / 4;
    border: 1px solid rgba(24, 63, 59, 0.18);
    border-radius: 6px;
    background: #ffffff;
    overflow: hidden;
  }

  .tribe-command-harness__stage.is-reader-overlay {
    position: absolute;
    inset: 0;
    z-index: 2147483000;
    width: 100%;
    height: 100%;
    aspect-ratio: auto;
    border: 0;
    border-radius: 0;
    background: transparent;
    pointer-events: auto;
  }

  .tribe-command-harness__stage.is-reader-overlay.is-takeover {
    background: #ffffff;
  }

  .tribe-command-harness__stage.is-reader-overlay.is-takeover.is-epic-native-shell {
    background: transparent;
  }

  .tribe-command-harness__stage.is-reader-overlay.is-own-book-frame {
    border: var(--tribe-command-harness-book-frame-border, 3px solid #111111);
    border-radius: 0;
    background: #ffffff;
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.88);
  }

  .tribe-command-harness__stage.is-reader-overlay.is-takeover.is-native-passthrough-suspended {
    background: transparent;
  }

  .tribe-command-harness__stage.is-reader-overlay.is-epic-native-passthrough {
    pointer-events: auto;
  }

  .tribe-command-harness__stage.is-reader-overlay.is-epic-native-passthrough-left:not(.is-epic-native-passthrough-right) {
    clip-path: inset(0 0 0 50%);
  }

  .tribe-command-harness__stage.is-reader-overlay.is-epic-native-passthrough-right:not(.is-epic-native-passthrough-left) {
    clip-path: inset(0 50% 0 0);
  }

  .tribe-command-harness__stage.is-reader-overlay.is-epic-native-passthrough-left.is-epic-native-passthrough-right {
    opacity: 0;
    pointer-events: none;
  }

  .tribe-command-harness__stage.is-reader-overlay.is-completion-handoff {
    display: none !important;
    opacity: 0;
    pointer-events: none !important;
    visibility: hidden;
  }

  .tribe-command-harness__canvas {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
    background: transparent;
    pointer-events: auto;
  }

  .tribe-command-harness__stage.is-reader-overlay.is-epic-native-passthrough-left.is-epic-native-passthrough-right
    .tribe-command-harness__canvas {
    pointer-events: none !important;
  }

  .tribe-command-harness__edge-gutter {
    box-sizing: border-box;
    position: absolute;
    z-index: 2147483200;
    display: block;
    border: 0;
    margin: 0;
    padding: 0;
    background: transparent;
    outline: 0;
    pointer-events: auto;
    touch-action: manipulation;
  }

  .tribe-command-harness__edge-gutter[hidden] {
    display: none;
  }

  .tribe-command-harness__edge-gutter--back {
    cursor: -webkit-image-set(
        url("/assets/app/read/page-turn-arrows/icn-back-page@2x.png") 1x,
        url("/assets/app/read/page-turn-arrows/icn-back-page@2x.png") 2x
      )
      28 28,
      pointer;
  }

  .tribe-command-harness__edge-gutter--next {
    cursor: -webkit-image-set(
        url("/assets/app/read/page-turn-arrows/icn-next-page@2x.png") 1x,
        url("/assets/app/read/page-turn-arrows/icn-next-page@2x.png") 2x
      )
      28 28,
      pointer;
  }

  .tribe-command-harness__edge-gutter::after {
    display: none;
  }

  .tribe-command-harness__status {
    min-height: 16px;
    margin: 0;
    color: #4d625d;
    font-size: 11px;
    line-height: 1.35;
  }
`

export const drawerStyles = `
  .tribe-drawer {
    box-sizing: border-box;
    display: grid;
    gap: 16px;
    align-content: start;
    min-height: 100%;
    padding: 24px;
    background: #fbfaf7;
    color: #20302d;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .tribe-drawer h2 {
    margin: 0;
    color: #183f3b;
    font-size: 22px;
    line-height: 1.18;
    letter-spacing: 0;
  }

  .tribe-drawer p {
    margin: 0;
    color: #4d625d;
    font-size: 14px;
    line-height: 1.55;
    letter-spacing: 0;
  }

  .tribe-meta {
    display: grid;
    gap: 8px;
    padding: 14px;
    border: 1px solid #d9ddd5;
    border-radius: 8px;
    background: #ffffff;
  }

  .tribe-meta-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    color: #2f4540;
    font-size: 13px;
    line-height: 1.35;
  }

  .tribe-meta-row strong {
    color: #183f3b;
    font-weight: 700;
  }

  .tribe-close {
    justify-self: start;
    border: 0;
    border-radius: 6px;
    padding: 10px 14px;
    background: #183f3b;
    color: #ffffff;
    cursor: pointer;
    font: 700 14px/1 Inter, ui-sans-serif, system-ui, sans-serif;
    letter-spacing: 0;
  }

  .tribe-close:hover {
    background: #0e6f68;
  }
`

export const simpleOverlayStyles = `
  .tribe-simple-overlay-root {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 2147483647;
  }


  .tribe-simple-overlay-root.is-reading-area-replacement {
    background: transparent;
  }

  .tribe-simple-overlay-root.is-reading-area-replacement.is-hiding-reader-content {
    background: var(--tribe-rive-replacement-backdrop, #ffffff);
  }

  .tribe-simple-overlay-root.is-epic-native-passthrough {
    background: transparent !important;
  }

  .tribe-simple-overlay-root.is-reading-area-replacement .tribe-simple-rive-frame {
    background: var(--tribe-rive-replacement-backdrop, #ffffff);
  }

  .tribe-simple-overlay-root.is-epic-native-passthrough-left:not(.is-epic-native-passthrough-right)
    .tribe-simple-rive-frame {
    clip-path: inset(0 0 0 50%);
  }

  .tribe-simple-overlay-root.is-epic-native-passthrough-right:not(.is-epic-native-passthrough-left)
    .tribe-simple-rive-frame {
    clip-path: inset(0 50% 0 0);
  }

  .tribe-simple-overlay-root.is-epic-native-passthrough-left.is-epic-native-passthrough-right
    .tribe-simple-rive-frame {
    opacity: 0;
    pointer-events: none !important;
  }

  .tribe-simple-reading-mask {
    position: absolute;
    z-index: 0;
    background: var(--tribe-rive-replacement-backdrop, #ffffff);
    pointer-events: none;
  }

  .tribe-simple-reading-mask[hidden] {
    display: none;
  }

  .tribe-simple-rive-frame {
    position: absolute;
    z-index: 1;
    overflow: hidden;
    background: transparent;
    pointer-events: none;
    isolation: isolate;
    contain: layout paint;
    --tribe-page-flip-ms: 520ms;
  }

  .tribe-simple-rive-canvas {
    display: block;
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    background: transparent;
    border: 0;
    outline: 0;
    opacity: 1;
    pointer-events: none;
    transform: translateZ(0);
    transform-origin: center center;
    transition: opacity 140ms ease;
    will-change: opacity, transform, filter;
  }

  .tribe-simple-rive-canvas.tribe-simple-interaction-canvas {
    cursor: pointer;
    opacity: 0;
    pointer-events: none;
    transition: none;
    z-index: 3;
  }

  .tribe-simple-overlay-root.is-rive-interactive .tribe-simple-interaction-canvas {
    pointer-events: auto;
  }

  .tribe-simple-completion-page {
    box-sizing: border-box;
    position: absolute;
    inset: 0;
    z-index: 3;
    display: grid;
    place-items: center;
    background: #ffffff;
    pointer-events: none;
  }

  .tribe-simple-completion-page[hidden] {
    display: none;
  }

  .tribe-simple-completion-page .book-precompletion-page-container {
    box-sizing: border-box;
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
  }

  .tribe-simple-completion-page .almost-done {
    display: block;
    max-width: min(72%, 520px);
    max-height: 72%;
    object-fit: contain;
  }

  .tribe-simple-overlay-root.is-rive-interactive .tribe-simple-rive-frame {
    pointer-events: auto;
  }

  .tribe-simple-overlay-root.is-rive-interactive .tribe-simple-active-canvas {
    cursor: pointer;
    pointer-events: auto;
  }

  .tribe-simple-overlay-root.is-rive-interactive .tribe-simple-loading-canvas {
    pointer-events: none;
  }

  .tribe-simple-overlay-root.is-epic-native-passthrough-left.is-epic-native-passthrough-right
    .tribe-simple-rive-frame,
  .tribe-simple-overlay-root.is-epic-native-passthrough-left.is-epic-native-passthrough-right
    .tribe-simple-rive-canvas,
  .tribe-simple-overlay-root.is-epic-native-passthrough-left.is-epic-native-passthrough-right
    .tribe-word-hotspot-button {
    pointer-events: none !important;
  }

  .tribe-simple-overlay-root.is-epic-native-passthrough-left .tribe-simple-nav-gutter--back,
  .tribe-simple-overlay-root.is-epic-native-passthrough-right .tribe-simple-nav-gutter--next {
    pointer-events: none !important;
  }

  .tribe-simple-transition-canvas {
    position: absolute;
    inset: 0;
    z-index: 6;
    width: 100%;
    height: 100%;
    opacity: 0;
    pointer-events: none;
  }

  .tribe-simple-nav-gutter {
    box-sizing: border-box;
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 20;
    display: block;
    border: 0;
    margin: 0;
    padding: 0;
    background: transparent;
    outline: 0;
    pointer-events: auto;
    touch-action: manipulation;
  }

  .tribe-simple-nav-gutter[hidden] {
    display: none;
  }

  .tribe-simple-nav-gutter--back {
    cursor: -webkit-image-set(
        url("/assets/app/read/page-turn-arrows/icn-back-page@2x.png") 1x,
        url("/assets/app/read/page-turn-arrows/icn-back-page@2x.png") 2x
      )
      28 28,
      pointer;
  }

  .tribe-simple-nav-gutter--next {
    cursor: -webkit-image-set(
        url("/assets/app/read/page-turn-arrows/icn-next-page@2x.png") 1x,
        url("/assets/app/read/page-turn-arrows/icn-next-page@2x.png") 2x
      )
      28 28,
      pointer;
  }

  .tribe-simple-nav-gutter::after {
    content: "";
    position: absolute;
    top: 50%;
    width: 56px;
    height: 56px;
    opacity: 0;
    pointer-events: none;
    transform: translateY(-50%);
    transition: opacity 100ms ease;
    background-position: center;
    background-repeat: no-repeat;
    background-size: contain;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.22));
  }

  .tribe-simple-nav-gutter--back::after {
    left: 6px;
    background-image: url("/assets/app/read/page-turn-arrows/icn-back-page@2x.png");
  }

  .tribe-simple-nav-gutter--next::after {
    right: 6px;
    background-image: url("/assets/app/read/page-turn-arrows/icn-next-page@2x.png");
  }

  .tribe-simple-nav-gutter:hover::after,
  .tribe-simple-nav-gutter:focus-visible::after {
    opacity: 1;
  }

  .tribe-simple-rive-frame::before,
  .tribe-simple-rive-frame::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    opacity: 0;
    pointer-events: none;
  }

  .tribe-simple-rive-frame::before {
    width: 50%;
    z-index: 4;
    background:
      linear-gradient(90deg, rgba(255, 255, 255, 0.08), rgba(0, 0, 0, 0.08));
    box-shadow: 0 0 14px rgba(0, 0, 0, 0.14);
  }

  .tribe-simple-rive-frame::after {
    width: 10px;
    z-index: 5;
    background:
      linear-gradient(
        90deg,
        rgba(0, 0, 0, 0),
        rgba(0, 0, 0, 0.16),
        rgba(255, 255, 255, 0.2),
        rgba(0, 0, 0, 0)
      );
  }

  .tribe-simple-rive-frame.is-flipping-next::before {
    left: 50%;
    transform-origin: left center;
    animation: tribe-simple-page-cover-next var(--tribe-page-flip-ms) cubic-bezier(0.32, 0.72, 0.24, 1) both;
  }

  .tribe-simple-rive-frame.is-flipping-back::before {
    right: 50%;
    transform-origin: right center;
    animation: tribe-simple-page-cover-back var(--tribe-page-flip-ms) cubic-bezier(0.32, 0.72, 0.24, 1) both;
  }

  .tribe-simple-rive-frame.is-flipping-next::after {
    left: calc(50% - 5px);
    animation: tribe-simple-page-crease var(--tribe-page-flip-ms) cubic-bezier(0.32, 0.72, 0.24, 1) both;
  }

  .tribe-simple-rive-frame.is-flipping-back::after {
    right: calc(50% - 5px);
    animation: tribe-simple-page-crease var(--tribe-page-flip-ms) cubic-bezier(0.32, 0.72, 0.24, 1) both;
  }

  .tribe-simple-rive-frame.is-flipping-next .tribe-simple-active-canvas {
    animation: tribe-simple-page-hold var(--tribe-page-flip-ms) cubic-bezier(0.25, 0.82, 0.22, 1) both;
  }

  .tribe-simple-rive-frame.is-flipping-back .tribe-simple-active-canvas {
    animation: tribe-simple-page-hold var(--tribe-page-flip-ms) cubic-bezier(0.25, 0.82, 0.22, 1) both;
  }

  @keyframes tribe-simple-page-hold {
    0% {
      filter: brightness(1);
      transform: translateX(0) scale(1);
    }
    48% {
      filter: brightness(0.97);
      transform: translateX(0) scale(1);
    }
    100% {
      filter: brightness(1);
      transform: translateX(0) scale(1);
    }
  }

  @keyframes tribe-simple-page-cover-next {
    0% {
      opacity: 0;
      transform: scaleX(0);
    }
    16% {
      opacity: 0.28;
      transform: scaleX(0.08);
    }
    58% {
      opacity: 0.28;
      transform: scaleX(1);
    }
    100% {
      opacity: 0;
      transform: scaleX(1);
    }
  }

  @keyframes tribe-simple-page-cover-back {
    0% {
      opacity: 0;
      transform: scaleX(0);
    }
    16% {
      opacity: 0.28;
      transform: scaleX(0.08);
    }
    58% {
      opacity: 0.28;
      transform: scaleX(1);
    }
    100% {
      opacity: 0;
      transform: scaleX(1);
    }
  }

  @keyframes tribe-simple-page-crease {
    0% {
      opacity: 0;
    }
    18% {
      opacity: 0.34;
    }
    62% {
      opacity: 0.34;
    }
    100% {
      opacity: 0;
    }
  }

  .tribe-simple-rive-status {
    position: absolute;
    top: 12px;
    right: 12px;
    max-width: min(360px, calc(100% - 24px));
    padding: 8px 10px;
    border-radius: 6px;
    background: rgba(16, 20, 18, 0.84);
    color: #ffffff;
    font-size: 12px;
    line-height: 1.35;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    pointer-events: none;
  }

  .tribe-simple-rive-start {
    position: absolute;
    right: 12px;
    bottom: 12px;
    z-index: 6;
    border: 0;
    border-radius: 6px;
    padding: 10px 12px;
    background: #006dff;
    color: #ffffff;
    cursor: pointer;
    font: 700 13px/1 Inter, ui-sans-serif, system-ui, sans-serif;
    pointer-events: auto;
  }

  .tribe-simple-rive-start[hidden] {
    display: none;
  }

  .tribe-simple-sequential-controls {
    position: absolute;
    left: 12px;
    bottom: 12px;
    z-index: 7;
    display: flex;
    gap: 8px;
    pointer-events: auto;
  }

  .tribe-simple-sequential-controls[hidden] {
    display: none;
  }

  .tribe-simple-sequential-controls button {
    border: 0;
    border-radius: 6px;
    padding: 9px 12px;
    background: #006dff;
    color: #ffffff;
    cursor: pointer;
    font: 700 13px/1 Inter, ui-sans-serif, system-ui, sans-serif;
  }

  .tribe-simple-state-controls {
    box-sizing: border-box;
    position: absolute;
    left: 12px;
    top: 12px;
    z-index: 8;
    display: grid;
    gap: 8px;
    width: min(420px, calc(100% - 24px));
    max-height: calc(100% - 24px);
    overflow: auto;
    padding: 10px;
    border-radius: 8px;
    background: rgba(16, 20, 18, 0.88);
    color: #ffffff;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    pointer-events: auto;
  }

  .tribe-simple-state-controls[hidden] {
    display: none;
  }

  .tribe-simple-state-controls strong {
    display: block;
    font-size: 12px;
    line-height: 1.25;
    letter-spacing: 0;
  }

  .tribe-simple-state-controls small {
    display: block;
    color: rgba(255, 255, 255, 0.72);
    font-size: 11px;
    line-height: 1.35;
    letter-spacing: 0;
  }

  .tribe-simple-state-control-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tribe-simple-state-controls button {
    border: 0;
    border-radius: 6px;
    padding: 8px 10px;
    background: #f0c15a;
    color: #151a18;
    cursor: pointer;
    font: 800 12px/1 Inter, ui-sans-serif, system-ui, sans-serif;
    letter-spacing: 0;
  }

  .tribe-simple-state-controls button.secondary {
    background: #d7ebe7;
  }

  .tribe-simple-state-controls button[disabled] {
    cursor: not-allowed;
    opacity: 0.58;
  }

  .tribe-word-hotspot-layer {
    position: absolute;
    inset: 0;
    z-index: 12;
    pointer-events: none;
  }

  .tribe-word-hotspot-layer[hidden] {
    display: none;
  }

  :host-context(.tribe-word-lookup-passthrough) .tribe-simple-rive-frame,
  :host-context(.tribe-word-lookup-passthrough) .tribe-simple-rive-canvas,
  :host-context(.tribe-word-lookup-passthrough) .tribe-simple-nav-gutter,
  :host-context(.tribe-word-lookup-passthrough) .tribe-word-hotspot-layer,
  :host-context(.tribe-word-lookup-passthrough) .tribe-word-hotspot-button {
    pointer-events: none !important;
  }

  .tribe-word-hotspot-button {
    position: absolute;
    z-index: 1;
    box-sizing: border-box;
    border: 0;
    border-radius: 0;
    padding: 0;
    background: transparent;
    color: transparent;
    cursor: pointer;
    font: 0/0 sans-serif;
    isolation: isolate;
    overflow: visible;
    pointer-events: auto;
  }

  .tribe-word-hotspot-button::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 3;
    box-sizing: border-box;
    outline: var(--tribe-word-hotspot-stroke, 3px) solid transparent;
    outline-offset: 0;
    pointer-events: none;
    transform: scale(
      var(--tribe-word-hotspot-outline-scale-x, 1.08),
      var(--tribe-word-hotspot-outline-scale-y, 1.16)
    );
    transform-origin: center;
    box-shadow: none;
    transition:
      outline-color 80ms ease,
      box-shadow 80ms ease;
  }

  .tribe-word-hotspot-button:hover::before,
  .tribe-word-hotspot-button:focus-visible::before,
  .tribe-word-hotspot-button.is-read-along-active::before {
    outline-color: #000000;
    box-shadow:
      var(--tribe-word-hotspot-shadow-x, 5px)
      var(--tribe-word-hotspot-shadow-y, 5px)
      0
      #000000;
  }

  .tribe-word-hotspot-button.is-suspect {
    background: transparent;
  }

  .tribe-word-hotspot-button.is-suspect:hover::before,
  .tribe-word-hotspot-button.is-suspect:focus-visible::before {
    outline-color: #000000;
  }

  .tribe-word-hotspot-button:hover,
  .tribe-word-hotspot-button:focus-visible,
  .tribe-word-hotspot-button.is-read-along-active {
    background: transparent;
    box-shadow: none;
    outline: none;
  }

  .tribe-word-hotspot-magnifier {
    position: absolute;
    left: 50%;
    top: 50%;
    z-index: 2;
    display: none;
    width: 100%;
    height: 100%;
    background: transparent;
    image-rendering: auto;
    pointer-events: none;
    transform: translate(-50%, -50%) scale(var(--tribe-word-hotspot-word-scale, 1.14));
    transform-origin: center;
  }

  .tribe-word-hotspot-button:hover .tribe-word-hotspot-magnifier,
  .tribe-word-hotspot-button:focus-visible .tribe-word-hotspot-magnifier,
  .tribe-word-hotspot-button.is-read-along-active .tribe-word-hotspot-magnifier {
    display: block;
  }
`

export const standaloneWordHotspotStyles = `
  .tribe-standalone-word-hotspot-root {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    pointer-events: none;
  }

  .tribe-standalone-word-hotspot-root.is-epic-completion-visible {
    display: none !important;
    pointer-events: none !important;
  }

  .tribe-standalone-word-hotspot-frame {
    position: absolute;
    overflow: visible;
    pointer-events: none;
    outline: none;
  }

  .tribe-standalone-word-hotspot-status {
    position: absolute;
    right: 8px;
    top: 8px;
    z-index: 2;
    max-width: min(360px, calc(100% - 16px));
    border-radius: 6px;
    padding: 7px 9px;
    background: rgba(9, 74, 78, 0.92);
    color: #ffffff;
    font: 700 12px/1.3 Inter, ui-sans-serif, system-ui, sans-serif;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
    pointer-events: none;
  }

  html.tribe-word-lookup-passthrough .tribe-standalone-word-hotspot-root,
  html.tribe-word-lookup-passthrough .tribe-standalone-word-hotspot-frame,
  html.tribe-word-lookup-passthrough .tribe-standalone-word-hotspot-button {
    pointer-events: none !important;
  }

  .tribe-standalone-word-hotspot-button {
    position: absolute;
    z-index: 1;
    box-sizing: border-box;
    min-width: 10px;
    min-height: 10px;
    border: 0;
    border-radius: 0;
    padding: 0;
    background: transparent;
    color: transparent;
    cursor: pointer;
    font: 0/0 sans-serif;
    isolation: isolate;
    overflow: visible;
    box-shadow: none;
    pointer-events: auto;
  }

  .tribe-standalone-word-hotspot-button::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 3;
    box-sizing: border-box;
    outline: var(--tribe-word-hotspot-stroke, 3px) solid transparent;
    outline-offset: 0;
    pointer-events: none;
    transform: scale(
      var(--tribe-word-hotspot-outline-scale-x, 1.08),
      var(--tribe-word-hotspot-outline-scale-y, 1.16)
    );
    transform-origin: center;
    box-shadow: none;
    transition:
      outline-color 80ms ease,
      box-shadow 80ms ease;
  }

  .tribe-standalone-word-hotspot-button:hover::before,
  .tribe-standalone-word-hotspot-button:focus-visible::before,
  .tribe-standalone-word-hotspot-button.is-read-along-active::before {
    outline-color: #000000;
    box-shadow:
      var(--tribe-word-hotspot-shadow-x, 5px)
      var(--tribe-word-hotspot-shadow-y, 5px)
      0
      #000000;
  }

  .tribe-standalone-word-hotspot-button.is-suspect {
    background: transparent;
  }

  .tribe-standalone-word-hotspot-button.is-suspect:hover::before,
  .tribe-standalone-word-hotspot-button.is-suspect:focus-visible::before {
    outline-color: #000000;
  }

  .tribe-standalone-word-hotspot-button:hover,
  .tribe-standalone-word-hotspot-button:focus-visible,
  .tribe-standalone-word-hotspot-button.is-read-along-active {
    background: transparent;
    box-shadow: none;
    outline: none;
  }

  .tribe-standalone-word-hotspot-magnifier {
    position: absolute;
    left: 50%;
    top: 50%;
    z-index: 2;
    display: none;
    width: 100%;
    height: 100%;
    background: transparent;
    image-rendering: auto;
    pointer-events: none;
    transform: translate(-50%, -50%) scale(var(--tribe-word-hotspot-word-scale, 1.14));
    transform-origin: center;
  }

  .tribe-standalone-word-hotspot-button:hover .tribe-standalone-word-hotspot-magnifier,
  .tribe-standalone-word-hotspot-button:focus-visible .tribe-standalone-word-hotspot-magnifier,
  .tribe-standalone-word-hotspot-button.is-read-along-active .tribe-standalone-word-hotspot-magnifier {
    display: block;
  }
`
