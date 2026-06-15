# 1Tribe Interactive Extension

Production-oriented Epic Reader extension for 1Tribe Ventures interactive book content.

## Current Milestone

- Active Epic book IDs: `83936`, `83230`, `74774`
- Active book assets: `public/rive/ICanFindIt_83936`, `public/rive/TheWildLifeHummingbirdforaDay_83230`, `public/rive/CreepyCafetorium_74774`
- Extension entry: `TribeInteractiveExtension-main.js`

The extension is structured as a reusable reader integration engine plus book-specific configuration. This milestone ships configured support for `83936`, `83230`, and `74774`.

Future integration candidates:

- Add future books only after the assets, page mapping, and reader behavior are ready for review.

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

Then open the Epic QA reader for a configured book and load the local extension:

```js
localStorage.setItem('epic_debug_skip_page_render', '1')
localStorage.setItem(
  'epic_debug_plugin',
  'http://localhost:8080/TribeInteractiveExtension-main.js?cache=local-review'
)
location.reload()
```

Configured Epic reader books enable their book-specific 1Tribe integration by default. Query-string flags remain available for diagnostics, but they are not required for the normal review path.

This milestone intentionally does not auto-run on unconfigured books. Add a new book config and assets before enabling another Epic book ID.

## Repository Contents

- `src/extension`: extension source
- `public/rive`: Rive runtime files and book-specific `.riv` assets
- `public/rive/ICanFindIt_83936/word-hotspots`: word hotspot timing/position data
- `public/rive-page-map.json`: simple overlay page-to-Rive mapping by book ID
- `scripts/dev-server.mjs`: local static server for QA review

The active book configuration lives in `src/extension/bookConfig.ts`.

Local harness pages, screenshots, saved moments, generated review packages, and experimental assets are intentionally excluded from this repository.

## Epic References

- [Developer Guide](https://github.com/getepic-v2/epic-reader-extension-demo/blob/main/docs/Epic_Reader_Extension_Developer_Guide.md)
- [Onboarding Guide](https://github.com/getepic-v2/epic-reader-extension-demo/blob/main/docs/Onboarding_Guide.md)
- [Open API Documentation](https://github.com/getepic-v2/epic-reader-extension-demo/blob/main/docs/open-api-book.md)

Technical contact: lihaitao6@getepic.com
