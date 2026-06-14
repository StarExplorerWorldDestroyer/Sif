# Seaf — Haircut Tracker

A mobile-first app to log, organize, and reference your haircut history — tracking
expenses, styling preferences, stylists, and (eventually) social features. Built with
Expo so it runs on iOS and the web from a single codebase.

Dark-mode only, with a black background and orange accent (Robinhood-inspired aesthetic).

## Tech stack

- [Expo](https://expo.dev) (SDK 54) + [Expo Router](https://docs.expo.dev/router/introduction/) (file-based navigation)
- React Native + TypeScript
- Local persistence via `@react-native-async-storage/async-storage`
- Photos via `expo-image-picker`

## Getting started

```bash
npm install
npx expo start
```

Then scan the QR code with the **Expo Go** app on your iPhone (same Wi-Fi network),
or press `w` to open the web version.

If you hit a stale-cache error ("requiring unknown module"), restart with `npx expo start -c`.

## Project structure

- `app/` — screens & navigation (Expo Router). Each file is a route.
  - `(tabs)/` — bottom tabs: `index` (Cuts), `explore`, `profile`
  - `haircut/[id].tsx` — haircut detail screen
  - `add.tsx` — add-a-haircut form (modal)
- `components/ui/` — reusable building blocks (Screen, Card, Txt, Pill, Field, icons)
- `components/cuts/` — dashboard pieces (stats panel, time filter, haircut card)
- `constants/theme.ts` — design tokens (colors, spacing, radii, type sizes)
- `store/haircuts.tsx` — shared haircut data + local persistence
- `lib/format.ts` — currency/date formatting + stats helpers
- `types/` — shared TypeScript types
- `data/` — seed/mock data

## Status

Core MVP working: Cuts dashboard (live stats + time filters), haircut detail
(privacy toggle, like/bookmark, stylist, specs, notes), add-a-haircut with photo,
and local persistence.

### Next up

- Edit/delete haircuts; persist likes & bookmarks
- Backend + accounts (Supabase) to enable the website and cross-device sync
- Social features (Explore feed, comments, stylist booking)
