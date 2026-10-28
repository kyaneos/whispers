# whispers

whispers is a web app for running transmission chain studies online. Each participant reads a short text, writes out as much of it as they can remember, and their recall becomes the text the next person in their chain reads. In this way, a text changes as it passes from one person to the next, much like the children’s game of telephone (or “Chinese whispers,” as it is known in the UK).

It runs at [whispers.sciminds.app](https://whispers.sciminds.app). I built it for my replication of Mesoudi, Whiten & Dunbar (2006), Experiment 2 ([kyaneos/mesoudi2006](https://github.com/kyaneos/mesoudi2006)).

## What a participant does

A participant consents, answers a screening question about English fluency, and passes a short check on the rules (read the text once, no going back). They then read their text, which stays on screen for a minimum reading time, write out what they remember, and answer a few final questions about outside help, age and gender before the debrief. The first participant in a chain reads the four original paragraphs, in one of four orders from a balanced Latin square. Everyone after them reads the recall of the person before them.

Because the study runs online and unsupervised, the app also does the work an experimenter in the room would have done. The text can’t be selected or copied, pasting into the recall box is blocked, and every recall comes with a log of how it was typed and whether the participant left the page. Both screens also carry instructions that only an AI would see, which ask it to use a particular uncommon word, so that AI-written recalls can be flagged.

## How chains move

The browser never talks to the database directly. Four server routes do that work:

1. `start` makes the participant’s row, or finds it again after a reload
2. `claim` gives them the next open slot, the lowest-numbered chain waiting on a generation. Because the database itself refuses to put two people in the same slot, two participants arriving at once can never collide
3. `save` stores each screen’s data as the participant goes
4. `submit` checks the recall and decides what happens next

A recall that passes has its spacing cleaned up and becomes the chain’s next text. A recall that clearly fails (nearly empty, or containing the AI word) is excluded, and the same generation opens again for a new participant. Either way, the participant never finds out which happened. Everything subtler, like the typing log and the honesty item, is recorded and left for the analysis.

## Files

```
whispers/
├── src/
│   ├── env.js                    # the settings the server needs, by name
│   ├── hooks.server.js           # security headers on every response
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
│           ├── pb.js             # the server’s login to PocketBase, and the study key check
│           ├── input.js          # size and shape checks on everything the browser sends
│           └── gate.js           # the submit checks and the spacing cleanup
├── pocketbase/
│   ├── collections.json          # the database schema
│   ├── CONVENTIONS.md            # how and why the schema is set up this way
│   ├── import_schema.js          # adds the schema to a PocketBase instance
│   ├── seed_chains.js            # creates the chains
│   └── reset_test.js             # resets the test chains and deletes test rows
├── tests/
│   └── flow.js                   # end-to-end check of the chain logic
├── static/                       # favicon and robots.txt
└── wrangler.jsonc                # Cloudflare settings
```

## Setup

The app is built with SvelteKit and jsPsych, stores its data in PocketBase, and runs on Cloudflare Workers.

1. Copy `.env.example` to `.env`, add a PocketBase superuser login, and run `npm run import-schema`. This only adds the `whispers_` collections and never deletes anything, so it is safe on a shared instance. Then remove the superuser lines
2. In the PocketBase admin, create one record in `whispers_app`. This is the only login the server uses, and it can only reach the `whispers_` collections. Put it in `.env` as `PB_APP_EMAIL` and `PB_APP_PASSWORD`
3. Make a study key with `openssl rand -hex 16` and put it in `.env` as `STUDY_KEY`. The link participants get is `https://whispers.sciminds.app/?k=<that key>`, and the server refuses to start a session without it
4. Create chains with `npm run seed -- --real 1 --test 2`
5. Run `npm run build` and `npx wrangler deploy`, then add the two secrets with `npx wrangler secret put PB_APP_PASSWORD` and `npx wrangler secret put STUDY_KEY`, and check them with `npx wrangler secret list`. Because secrets belong to one Cloudflare account, the Worker has to exist on the right account first

## What keeps it safe

The browser never holds a database login, and the one account the server uses can only reach the `whispers_` collections. Nobody can start a session without the key in the link, and after that each participant’s row is tied to a random token that only their browser has. Every request is checked for size and shape before it touches the database. The site sends a Content Security Policy, so the browser only runs scripts from this site, and it refuses to be shown inside another site. Search engines are told to stay out.

## Testing

Adding `?test=1` to the link (after the key) sends you to the test chains, so my own runs never use up a real one. `npm run reset-test` puts the test chains back to the start. `npm run test:flow` walks a chain through the API from start to finish, covering the handoff, both kinds of exclusion, two people claiming at once and a reload partway through. Setting `BASE` points it at the live site.

## Commands

Everything runs from this folder. The scripts read `.env`, which holds the PocketBase login and the study key.

Links. The key is the `STUDY_KEY` line of `.env`.

    https://whispers.sciminds.app/?k=<key>            a participant
    https://whispers.sciminds.app/?k=<key>&test=1     me, on the test chains

Running through it myself:

    npm run reset-test        put the test chains back to generation 1 and delete the test rows
    npm run test:flow         check the chain logic against a local dev server
    BASE=https://whispers.sciminds.app npm run test:flow      the same, against the live site

Working on the app:

    npm run dev               local server at localhost:5173, using the database in .env
    npm run lint
    npm run build
    npx wrangler deploy       put the current build live (build first)

Chains and the database:

    npm run seed -- --real 12 --test 2       create chains; existing ones are skipped, so a bigger number only adds
    npm run import-schema                    apply pocketbase/collections.json (needs the superuser lines in .env, then remove them)

Secrets on Cloudflare. They belong to the Worker, so they are set once per account and survive deploys.

    npx wrangler secret list
    npx wrangler secret put PB_APP_PASSWORD        paste the whispers_app password at the prompt
    grep '^STUDY_KEY=' .env | cut -d= -f2- | npx wrangler secret put STUDY_KEY      send the key straight from .env

To change the key, make a new one with `openssl rand -hex 16`, replace the line in `.env`, and run the last command again. Old links stop working at once.
