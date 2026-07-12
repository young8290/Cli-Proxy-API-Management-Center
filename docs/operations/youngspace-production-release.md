# Youngspace production panel release

Release date: 2026-07-12 (Asia/Shanghai)

## Release identity

- Source commit: `dea949754dcffc0c3686a18b5f7c472a811d8696`
- Release tag: `youngspace-v1.0.1`
- Release URL: <https://github.com/young8290/Cli-Proxy-API-Management-Center/releases/tag/youngspace-v1.0.1>
- Release asset: `management.html`
- SHA-256: `2ce8a7d01dec23ed83d518732b2fc048bc4604de5f857463057fa5ed15f81980`
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
- Previous Youngspace v1.0.0 panel: `/opt/homebrew/etc/static/management.html.pre-youngspace-v1.0.1-20260712-190509.bak`

The configuration backup retained mode `0600` and the previous official repository value.

## Acceptance evidence

The exact release artifact passed `VERSION=youngspace-v1.0.1 bun run verify`:

- Bun tests: 124 passed, 0 failed
- ESLint: exit 0
- TypeScript and Vite production build: exit 0

After the Homebrew service restart:

- `cliproxyapi` was running.
- Local `/management.html` returned HTTP 200.
- The downloaded local panel and the release asset had the same SHA-256.
- The `youngspace-v1.0.1` build marker was present in both the local and public panel responses.
- The authenticated local and public management endpoints `/v0/management/config`,
  `/auth-files`, `/api-key-usage`, and `/api-keys` each returned HTTP 200.
- The authenticated local and public relay endpoint `/v1/models` returned HTTP 200 and 13 models.

## Cloudflare cache status

The following active Cache Rule was deployed through the authenticated Cloudflare dashboard:

- Name: `Bypass CPA management panel cache`
- Expression: `(http.host eq "api.youngspace.top" and http.request.uri.path eq "/management.html")`
- Action: bypass cache

The following exact URL was purged after the rule was deployed:

```text
https://api.youngspace.top/management.html
```

Dashboard verification showed the rule active after the existing catch-all cache rule, so its
`Bypass cache` action applies specifically to `api.youngspace.top/management.html`. The custom
purge dialog completed and closed successfully. No Cloudflare rule or zone-wide cache setting was
changed for the v1.0.1 revision. A subsequent bare-URL GET returned HTTP 200,
`cf-cache-status: DYNAMIC`, and the `youngspace-v1.0.1` marker. The public dashboard and API
access page remain available through the bare URL.

The key in `grok-register/config.json` authenticates the mail Worker, not the Cloudflare platform
API. The Wrangler OAuth session also lacks Cache Rules and Cache Purge write permissions; the
dashboard session was therefore used for these two authorized changes.

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
release hash again. Retain all pre-switch backups until this release has completed its normal
observation period.
