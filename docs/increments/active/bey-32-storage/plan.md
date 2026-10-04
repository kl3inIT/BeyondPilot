# Storage: plan

Design: [design.md](design.md). Tracked in Linear as BEY-32.

| #   | Step                                                                                                                                                                                                                                                                   | State                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | The AWS SDK for S3, at its newest stable release, in `gradle/libs.versions.toml`; `V2__storage_create_files.sql`; the `storage` module with its `persistence` package, declared closed with `identity` as its only dependency and listed in `ModulithArchitectureTest` | Open                                                        |
| 2   | `ObjectStorageAdapter`, `LocalObjectStorageAdapter`, `S3ObjectStorageAdapter` and `ObjectStorageAdapterRegistry`: issue a ticket, inspect an object, read its first bytes, open it, delete it                                                                          | Open                                                        |
| 3   | `StorageService`: reserve, confirm, open, delete; `FilePurpose` with its limits; the failure codes                                                                                                                                                                     | Open                                                        |
| 4   | The addresses: reserve, the local receiver, confirm, and the public read; the lines of `SecurityConfiguration` that open the public read; `openapi.yml` and the generated web types refreshed                                                                          | Open                                                        |
| 5   | Documents made true: `docs/tests/storage.md`, the development runbook (the variables, how to run against MinIO), `ARCHITECTURE.md`, the domain model's table (the dependency on `identity`, `*_file_id`)                                                               | Open                                                        |
| 6   | Cleanup of pending files whose ticket expired                                                                                                                                                                                                                          | After the first consumer                                    |
| 7   | The upload helper of the web application                                                                                                                                                                                                                               | With the first screen that uploads (program images, BEY-29) |

Each step is one commit on the branch of BEY-32, pushed as it is finished, in one pull request.

## Verification

- `./gradlew :backend:check`. The storage tests start the application against PostgreSQL in a container and speak HTTP:
  - the three requests end in a stored file, with the local store and with the S3 adapter against MinIO in a container, where the test itself sends the bytes to the presigned address;
  - a size or a media type the purpose refuses; bytes that are not what was announced; a larger body than announced; an expired or reused ticket; another person's pending file; a purpose the caller may not use;
  - the public read: a public file, a private file (`404`), a pending file (`404`), and the redirect of the S3 adapter.
- `ModulithArchitectureTest` lists `storage` with its one dependency; `OpenApiContractTest` regenerates the contract.
- By hand on the first AWS environment: an upload from a browser to the bucket, which is what proves the bucket's CORS rules.

## Needed from outside the code

| What                                                                                                | For                                       | Where it is managed                                                                                |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------- |
| An S3 bucket per environment, private, with CORS for the site's origin                              | The `s3` store                            | The AWS account GenAI Fund provides (asked in BEY-41); its name in `BEYONDPILOT_STORAGE_S3_BUCKET` |
| A role for the application with `s3:PutObject`, `s3:GetObject` and `s3:DeleteObject` on that bucket | Presigning, confirming, reading, deleting | The instance or task role; no access key is stored                                                 |
| A volume, if an environment runs the `local` store                                                  | Files that survive a deployment           | The deployment configuration                                                                       |
