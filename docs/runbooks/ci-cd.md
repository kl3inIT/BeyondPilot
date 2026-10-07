# CI and delivery to staging and production

[CI](../../.github/workflows/ci.yml) verifies every branch push and, on a main push, publishes a release. [Deploy](../../.github/workflows/deploy.yml) promotes a published release to one environment, where [`deploy.sh`](../../infrastructure/deployment/deploy.sh) rolls it out with Docker Compose. [Deploy staging](../../.github/workflows/deploy-staging.yml) calls it for every main release; [Deploy production](../../.github/workflows/deploy-production.yml) calls it when an operator picks a release already accepted on staging. The two callers only decide when their environment runs, as in MemoryOS. A green deployment means the release is running and healthy; it does not claim that the product works, which the team checks on the site.

## Releases

On a main push the `Images` job builds both images, starts the local composition from them and checks its routes, then pushes those exact images to GHCR as `ghcr.io/kl3init/beyondpilot-{api,web}:sha-<sha>-<run>-<attempt>`. A tag names one CI attempt and is never moved; there is no `latest`.

`Publish release` runs only after every other job of the run has passed. It uploads the artifact `release-<sha>`, kept 30 days, holding `images.env`: the source SHA and both images by digest. Deploy accepts nothing else. An image a failed run pushed is named by no `images.env`, so it is never deployed.

## Deployment

| Environment | Address                                | Deployed                                                                                                                                                                            |
| ----------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Staging     | `beyondpilot.vadan.app`                | After every successful main CI run when the repository variable `STAGING_AUTO_DEPLOY` is `true`, and by hand at any time                                                            |
| Production  | `beyondpilot.ai`, `www.beyondpilot.ai` | Only by hand, with a release already running well on staging; the GitHub `production` environment asks a reviewer to approve. There is no automatic production deployment by design |

Each deployment stops the api for about 20 seconds while it saves a dump and Flyway migrates; there is no zero-downtime rollout. Staging takes that many times a day, production only when an operator chooses.

Staging:

```text
gh workflow run deploy-staging.yml --ref main -f ci_run_id=<successful main CI run>
gh run watch <deployment run> --exit-status
```

Production, with the CI run of the release that staging runs (`deployments/current.env` of staging names it):

```text
gh workflow run deploy-production.yml --ref main -f ci_run_id=<that CI run>
```

The workflow:

1. Checks that the CI run is a successful push to main of this repository, and that its `Publish release` job passed. An automatic run whose commit is no longer the head of main stops there, because the newer commit deploys after its own CI.
2. Checks out that commit, downloads its `images.env` and copies it, `deploy.sh`, `compose.base.yaml` and the overlay of the environment to `<root>/incoming/<release>/` over SSH, with a pinned host key and the environment's own deployment key, which exists only for the job.
3. Runs `deploy.sh <environment> <release> <actor>` under the deployment user's sudo rule and passes the job's package-read token on standard input.

`deploy.sh` takes the environment first: `production` or `staging` selects the directory, the Compose project, the container names, the environment file `.env.<environment>` and the overlay `compose.<environment>.yaml`, so a deployment of one never touches the other. It takes the lock of that environment and refuses a malformed release, an environment file that is not root's with mode `0600`, or a missing secret file. It pulls both images and checks that their `revision` label is the release's SHA. When a database is running, it stops the api and saves a `pg_dump` that `pg_restore --list` can read to `<root>/backups/pre-deploy-<release>.dump`. It then starts the composition with `up --wait`: PostgreSQL, then the api, where Flyway migrates, then the web application once the api is healthy. It checks the running revisions and records the release in `deployments/current.env` and the one before in `previous.env`. The environment is down while the api restarts; there is no zero-downtime rollout.

## The host

Both environments share `hn-fci-k8s-aioffice-application` (`167.254.65.226`, Ubuntu 24.04) with the production of MemoryOS, until GenAI Fund's own account takes production. Each environment of BeyondPilot has its own directory, Compose project, PostgreSQL container and volumes, and network; they share the deployment user and the host's Nginx Proxy Manager, which they reach through the existing external network `proxy-network`. Never change a MemoryOS container, host or file from here.

|                             | Production                                                                                                | Staging                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Root                        | `/apps/beyondpilot`                                                                                       | `/apps/beyondpilot-staging`                                                                      |
| Compose project, containers | `beyondpilot`, `beyondpilot-{postgres,api,web}`                                                           | `beyondpilot-staging`, `beyondpilot-staging-{postgres,api,web}`                                  |
| Volumes                     | `beyondpilot_postgres-data`, `beyondpilot_storage`                                                        | `beyondpilot-staging_postgres-data`, `beyondpilot-staging_storage`                               |
| Environment file            | `.env.production` from [`production.env.example`](../../infrastructure/deployment/production.env.example) | `.env.staging` from [`staging.env.example`](../../infrastructure/deployment/staging.env.example) |
| Spring profiles             | `production`                                                                                              | `production,staging`                                                                             |

Under each root:

| Path                 | Owner, mode              | Holds                                                                                                                                                       |
| -------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `incoming`           | `beyondpilot-ci`, `0700` | One directory per uploaded release; `deploy.sh` keeps the current and previous ones                                                                         |
| `deployments`        | root, `0700`             | `lock`, `current.env`, `previous.env`                                                                                                                       |
| `backups`            | root, `0700`             | Pre-deployment dumps (five newest), nightly dumps and nightly archives of the uploaded files (14 newest of each)                                            |
| `secrets`            | root, `0700`             | `database-password`, `google-client-secret`, `notification-encryption-key`, `ai-encryption-key`, `mcp-signing-key`, each owned by uid 1654 with mode `0400` |
| `.env.<environment>` | root, `0600`             | The non-secret values of the environment's example                                                                                                          |

### Provision the host once

In a session as an administrator of the host:

```sh
# The deployment user: no password, not in the docker group, one sudo rule.
sudo adduser --system --group --shell /bin/bash beyondpilot-ci
for root in /apps/beyondpilot /apps/beyondpilot-staging; do
  sudo install -d -o root -g root -m 0755 "$root"
  sudo install -d -o beyondpilot-ci -g beyondpilot-ci -m 0700 "$root/incoming"
  sudo install -d -o root -g root -m 0700 "$root/deployments" "$root/backups" "$root/secrets"
done
printf '%s\n' \
  'beyondpilot-ci ALL=(root) NOPASSWD: /usr/bin/bash /apps/beyondpilot/incoming/*/deploy.sh *' \
  'beyondpilot-ci ALL=(root) NOPASSWD: /usr/bin/bash /apps/beyondpilot-staging/incoming/*/deploy.sh *' |
  sudo tee /etc/sudoers.d/beyondpilot-ci >/dev/null
sudo chmod 0440 /etc/sudoers.d/beyondpilot-ci && sudo visudo -c
```

A deployment key can upload a script that sudo then runs, so it carries root on this host. Each environment has its own key, kept only in its GitHub environment; never reuse the staging key for production. Give each `authorized_keys` line `restrict` so it opens no forwarding or terminal:

```sh
sudo install -d -o beyondpilot-ci -g beyondpilot-ci -m 0700 /home/beyondpilot-ci/.ssh
printf '%s\n' 'restrict <public key of the staging deployment key>' 'restrict <public key of the production deployment key>' |
  sudo tee /home/beyondpilot-ci/.ssh/authorized_keys >/dev/null
sudo chown beyondpilot-ci:beyondpilot-ci /home/beyondpilot-ci/.ssh/authorized_keys
sudo chmod 0600 /home/beyondpilot-ci/.ssh/authorized_keys
```

Secret files are generated or written on the host and never printed; the api reads them as uid 1654. In each root:

```sh
cd <root>/secrets
sudo sh -c 'umask 077; openssl rand -hex 32 > database-password'
sudo sh -c 'umask 077; cat > google-client-secret'      # paste the client secret, then Ctrl-D
sudo sh -c 'umask 077; openssl rand -base64 32 > notification-encryption-key'
sudo sh -c 'umask 077; openssl rand -base64 32 > ai-encryption-key'
sudo sh -c 'umask 077; openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out mcp-signing-key'
sudo chown 1654:1654 database-password google-client-secret notification-encryption-key ai-encryption-key mcp-signing-key
sudo chmod 0400 database-password google-client-secret notification-encryption-key ai-encryption-key mcp-signing-key
```

`ai-encryption-key` encrypts the keys of the AI providers that operators connect in Admin › AI › Providers, where the provider and the model search embeds with are chosen; replacing it makes those keys unreadable, and search goes by keywords until an operator enters them again. `mcp-signing-key` signs the access tokens of the AI apps people connect to the MCP servers; replacing it ends every connection's current token, and the apps refresh or connect again. `database-password` sets the password when PostgreSQL first creates its data directory; changing the file later does not change the database. `notification-encryption-key` encrypts the email providers' secrets that operators enter in Admin › Email; each environment has its own, and replacing it makes those secrets unreadable until an operator enters them again. Write the environment file from its example with `sudo install -m 0600 /dev/null <root>/.env.<environment>` and an editor under sudo. Both environments use the same Google OAuth client, whose redirect URIs name both addresses.

Install the nightly backup, which saves both environments, production first:

```sh
sudo install -m 0755 infrastructure/backup/backup.sh /usr/local/sbin/beyondpilot-backup
sudo install -m 0644 infrastructure/backup/systemd/beyondpilot-backup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now beyondpilot-backup.timer
```

Each night it dumps the database and archives the volume of uploaded files, which the dump does not hold. Both stay on this host until an off-host backup target is chosen.

### The reverse proxy

Two proxy hosts in Nginx Proxy Manager, each with a Let's Encrypt certificate, Force SSL, HTTP/2 and the advanced configuration below:

| Proxy host        | Names                                  | Forwards to                           | Api in the advanced configuration |
| ----------------- | -------------------------------------- | ------------------------------------- | --------------------------------- |
| Production (id 8) | `beyondpilot.ai`, `www.beyondpilot.ai` | `http://beyondpilot-web:3000`         | `beyondpilot-api`                 |
| Staging           | `beyondpilot.vadan.app`                | `http://beyondpilot-staging-web:3000` | `beyondpilot-staging-api`         |

GenAI Fund owns `beyondpilot.ai` and keeps its DNS at Namecheap: the `@` and `www` A records point at this host, and the mail records are theirs. The web application opens `robots.txt` to crawlers on `beyondpilot.ai` only and closes it on every other host, so staging is never indexed next to it.

The browser sees one origin, so Spring's paths go to the api in the advanced configuration of each proxy host; staging sets `$beyondpilot_api` to `beyondpilot-staging-api`. The upstream is a variable, so nginx resolves it per request and the host keeps working while the api container is being replaced. A custom location would resolve it at load and disable the host whenever the container is absent. The proxy is the edge, so it replaces `X-Forwarded-For` with the address that connected to it and drops `Forwarded`, which Spring would read first: either header as the client wrote it would be taken for the client's address, and limits kept per address would believe it:

```nginx
location ~ ^/(api|login|logout|oauth2|ott|\.well-known/oauth-authorization-server)(/|$) {
    set $beyondpilot_api beyondpilot-api;
    proxy_pass http://$beyondpilot_api:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header Forwarded "";
    proxy_set_header X-Real-IP $remote_addr;
}
```

The [local composition](development-runtime.md#run-the-whole-stack-in-containers) routes the same paths with `infrastructure/deployment/local-proxy.conf`.

### Email of an environment

Each environment sends real email through the provider an operator sets in Admin › Email › Settings; nothing is configured on the host apart from `notification-encryption-key`. On staging, test with your own address. Admin › Email › Activity shows every email and whether it was sent.

### GitHub configuration

| Where                                                                                | Name                              | Value                                                                                 |
| ------------------------------------------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------- |
| Environment `production`, deployment branches limited to `main`, a required reviewer | variable `PRODUCTION_HOST`        | `167.254.65.226`                                                                      |
|                                                                                      | variable `PRODUCTION_USER`        | `beyondpilot-ci`                                                                      |
|                                                                                      | variable `PRODUCTION_KNOWN_HOSTS` | The host's `ssh-ed25519` key                                                          |
|                                                                                      | secret `PRODUCTION_SSH_KEY`       | The private half of the production deployment key                                     |
| Environment `staging`, deployment branches limited to `main`                         | variable `STAGING_HOST`           | `167.254.65.226`                                                                      |
|                                                                                      | variable `STAGING_USER`           | `beyondpilot-ci`                                                                      |
|                                                                                      | variable `STAGING_KNOWN_HOSTS`    | The host's `ssh-ed25519` key, read over an SSH connection already trusted             |
|                                                                                      | secret `STAGING_SSH_KEY`          | The private half of the deployment key                                                |
| Repository                                                                           | variable `STAGING_AUTO_DEPLOY`    | `true` to deploy after every successful main CI run; unset for manual deployment only |

## Failure and recovery

A failed or cancelled deployment rolls nothing back. The job summary says it did not finish; the server keeps the pre-deployment dump and `deployments/previous.env`. Read the state as root, here for production (staging: `/apps/beyondpilot-staging`, project `beyondpilot-staging`, containers `beyondpilot-staging-*`):

```sh
cd /apps/beyondpilot
cat deployments/current.env deployments/previous.env
docker compose --project-name beyondpilot ps
docker logs --tail 200 beyondpilot-api
```

- **The release is bad and its migrations changed nothing:** deploy the previous release again by dispatching the environment's Deploy workflow with the CI run named in `previous.env` (`BEYONDPILOT_RELEASE` is `<sha>-<run>-<attempt>`).
- **A migration ran:** an older api refuses a schema it does not know. Fix forward with a new release, or restore the dump taken before the deployment and then deploy the previous release:

  ```sh
  docker compose --project-name beyondpilot stop api web
  docker exec --interactive beyondpilot-postgres pg_restore --username=beyondpilot --dbname=beyondpilot --clean --if-exists \
    < backups/pre-deploy-<release>.dump
  ```

  Restoring discards every write after the dump. Uploaded files live in the volume `beyondpilot_storage` and are not part of it; the nightly `nightly-<time>-files.tar.gz` holds them.

Never run `docker system prune` or `docker volume prune` on this host: they act on MemoryOS as well.
