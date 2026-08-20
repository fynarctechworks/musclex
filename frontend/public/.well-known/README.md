# Deep-link association files

These make `https://app.musclex.infynarc.com/r/<token>` open the member app
directly instead of the browser. Shared workout routine links use that path.

**Both files carry a placeholder that only a native build can fill in.** Until
they are replaced the https links fall back to the browser — the app's own
`musclex://r/<token>` scheme works regardless, and the paste-a-code box in
My Routines works with no setup at all.

| File | Placeholder | Where to get it |
|---|---|---|
| `apple-app-site-association` | `REPLACE_TEAM_ID` | Apple Developer → Membership → Team ID |
| `assetlinks.json` | `REPLACE_SHA256_FINGERPRINT` | `eas credentials` → Android → keystore SHA-256 |

Serving requirements, both of which are easy to get wrong:

- `apple-app-site-association` has **no file extension** and must be served as
  `application/json`. iOS fetches it over HTTPS with no redirects.
- Both must be reachable at exactly `/.well-known/<file>` on the apex the links
  use, uncached by any auth middleware.

Verify after deploying:

    curl -sI https://app.musclex.infynarc.com/.well-known/apple-app-site-association
    curl -s  https://app.musclex.infynarc.com/.well-known/assetlinks.json
