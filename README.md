# whispers

whispers is a web app for running transmission chain studies online. Each participant reads a short text, writes out as much of it as they can remember, and their recall becomes the text the next person in their chain reads. In this way, a text changes as it passes from one person to the next, much like the children’s game of telephone (or “Chinese whispers,” as it is known in the UK).

It runs at [whispers.sciminds.app](https://whispers.sciminds.app) and was built for a replication of Mesoudi, Whiten & Dunbar (2006), Experiment 2 ([kyaneos/mesoudi2006](https://github.com/kyaneos/mesoudi2006)).

## What a participant does

A participant consents, answers a screening question about English fluency, and passes a short check on the rules (read the text once, no going back). They then read their text, which stays on screen for a minimum reading time, write out what they remember, and answer a few final questions about outside help, age and gender before the debrief. Generation 1, the first participant in a chain, reads the original text: the four paragraphs, in one of four orders from a balanced Latin square. Generations 2 to 4 each read the recall of the generation before them.

Because the study runs online and unsupervised, the app also does the work an experimenter in the room would have done. The text can’t be selected or copied, pasting into the recall box is blocked, and every recall comes with a log of how it was typed and whether the participant left the page. Both screens also carry instructions that only an AI would see, which ask it to use a particular uncommon word, so that AI-written recalls can be flagged.

## How chains move

The browser never talks to the database directly. Five server routes do that work:

1. `start` makes the participant’s row, or finds it again after a reload
2. `claim` gives them a slot. Finishing chains comes first: the open slot at the highest generation, ties to the lowest chain number, so a held or busy chain is simply skipped. With nothing open, a new chain opens, up to 32 real chains and never after Nov 20. Because the database itself refuses to put two people in the same slot or open the same chain number twice, two participants arriving at once can never collide
3. `save` stores each screen’s data as the participant goes
4. `submit` checks the recall for clear fails
5. `finish` decides the recall once the final questions are in

Every check runs before the next generation reads the recall, so a recall that fails is replaced instead of passed on. A clear fail at submit (nearly empty, containing the AI word, or not typed according to the typing log) is excluded, and the same generation opens again for a new participant. So is a recall whose writer reports outside help in the final questions. A recall that shares too few words with the text it read, or whose writer failed the instructed-response item, holds the chain until someone reads it and decides with `npm run release`, and a Slack message announces it. Anything else has its spacing cleaned up and becomes the chain’s next text. The participant never finds out which happened.

Someone who leaves while holding a slot (a reload, a closed tab, or 10 minutes away from the tab) loses it, and the generation runs again. Their row keeps everything they filled in, and if they come back they see a reference code to email about credit. A slot nobody comes back to is freed after an hour.

## Files

```
whispers/
├── src/
│   ├── env.js                    # the settings the server needs, by name
│   ├── hooks.server.js           # security headers on every response
│   ├── routes/
│   │   ├── +page.svelte          # starts the session and runs the study
│   │   ├── +layout.svelte        # page shell, blocks phones and tablets
│   │   └── api/                  # the five server routes: start, claim, save, submit, finish
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
│           ├── gate.js           # the recall checks and the spacing cleanup
│           └── chain.js          # reopening, advancing and abandoning a slot
├── pocketbase/
│   ├── collections.json          # the database schema
│   ├── CONVENTIONS.md            # how and why the schema is set up this way
│   ├── import_schema.js          # adds the schema to a PocketBase instance
│   ├── seed_chains.js            # creates the chains
│   ├── reset_test.js             # resets the test chains and deletes test rows
│   ├── release.js                # decides a held recall
│   └── export_responses.js       # saves every row to exports/ for the analysis
├── tests/
│   └── flow.js                   # end-to-end check of the chain logic
├── static/                       # favicon and robots.txt
└── wrangler.jsonc                # Cloudflare settings
```

## Changing it for a new study

Every setting sits at the top of the file that uses it. These are the ones a new study is likely to change:

| Setting | Where |
|---|---|
| The texts and their reading orders | `PARAGRAPHS` and `ORDERS` in `src/lib/materials.js` |
| The reading speed behind the minimum reading time (400 words per minute) | `readingFloorMs` in `src/lib/materials.js` |
| Generations per chain | `GENERATIONS` in `src/lib/server/chain.js` |
| The cap on chains, and the last day new chains open | `MAX_CHAINS` and `NEW_CHAINS_UNTIL` in `src/routes/api/claim/+server.js` |
| How long before an abandoned slot is freed | `STALE_MS` in `src/routes/api/claim/+server.js` |
| Time away from the tab before a session ends | `TIMEOUT_MS` in `src/lib/components/JSPsych.svelte` |
| The recall checks: near-empty, not typed, off-topic | `MIN_WORDS`, `MIN_TYPED_SHARE` and `MIN_OVERLAP` in `src/lib/server/gate.js` |
| What counts as one large insertion | `LARGE_INSERTION` in `src/lib/components/RecallScreen.svelte` |
| The AI canary word (the hidden note has to ask for the same word) | `CANARY` in `src/lib/server/gate.js` and `src/lib/components/HiddenNote.svelte` |
| Consent, debrief, screening and the final questions | `src/lib/timeline.js` |
| The contact email and the SONA completion URL | `src/lib/config.js` |
| How many chains exist at the start | `npm run seed` (see Commands) |

## Setup

The app is built with SvelteKit and jsPsych, stores its data in PocketBase, and runs on Cloudflare Workers.

1. Copy `.env.example` to `.env`, add a PocketBase superuser login, and run `npm run import-schema`. This only adds the `whispers_` collections and never deletes anything, so it is safe on a shared instance. Then remove the superuser lines
2. In the PocketBase admin, create one record in `whispers_app`. This is the only login the server uses, and it can only reach the `whispers_` collections. Put it in `.env` as `PB_APP_EMAIL` and `PB_APP_PASSWORD`
3. Make a study key with `openssl rand -hex 16` and put it in `.env` as `STUDY_KEY`. The link participants get is `https://whispers.sciminds.app/?k=<that key>`, and the server refuses to start a session without it
4. Create chains with `npm run seed -- --real 1 --test 2`
5. Run `npm run build` and `npx wrangler deploy`, then add the two secrets with `npx wrangler secret put PB_APP_PASSWORD` and `npx wrangler secret put STUDY_KEY`, and check them with `npx wrangler secret list`. Because secrets belong to one Cloudflare account, the Worker has to exist on the right account first

## Safety

The browser never holds a database login, and the one account the server uses can only reach the `whispers_` collections. Nobody can start a session without the key in the link, and after that each participant’s row is tied to a random token that only their browser has. Every request is checked for size and shape before it touches the database. The site sends a Content Security Policy, so the browser only runs scripts from this site, and it refuses to be shown inside another site. Search engines are told to stay out.

## Testing

Adding `?test=1` to the link (after the key) routes a session to the test chains, so a trial run never uses up a real one. `npm run reset-test` puts the test chains back to the start. `npm run test:flow` walks a chain through the API from start to finish, covering the handoff, each kind of exclusion, a held chain, two people claiming at once and a reload partway through. Setting `BASE` points it at the live site.

## Commands

Everything runs from this folder. The scripts read `.env`, which holds the PocketBase login and the study key.

Links. The key is the `STUDY_KEY` line of `.env`.

    https://whispers.sciminds.app/?k=<key>                                  a participant
    https://whispers.sciminds.app/?k=<key>&survey_code=%SURVEY_CODE%        the study link to give SONA
    https://whispers.sciminds.app/?k=<key>&test=1                           a trial run, on the test chains

SONA fills in `%SURVEY_CODE%` for each participant. The debrief, screened-out and no-slot screens then show a "Finish and get credit" button that sends it back to SONA. The code is never saved. The button also shows if they come back after finishing. The SONA completion URL goes in `src/lib/config.js`.

Trial runs:

    npm run reset-test        put test chains 1 and 2 back to generation 1, delete later test chains and the test rows
    npm run test:flow         check the chain logic against a local dev server
    BASE=https://whispers.sciminds.app npm run test:flow      the same, against the live site

Working on the app:

    npm run dev               local server at localhost:5173, using the database in .env
    npm run lint
    npm run build
    npx wrangler deploy       put the current build live (build first)

Chains and database:

    npm run seed -- --real 12 --test 2       create chains; existing ones are skipped, so a bigger number only adds
    npm run import-schema                    apply pocketbase/collections.json, with the dashboard's superuser login (not whispers_app) typed in:
    IFS= read -r "E?superuser email: "; IFS= read -rs "P?password: "; echo; PB_SUPERUSER_EMAIL=$E PB_SUPERUSER_PASSWORD=$P npm run import-schema
    npm run release <row id>                 show a held recall and the text it read
    npm run release <row id> pass            pass it on (or: exclude, so the generation runs again)
    npm run export                           save every row to exports/whispers_responses.json (gitignored)

Secrets on Cloudflare. They belong to the Worker, so they are set once per account and survive deploys.

    npx wrangler secret list
    npx wrangler secret put PB_APP_PASSWORD        paste the whispers_app password at the prompt
    grep '^STUDY_KEY=' .env | cut -d= -f2- | npx wrangler secret put STUDY_KEY      send the key straight from .env
    npx wrangler secret put SLACK_WEBHOOK_URL      paste the Slack webhook that announces held chains

To change the key, make a new one with `openssl rand -hex 16`, replace the line in `.env`, and run the last command again. Old links stop working at once.

## Acknowledgments

The SONA credit setup follows the Cognitive Tools Lab’s guide to automating SONA credit (Judy Fan’s lab): https://github.com/cogtoolslab/handy_tips/blob/main/automate_sona_creditassignment.md.
