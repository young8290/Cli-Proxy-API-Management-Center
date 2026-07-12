# Youngspace production panel release

Release date: 2026-07-12 (Asia/Shanghai)

## Release identity

- Source commit: `2d590b9085df7b6d9e4eed05143fbbc574c1afe0`
- Release tag: `youngspace-v1.0.0`
- Release URL: <https://github.com/young8290/Cli-Proxy-API-Management-Center/releases/tag/youngspace-v1.0.0>
- Release asset: `management.html`
- SHA-256: `04d4124add356c0902be2294b04f2c44cef178527f38c6cc9951e128e11525bd`
- Checksum asset: `management.html.sha256`

No management secret or relay API key is stored in the repository or release assets.

## Production configuration

CLI Proxy API reads `/opt/homebrew/etc/cliproxyapi.conf` and serves the panel from
`/opt/homebrew/etc/static/management.html`.

The deployed settings are:

```yaml
remote-management:
  disable-control-panel: false
  # disable-auto-update-panel remains false (the default)
  panel-github-repository: "https://github.com/young8290/Cli-Proxy-API-Management-Center"

usage-statistics-enabled: true
```

Pre-switch backups:

- Configuration: `/opt/homebrew/etc/cliproxyapi.conf.pre-youngspace-panel-20260712-160557.bak`
- Previous official panel: `/opt/homebrew/etc/static/management.html.pre-youngspace-20260712-160758.bak`

The configuration backup retained mode `0600` and the previous official repository value.

## Acceptance evidence

The exact release artifact passed `VERSION=youngspace-v1.0.0 bun run verify`:

- Bun tests: 113 passed, 0 failed
- ESLint: exit 0
- TypeScript and Vite production build: exit 0

After the Homebrew service restart:

- `cliproxyapi` was running.
- Local `/management.html` returned HTTP 200.
- The downloaded local panel and the release asset had the same SHA-256.
- The authenticated public management endpoints `/v0/management/config`,
  `/auth-files`, `/api-key-usage`, and `/api-keys` each returned HTTP 200.
- The authenticated public relay endpoint `/v1/models` returned HTTP 200 and 13 models.

## Cloudflare cache status

The desired Cache Rule is:

- Name: `Bypass CPA management panel cache`
- Expression: `(http.host eq "api.youngspace.top" and http.request.uri.path eq "/management.html")`
- Action: bypass cache

Then purge this exact URL:

```text
https://api.youngspace.top/management.html
```

This rule and purge were not applied during this release. The key in
`grok-register/config.json` authenticates the mail Worker, not the Cloudflare platform API.
The available Wrangler OAuth session has Zone read access but no Cache Rules or Cache Purge
write permission; the official purge endpoint returned HTTP 401 authentication error.

Consequently, the bare public URL still returned the previous Cloudflare HIT at acceptance
time (`cache-control: max-age=14400`). A cache-busting request reached the new origin, returned
`cf-cache-status: MISS`, and contained the `youngspace-v1.0.0` version marker. The bare URL will
not be considered fully accepted until an authorized cache purge is completed and its response
contains that same marker.

## Rollback

Fast rollback to the exact pre-switch configuration and panel:

```bash
cp -p /opt/homebrew/etc/cliproxyapi.conf.pre-youngspace-panel-20260712-160557.bak \
  /opt/homebrew/etc/cliproxyapi.conf
cp -p /opt/homebrew/etc/static/management.html.pre-youngspace-20260712-160758.bak \
  /opt/homebrew/etc/static/management.html
brew services restart cliproxyapi
curl --noproxy '*' -fsS http://127.0.0.1:8317/management.html \
  -o /tmp/rollback-management.html
shasum -a 256 /tmp/rollback-management.html
```

The expected pre-switch panel hash is
`86cb8043df1abd7c6144fe2e104ded73a186ae6d27ce5ca8c6e51ce7b9ef007b`.

To return from rollback to this custom release, restore the custom repository setting,
move the cached panel aside, restart the service, request the local panel, and verify the
release hash again. Do not delete either pre-switch backup until the public cache rule and
bare-URL acceptance are complete.
