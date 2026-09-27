# Color Hunt

A multiplayer 3D top-down color-hunt game. Up to 5 players roam a low-poly neighborhood. One player is the
**Hunter** and announces a color. One object somewhere in the map secretly turns that color. Players search for it
and click it to become **Safe**. The Hunter chases anyone still searching. When the Hunter touches an unsafe player,
the round ends and the caught player becomes the next Hunter.

Built with React 19, React Three Fiber, Zustand, Tailwind 4 and Supabase (auth, Postgres, Realtime).

## Run it

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL and publishable key
npm run dev
```

Then open http://localhost:5173 in two or more browser windows (use different accounts, or a normal window plus
a private window), create a session in one, join with the code in the others, and press Start.

Other scripts:

```bash
npm run typecheck   # tsc
npm test            # vitest (map generator, physics, HUD rules)
npm run build       # production bundle
npm run seed:map    # regenerate supabase/migrations/0004_seed_map_objects.sql from the map generator
```

### Loading and performance
- The 3D engine (three.js) is code-split into its own chunk. The login screen paints with the small app
  bundle first; the neighborhood backdrop and the game load on demand and are prefetched from the home screen.
- Menus render a live, slowly orbiting neighborhood. Open the app with `?lite` to use a static gradient
  instead on weak machines (remembered for the tab).
- Sound effects are synthesized in the browser (no audio files); a mute button sits next to Leave in game.
  Vibration feedback is used where the device supports it.

## Supabase setup

The migrations in `supabase/migrations/` have already been applied to the `color-hunt-game` project
(`rzevbhbgfqqjaevlwuqo`). To set up a fresh project, apply them in order:

1. `0001_schema.sql`: tables, enums, RLS, profile trigger.
2. `0002_realtime.sql`: realtime authorization policies and the change-broadcast triggers.
3. `0003_rpcs.sql`: every game action as a `security definer` function.
4. `0004_seed_map_objects.sql`: the catalog of colorable objects (generated, do not edit by hand).
5. `0005_revoke_anon.sql`: RPCs callable by signed in users only.
6. `0006_pick_hidden_object_arrays.sql`: object picker without temp tables (the API connection forbids
   `DELETE` without `WHERE`).
7. `0007_skip_heartbeat_broadcast.sql`: heartbeats do not trigger client refreshes.

One manual step: in the Supabase dashboard, under **Authentication → Providers → Email**, turn off
**Confirm email** if you want players to be able to sign up and play immediately. With confirmation on, the app
tells new players to check their inbox before signing in.

## How it works

### Authority
Postgres owns the game state. Clients never write the game tables; they call RPCs such as `start_game`,
`announce_color`, `claim_safe` and `catch_player`, and every RPC validates the caller and the current phase.

### Realtime
Each session has one private channel, `game:<session id>`.

- Player positions are broadcast by each client at about 15 Hz and interpolated on the other clients.
- Presence tracks who is connected.
- Row changes on `game_sessions`, `session_players` and `rounds` are pushed to the same channel by a database
  trigger (`realtime.broadcast_changes`). Clients react by refetching one snapshot RPC.
- Realtime RLS policies only let session members subscribe or publish on their session's topic.

### Hidden object placement
`announce_color` receives the current player positions and picks an object from `map_objects` that is at least
18 units from every player, was not used in the last 3 rounds, and whose kind was not used in the last 2 rounds.
Constraints relax step by step if the pool runs dry. The pick is weighted so common kinds (doors, mailboxes) come
up less often. The object catalog is generated from the same deterministic map generator the client renders, so the
database and the world always agree.

### Information rules
- Every client must know the hidden object id in order to render it colored. The UI never reveals it, but a
  player reading network traffic could find it. This is an accepted limitation for a casual game.
- Normal players see their own marker and the Hunter's marker on the minimap and full map, plus the nearest
  player's name, distance and compass direction.
- The Hunter additionally gets screen-edge arrows and minimap dots for unsafe players within 32 units.
  Nothing ever points at the hidden object.

### Rules confirmed for this build
- Everyone who reaches and clicks the object becomes Safe, not only the first.
- If the Hunter fails (everyone Safe, or the 3 minute timer expires), the same Hunter stays for the next round.
- Tank controls: Up and Down walk along the facing direction, Left and Right rotate. WASD also works.
- Hold Alt with an arrow key to sprint (1.65x). Space hops in the held direction (forward by default) with a
  distance boost. Hops clear low props such as cars, mailboxes, hydrants, benches and hedges; you can land on
  them and walk off again. Houses, trees, lamp posts and signs still block. Jumps are visible to other players.
- E, Enter or a click inspects an object. Any wrong object gives a loud "Not this one" alert. The right object
  from too far away asks you to come closer.
- Everyone sees the Hunter's position on the minimap and full map at all times. M toggles the full map.
- The timer turns red and pulses at 30 seconds, a countdown banner appears, and the last 10 seconds tick audibly.
- With 20 seconds left, every player sees a hint card: a spinning preview of the hidden object's shape in the
  announced color. Its location stays secret.
- The Hunter picks the color by clicking, or with the arrow keys and Enter.
- Players who stop sending heartbeats for 25 seconds are removed. If the Hunter drops, a random player takes over.
  With fewer than two players the session ends.

## Project layout

```
src/
  features/auth      email + password sign in, sign up
  features/lobby     home (create / join), lobby, session page
  game/map           deterministic neighborhood generator and constants
  game/physics       tank movement and AABB sliding collision
  game/scene         React Three Fiber world, characters, props, camera, HUD projection
  game/net           realtime channel hook and the position store
  game/state         zustand store, domain types, pure visibility rules
  game/ui            HUD, minimap, full map, modals, toasts
  lib                Supabase client, typed RPC wrappers, generated DB types
supabase/migrations  schema, realtime policies, RPCs, generated object seed
scripts              map seed generator
docs/PLAN.md         the development plan this build follows
```
