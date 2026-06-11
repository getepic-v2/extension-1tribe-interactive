# Milestone Notes

## Scope

This branch packages the current 1Tribe/Epic reader integration as a clean, reproducible milestone.

Active configured book:

- `83936` using `public/rive/ICanFindIt_83936`

Planned future book configs:

- `83230` using the Hummingbird Rive asset set
- `74774` using the Creepy Cafetorium Rive asset set

Future books should be added by extending the book config map in `src/extension/index.ts`, adding that book's assets under `public/rive`, and verifying the spread/page/state-machine mapping.

## Current Integration

- Rive page takeover for the configured book
- Epic frame fitting
- Native Epic page passthrough on preserved pages
- Rive page forward/back animation coordination
- Word hotspot lookup
- Read-along following Epic playback
- Completion/read-again handoff

## Local Review

Use Epic's local debug extension flow:

```js
localStorage.setItem('epic_debug_skip_page_render', '1')
localStorage.setItem(
  'epic_debug_plugin',
  'http://localhost:8080/OneTribeInteractiveExtension-main.js?cache=local-review'
)
location.reload()
```

The visible prototype controls are hidden by default. To show diagnostics during development, add this parameter to the extension URL:

```text
&oneTribeCommandHarnessShowControls=1
```

## Open Epic Questions

- Confirm production takeover configuration through `extensionConfig.skipPageRender`.
- Confirm whether `getPageAudioUrl()` and `getWordTimingData()` remain available for Read to Me books after labData is attached.
- Confirm the preferred API/event for completion UI and Read Again transitions, if one exists.
- Confirm whether Epic can expose a stable playback-state event to replace media-element observation.
- Confirm whether Epic can expose a stable book-frame rect that includes the visible border.

## Known Implementation Notes

The current build uses a few host-DOM observations where the documented Context API does not yet expose an equivalent signal. These are limited to frame fitting, completion/read-again detection, and read-along playback following. They are candidates for replacement if Epic provides stable APIs for those surfaces.
