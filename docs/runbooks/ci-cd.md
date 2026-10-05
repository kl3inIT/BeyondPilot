# CI and staging delivery

[CI](../../.github/workflows/ci.yml) verifies every branch push and, on a main push, publishes a release. [Deploy staging](../../.github/workflows/deploy-staging.yml) promotes a published release to the staging host, where [`deploy.sh`](../../infrastructure/deployment/deploy.sh) rolls it out with Docker Compose. A green deployment means the release is running and healthy; it does not claim that the product works, which the team checks on the site.

## Releases

On a main push the `Images` job builds both images, starts the local composition from them and checks its routes, then pushes those exact images to GHCR as `ghcr.io/kl3init/beyondpilot-{api,web}:sha-<sha>-<run>-<attempt>`. A tag names one CI attempt and is never moved; there is no `latest`.

`Publish release` runs only after every other job of the run has passed. It uploads the artifact `release-<sha>`, kept 30 days, holding `images.env`: the source SHA and both images by digest. Deploy staging accepts nothing else. An image a failed run pushed is named by no `images.env`, so it is never deployed.

## Deployment

Deploy staging runs after a successful main CI run when the repository variable `STAGING_AUTO_DEPLOY` is `true`, and by hand at any time:

```text
gh workflow run deploy-staging.yml --ref main -f ci_run_id=<successful main CI run>
gh run watch <deployment run> --exit-status
```

The workflow:

1. Checks that the CI run is a successful push to main of this repository, and that its `Publish release` job passed. An automatic run whose commit is no longer the head of main stops there, because the newer commit deploys after its own CI.
2. Checks out that commit, downloads its `images.env` and copies it, `deploy.sh` and the two compositions to `/apps/beyondpilot/incoming/<release>/` over SSH, with a pinned host key and a key that exists only for the job.
3. Runs `deploy.sh` under the deployment user's one sudo rule and passes the job's package-read token on standard input.

`deploy.sh` takes a lock and refuses a malformed release, an environment file that is not root's with mode `0600`, or a missing secret file. It pulls both images and checks that their `revision` label is the release's SHA. When a database is running, it stops the api and saves a `pg_dump` that `pg_restore --list` can read to `/apps/beyondpilot/backups/pre-deploy-<release>.dump`. It then starts the composition with `up --wait`: PostgreSQL, then the api, where Flyway migrates, then the web application once the api is healthy. It checks the running revisions and records the release in `deployments/current.env` and the one before in `previous.env`. Staging is down while the api restarts; there is no zero-downtime rollout.

## The staging host

Staging shares `hn-fci-k8s-aioffice-application` (`167.254.65.226`, Ubuntu 24.04) with the production of MemoryOS. BeyondPilot has its own Compose project `beyondpilot`, its own PostgreSQL container and volumes, its own network `beyondpilot_internal`, its own directory and deployment user. It shares only the host's Nginx Proxy Manager, which it reaches through the existing external network `proxy-network`. Never change a MemoryOS container, host or file from here.

| Path | Owner, mode | Holds |
| --- | --- | --- |
| `/apps/beyondpilot` | root, `0755` | Everything below |
| `/apps/beyondpilot/incoming` | `beyondpilot-ci`, `0700` | One directory per uploaded release; `deploy.sh` keeps the current and previous ones |
| `/apps/beyondpilot/deployments` | root, `0700` | `lock`, `current.env`, `previous.env` |
| `/apps/beyondpilot/backups` | root, `0700` | Pre-deployment dumps (five newest) and nightly dumps (14 newest) |
| `/apps/beyondpilot/secrets` | root, `0700` | Secret files, each owned by uid 1654 with mode `0400` |
| `/apps/beyondpilot/.env.staging` | root, `0600` | The non-secret values of [`staging.env.example`](../../infrastructure/deployment/staging.env.example) |

### Provision the host once

In a session as an administrator of the host:

```sh
# The deployment user: no password, not in the docker group, one sudo rule.
sudo adduser --system --group --shell /bin/bash beyondpilot-ci
sudo install -d -o root -g root -m 0755 /apps/beyondpilot
sudo install -d -o beyondpilot-ci -g beyondpilot-ci -m 0700 /apps/beyondpilot/incoming
sudo install -d -o root -g root -m 0700 /apps/beyondpilot/deployments /apps/beyondpilot/backups /apps/beyondpilot/secrets
echo 'beyondpilot-ci ALL=(root) NOPASSWD: /usr/bin/bash /apps/beyondpilot/incoming/*/deploy.sh *' |
  sudo tee /etc/sudoers.d/beyondpilot-ci >/dev/null
sudo chmod 0440 /etc/sudoers.d/beyondpilot-ci && sudo visudo -c
```

The deployment key can upload a script that sudo then runs, so it carries root on this host. Keep it only in the GitHub `staging` environment, and give its `authorized_keys` line `restrict` so it opens no forwarding or terminal:

```sh
sudo install -d -o beyondpilot-ci -g beyondpilot-ci -m 0700 /home/beyondpilot-ci/.ssh
echo 'restrict <public key of the staging deployment key>' |
  sudo tee /home/beyondpilot-ci/.ssh/authorized_keys >/dev/null
sudo chown beyondpilot-ci:beyondpilot-ci /home/beyondpilot-ci/.ssh/authorized_keys
sudo chmod 0600 /home/beyondpilot-ci/.ssh/authorized_keys
```

Secret files are generated or written on the host and never printed; the api reads them as uid 1654:

```sh
cd /apps/beyondpilot/secrets
sudo sh -c 'umask 077; openssl rand -hex 32 > database-password'
sudo sh -c 'umask 077; cat > google-client-secret'      # paste the client secret, then Ctrl-D
sudo sh -c 'umask 077; htpasswd -nB team > mailpit-ui-auth'   # bcrypt; one line per reader
sudo chown 1654:1654 database-password google-client-secret mailpit-ui-auth
sudo chmod 0400 database-password google-client-secret mailpit-ui-auth
```

`database-password` sets the password when PostgreSQL first creates its data directory; changing the file later does not change the database. Write `.env.staging` from the example with `sudo install -m 0600 /dev/null /apps/beyondpilot/.env.staging` and an editor under sudo.

Install the nightly backup:

```sh
sudo install -m 0755 infrastructure/backup/backup.sh /usr/local/sbin/beyondpilot-backup
sudo install -m 0644 infrastructure/backup/systemd/beyondpilot-backup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now beyondpilot-backup.timer
```

Dumps stay on this host until an off-host backup target is chosen.

### The reverse proxy

One proxy host in Nginx Proxy Manager serves `beyondpilot.vadan.app`, `beyondpilot.ai` and `www.beyondpilot.ai`, forwarding to `http://beyondpilot-web:3000`, with one Let's Encrypt certificate for the three names, Force SSL, HTTP/2 and the advanced configuration below. GenAI Fund owns `beyondpilot.ai` and keeps its DNS at Namecheap: the `@` and `www` A records point at the staging host, and the mail records are theirs. The web application opens `robots.txt` to crawlers on `beyondpilot.ai` only and closes it on every other host, so staging is never indexed next to it.

The browser sees one origin, so Spring's paths go to the api in the advanced configuration of that proxy host. The upstream is a variable, so nginx resolves it per request and the host keeps working while the api container is being replaced. A custom location would resolve it at load and disable the host whenever the container is absent:

```nginx
location ~ ^/(api|login|logout|oauth2|ott)(/|$) {
    set $beyondpilot_api beyondpilot-api;
    proxy_pass http://$beyondpilot_api:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Real-IP $remote_addr;
}
```

The [local composition](development-runtime.md#run-the-whole-stack-in-containers) routes the same paths with `infrastructure/deployment/local-proxy.conf`.

### Read staging mail

Mailpit is on no network the proxy reaches. Open a tunnel to its container and sign in as `team`; the password is in `/apps/beyondpilot/secrets/mailpit-ui-password`, readable by root:

```sh
ssh -L 8025:$(ssh aioffice-app "docker inspect --format '{{.NetworkSettings.Networks.beyondpilot_internal.IPAddress}}' beyondpilot-mailpit"):8025 aioffice-app
```

Then open `http://localhost:8025`.

### GitHub configuration

| Where | Name | Value |
| --- | --- | --- |
| Environment `staging`, deployment branches limited to `main` | variable `STAGING_HOST` | `167.254.65.226` |
| | variable `STAGING_USER` | `beyondpilot-ci` |
| | variable `STAGING_KNOWN_HOSTS` | The host's `ssh-ed25519` key, read over an SSH connection already trusted |
| | secret `STAGING_SSH_KEY` | The private half of the deployment key |
| Repository | variable `STAGING_AUTO_DEPLOY` | `true` to deploy after every successful main CI run; unset for manual deployment only |

## Failure and recovery

A failed or cancelled deployment rolls nothing back. The job summary says it did not finish; the server keeps the pre-deployment dump and `deployments/previous.env`. Read the state as root:

```sh
cd /apps/beyondpilot
cat deployments/current.env deployments/previous.env
docker compose --project-name beyondpilot ps
docker logs --tail 200 beyondpilot-api
```

- **The release is bad and its migrations changed nothing:** deploy the previous release again by dispatching Deploy staging with the CI run named in `previous.env` (`BEYONDPILOT_RELEASE` is `<sha>-<run>-<attempt>`).
- **A migration ran:** an older api refuses a schema it does not know. Fix forward with a new release, or restore the dump taken before the deployment and then deploy the previous release:

  ```sh
  docker compose --project-name beyondpilot stop api web
  docker exec --interactive beyondpilot-postgres pg_restore --username=beyondpilot --dbname=beyondpilot --clean --if-exists \
    < backups/pre-deploy-<release>.dump
  ```

  Restoring discards every write after the dump. Uploaded files live in the volume `beyondpilot_storage` and are not part of it.

Never run `docker system prune` or `docker volume prune` on this host: they act on MemoryOS as well.
