# GitHub Whizzy Demo

A prototype GUI for editing GitHub-hosted Data

## Limitations
* Only searches for and edits `.csv` files right now
* Terrible error messages
* Full flow drops you at a JSON API response right now, which isn't very helpful

## Remix Me!
You'll need your own GitHub third-party application keys, which you'll put in `.env`:
```
GITHUB_CLIENT_ID=<Get this from GitHub>
GITHUB_CLIENT_SECRET=Get this also from GitHub>
SESSION_SECRET="a nice random-y string"
```