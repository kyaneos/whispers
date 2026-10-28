# whispers

whispers is a web app for running transmission chain studies online. Each participant reads a short text, writes out as much of it as they can remember, and their recall becomes the text the next person in their chain reads. In this way, a text changes as it passes from one person to the next, much like the children’s game of telephone (or “Chinese whispers,” as it is known in the UK).

I built it for my replication of Mesoudi, Whiten & Dunbar (2006), Experiment 2 ([kyaneos/mesoudi2006](https://github.com/kyaneos/mesoudi2006)).

## What a participant does

A participant consents, answers a screening question about English fluency, and passes a short check on the rules (read the text once, no going back). They then read their text, which stays on screen for a minimum reading time, write out what they remember, and answer a few final questions about outside help, age and gender before the debrief. The first participant in a chain reads the four original paragraphs, in one of four orders from a balanced Latin square. Everyone after them reads the recall of the person before them.

Because the study runs online and unsupervised, the app also does the work an experimenter in the room would have done. The text can’t be selected or copied, pasting into the recall box is blocked, and every recall comes with a log of how it was typed and whether the participant left the page. Both screens also carry instructions that only an AI would see, which ask it to use a particular uncommon word, so that AI-written recalls can be flagged.

## How chains move

The browser never talks to the database directly. Four server routes do that work instead:

1. `start` makes the participant’s row, or finds it again after a reload
2. `claim` gives them the next open slot, meaning the lowest-numbered chain waiting on a generation. The database itself refuses to put two people in the same slot, so two participants arriving at once can never collide
3. `save` stores each screen’s data as the participant goes
4. `submit` checks the recall and decides what happens next

A recall that passes has its spacing cleaned up and becomes the chain’s next text. A recall that clearly fails (nearly empty, or containing the AI word) is excluded, and the same generation opens again for a new participant. Either way, the participant never finds out which happened. Everything subtler, like the typing log and the honesty item, is recorded and left for the analysis.

## Files

```
whispers/
├── src/
│   ├── routes/
│   │   ├── +page.svelte          # starts the session and runs the study
│   │   ├── +layout.svelte        # page shell, blocks phones and tablets
│   │   └── api/                  # the four server routes: start, claim, save, submit
│   └── lib/
│       ├── timeline.js           # every screen, in order (jsPsych)
│       ├── materials.js          # the four paragraphs, the Latin square, the reading time
│       ├── api.js                # how the browser calls the server routes
│       ├── components/
│       │   ├── ReadScreen.svelte     # the text, locked until the reading time is up
│       │   ├── RecallScreen.svelte   # the recall box and its typing log
│       │   ├── HiddenNote.svelte     # the instructions only an AI sees
│       │   └── JSPsych.svelte        # runs the timeline and saves each screen
│       └── server/
│           ├── pb.js             # the server’s login to PocketBase
│           └── gate.js           # the submit checks and the spacing cleanup
├── pocketbase/
│   ├── collections.json          # the database schema
│   ├── CONVENTIONS.md            # how and why the schema is set up this way
│   ├── import_schema.js          # adds the schema to a PocketBase instance
│   └── seed_chains.js            # creates the chains
├── tests/
│   └── flow.js                   # end-to-end check of the chain logic
├── static/favicon.ico
└── wrangler.jsonc                # Cloudflare settings
```

## Setup

The app is built with SvelteKit and jsPsych, stores its data in PocketBase, and runs on Cloudflare Workers.

1. Copy `.env.example` to `.env`, add a PocketBase superuser login, and run `npm run import-schema`. This only adds the `whispers_` collections and never deletes anything, so it is safe on a shared instance. Then remove the superuser lines
2. In the PocketBase admin, create one record in `whispers_app`. This is the only login the server uses, and it can only reach the `whispers_` collections. Put it in `.env` as `PB_APP_EMAIL` and `PB_APP_PASSWORD`
3. Create chains with `npm run seed -- --real 1 --test 2`
4. Run `npx wrangler secret put PB_APP_PASSWORD` once, then `npm run build` and `npx wrangler deploy`

## Testing

Adding `?test=1` to the link sends you to the test chains, so my own runs never use up a real one. `npm run test:flow` walks a chain through the API from start to finish, covering the handoff, both kinds of exclusion, two people claiming at once and a reload partway through. Setting `BASE` points it at the live site.
