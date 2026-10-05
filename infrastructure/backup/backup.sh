#!/usr/bin/env bash
# Nightly dump of the staging database, run by beyondpilot-backup.timer (docs/runbooks/ci-cd.md). It keeps the 14
# newest dumps on the host; copying them off the host waits for a backup target.
set -euo pipefail
umask 077

readonly backups=/apps/beyondpilot/backups
install -d -m 0700 "$backups"

# Never alongside a deployment, which takes its own dump and may be migrating.
exec 9>/apps/beyondpilot/deployments/lock
flock --wait 600 9

dump="$backups/nightly-$(date --utc +%Y%m%dT%H%M%SZ).dump"
docker exec beyondpilot-postgres pg_dump --username=beyondpilot --dbname=beyondpilot --format=custom >"$dump.partial"
docker exec --interactive beyondpilot-postgres pg_restore --list <"$dump.partial" >/dev/null
mv "$dump.partial" "$dump"

find "$backups" -maxdepth 1 -name 'nightly-*.dump' -printf '%T@ %p\n' | sort --numeric-sort --reverse |
    tail --lines=+15 | cut --delimiter=' ' --fields=2- | xargs --no-run-if-empty rm -f --
echo "backup: database saved to $dump"
