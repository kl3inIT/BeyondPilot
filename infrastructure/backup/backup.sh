#!/usr/bin/env bash
# Nightly backup of one environment, run by beyondpilot-backup.service (docs/runbooks/ci-cd.md):
#
#   beyondpilot-backup <environment>     (production or staging)
#
# It dumps the database and archives the uploaded files of the volume `<project>_storage`, and keeps the 14 newest of
# each on the host; copying them off the host waits for a backup target.
set -euo pipefail
umask 077

fail() {
    echo "backup: $*" >&2
    exit 1
}

[[ $# -eq 1 ]] || fail "usage: beyondpilot-backup <environment>"
case "$1" in
    production) project=beyondpilot ;;
    staging) project=beyondpilot-staging ;;
    *) fail "environment must be production or staging" ;;
esac
readonly project
readonly root="/apps/$project"
readonly backups="$root/backups"
install -d -m 0700 "$backups"

# Never alongside a deployment, which takes its own dump and may be migrating.
install -d -m 0700 "$root/deployments"
exec 9>"$root/deployments/lock"
flock --wait 600 9

stamp=$(date --utc +%Y%m%dT%H%M%SZ)
dump="$backups/nightly-$stamp.dump"
docker exec "$project-postgres" pg_dump --username=beyondpilot --dbname=beyondpilot --format=custom >"$dump.partial"
docker exec --interactive "$project-postgres" pg_restore --list <"$dump.partial" >/dev/null
mv "$dump.partial" "$dump"

# The files are read through the image the database already runs, so the backup pulls nothing.
files="$backups/nightly-$stamp-files.tar.gz"
image=$(docker inspect --format '{{.Config.Image}}' "$project-postgres")
docker run --rm --network none --volume "${project}_storage:/storage:ro" "$image" \
    tar --create --gzip --directory /storage . >"$files.partial"
gzip --test "$files.partial"
mv "$files.partial" "$files"

for pattern in 'nightly-*Z.dump' 'nightly-*-files.tar.gz'; do
    find "$backups" -maxdepth 1 -name "$pattern" -printf '%T@ %p\n' | sort --numeric-sort --reverse |
        tail --lines=+15 | cut --delimiter=' ' --fields=2- | xargs --no-run-if-empty rm -f --
done
echo "backup: $project saved to $dump and $files"
