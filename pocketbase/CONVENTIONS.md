# PocketBase conventions

How we set up PocketBase for a study, so every study and instance looks the same. Written for whispers (this replication), based on what Telephone already does. I'm keeping it here until Eshin has seen it, then it moves to the lab template.

## Naming

1. Every study has a codename, which is the prefix for everything: collections, the Cloudflare project and URL, the package name. Pick a name that says what the study is, not who ran the original (whispers, telephone).
2. Collections are `<codename>_<role>`. Use the lab's roles where they fit (`_participants`, `_stimuli`, `_responses`) and add study-specific ones only when none fit (`whispers_chains`).
3. Collection IDs are `pbc_<collection name>` (`pbc_whispers_chains`), set in the schema file so links between collections survive an import. PocketBase won't allow an ID that equals a name, hence the prefix, which is also PocketBase's own.
4. Field names are snake_case (`recall_raw`, `english_fluency`). Telephone mixes camelCase from the template with snake_case added later; new studies use snake_case only.

## Access

5. Nothing is public. Every rule is either locked (superusers only) or limited to the study's own login.
6. When a study has a server, the server logs in as one account in `<codename>_app`: email `<codename>-app@sciminds.cloud`, password login only, auth alerts off. Its rules reach only that study's collections, so a leaked password can't touch the rest of the lab's data. Never put a superuser password in Cloudflare.
7. Passwords live in your password manager and in Cloudflare secrets (`npx wrangler secret put`). Never in the repo, never in chat. The URL and the app's email aren't secret, so they go in `wrangler.jsonc` under `vars`.

## Built-in fields

8. PocketBase's own fields stay at their defaults: `id`, `created`, `updated` on every collection, plus `email`, `password`, `tokenKey`, `verified`, `emailVisibility` on login collections. Telephone never changed them either.
9. The email templates, OTP, MFA and OAuth settings on a login collection also stay at their defaults. PocketBase fills them in and they only run when someone asks for them, so there is nothing to configure.

## Schema

10. The schema lives in the repo as `pocketbase/collections.json`, holding only the settings we chose.
11. Import it in the admin under Settings → Import collections, with **"Merge with the existing collections" on**. With merge off, PocketBase deletes every collection not in the file, which on a shared instance means other studies' data. The review screen should list only the new collections.
12. Test every schema change against a local PocketBase on the same version as the shared instance before it touches the shared one. sciminds.cloud runs 0.28.2 (the version shows in the admin footer); `brew install pocketbase` gives the latest, which accepts things 0.28 rejects, so download the matching release from github.com/pocketbase/pocketbase/releases instead.
