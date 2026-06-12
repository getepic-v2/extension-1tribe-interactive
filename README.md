# 1Tribe Interactive Extension

Production-oriented Epic Reader extension for 1Tribe Ventures interactive book content.

## Current Milestone

- Active Epic book ID: `83936`
- Active book assets: `public/rive/ICanFindIt_83936`
- Extension entry: `TribeInteractiveExtension-main.js`

The extension is structured as a reusable reader integration engine plus book-specific configuration. This milestone ships the first configured book, `83936`.

Future integration candidates:

- `83230`: Rive assets are not included or enabled in this milestone. Add only after the assets, page mapping, and reader behavior have been reviewed and tested.
- `74774`: not included or enabled in this milestone. Add only after the assets, page mapping, and reader behavior are ready for review.

## Install

```bash
npm install
```

## Build

```bash
npm run build:extension
```

The build writes:

```text
dist-extension/manifest.json
dist-extension/TribeInteractiveExtension-main.js
```

Runtime assets under `public/rive` must be served beside the built extension bundle.

## Local Review

Start the local static server:

```bash
npm run dev:serve
```

Then open the Epic QA reader for book `83936` and load the local extension:

```js
localStorage.setItem('epic_debug_skip_page_render', '1')
localStorage.setItem(
  'epic_debug_plugin',
  'http://localhost:8080/TribeInteractiveExtension-main.js?cache=local-review'
)
location.reload()
```

The supported Epic reader book enables the 1Tribe reader integration, word hotspots, Rive page animation, and read-along following by default. Query-string flags remain available for diagnostics, but they are not required for the normal review path.

This milestone intentionally does not auto-run on unconfigured books. Add a new book config and assets before enabling another Epic book ID.

## Repository Contents

- `src/extension`: extension source
- `public/rive`: Rive runtime files and book-specific `.riv` assets
- `public/rive/ICanFindIt_83936/word-hotspots`: word hotspot timing/position data
- `scripts/dev-server.mjs`: local static server for QA review

The active book configuration lives in `src/extension/bookConfig.ts`.

Local harness pages, screenshots, saved moments, generated review packages, and experimental assets are intentionally excluded from this repository.

## Epic References

- [Developer Guide](https://github.com/getepic-v2/epic-reader-extension-demo/blob/main/docs/Epic_Reader_Extension_Developer_Guide.md)
- [Onboarding Guide](https://github.com/getepic-v2/epic-reader-extension-demo/blob/main/docs/Onboarding_Guide.md)
- [Open API Documentation](https://github.com/getepic-v2/epic-reader-extension-demo/blob/main/docs/open-api-book.md)

Technical contact: lihaitao6@getepic.com
