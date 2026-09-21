# Experiment Inventory

A small HTML canvas gathering game. Click trees and rocks in the clearing, then manage a pack that only holds so much weight and volume.

## Play

Live: [https://nattstack.github.io/experiment-inventory/](https://nattstack.github.io/experiment-inventory/)

```bash
bun install
bun run build
bun start
```

Then visit [http://localhost:5173](http://localhost:5173).

`bun run dev` rebuilds `src/game.ts` into `dist/` as you edit. `dist/` is build output and is not committed; GitHub Pages rebuilds it on every push to `main`.

## How it works

- **Trees** drop sticks (1 weight, 2 volume). Light, but they eat space.
- **Rocks** drop stones (3 weight, 1 volume). Dense and compact.
- Your pack holds **20 weight** and **16 volume**. Either limit can block a pickup.
- Click an item in the pack to drop one and free space.
- Harvested nodes become stumps or rubble, then grow back.

## Format

```bash
bun install
bun run fmt
```

`bun run fmt:check` reports files that are out of format without writing them.
`bun run check` typechecks with `tsc`.
