# Storage: uploading and serving files

Status: backend implemented on 4 October 2026; the web upload helper follows with the first screen that uploads ([plan](plan.md)). It is the third slice of the [Phase 1 domain model](../bey-22-phase-1-domain-model/design.md) and narrows that model's `storage` module to what the first two consumers need: images of a program, and the files of an application.

## What a person can do

- An operator adds a cover or a judge's photo to a program; a visitor sees it on the program's page.
- An applicant attaches a deck or a proposal to an application; the applicant and the people reviewing that program can open it, and nobody else can.

Nobody uses storage on its own: a file is always uploaded for a program, an application or another record, and the module that owns that record decides who may attach it and who may read it.

## Boundary discovery

**Story.** A person picks a file in a form. The browser asks for permission to upload it, sends the bytes, and reports that it has finished. The form then saves, naming the file. Later a page shows the image, or a reviewer opens the deck.

- _The upload is abandoned:_ the file stays pending and is never shown; a later cleanup removes it.
- _The file is not what was announced_ (another size, or not a PDF): confirming fails and the person chooses another file.
- _The permission expires before the upload ends:_ the person starts again.

**Glossary.**

| Term          | Meaning                                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| File          | One uploaded object and what is known about it: name, media type, size, purpose, who uploaded it. It never changes after it is stored; a replacement is a new file |
| Purpose       | Why a file is uploaded. It fixes the allowed media types, the largest size, who may upload and whether anyone may read it                                          |
| Upload ticket | Permission to send one file's bytes to one address for a short time                                                                                                |
| Object store  | Where the bytes are: a directory on disk, or an S3 bucket                                                                                                          |

The domain model's first draft called this module `document` and gave it versions and extracted text. Those belong to the deck of a proposal and to AI matching, and arrive with them (BEY-37, BEY-39). The columns of other modules that the draft named `document_id` are named `<what>_file_id`.

**Commands and facts.** Reserve an upload; confirm an upload; open a file; delete a file. No event is published: no module reacts to a stored file, it names the file when it saves its own record.

**Owner of data and rules.** `storage` owns the file record and the bytes, and these rules: a purpose's limits hold for every file; a pending file is never readable; a private file is never served by the public address. The owning module holds the rule about who may attach or read a file of its records.

**Communication.** Other modules call `StorageService` in the same transaction as their own write. `storage` asks `identity` who the caller is and whether they are an operator. This adds the dependency `storage → identity`, which the domain model's table did not list; it exists because the upload addresses are part of this module, so that the web application has one way to upload.

## The upload, in three requests

The web application does the same three things whatever the object store is.

| Step    | Request                                                                                            | Answer                                                                                                                                                                                             |
| ------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reserve | `POST /api/storage/uploads` with `purpose`, `fileName`, `mediaType`, `sizeBytes`                   | `201` with the file's `id` and a ticket: `method`, `url`, `headers`, `expiresAt`. `400` when the purpose refuses the media type or the size, `403` when the caller may not upload for that purpose |
| Send    | The ticket's `method` to the ticket's `url`, with the ticket's `headers` and the bytes as the body | Whatever the address answers with a 2xx status                                                                                                                                                     |
| Confirm | `POST /api/storage/uploads/{id}/confirm`                                                           | `200` with `id`, `fileName`, `mediaType`, `sizeBytes`. `409` when nothing was uploaded, `400` when the bytes are not what was announced                                                            |

What the ticket points at is the only difference between the two object stores:

| Object store | The ticket's address                                                                                                 | Who receives the bytes                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `local`      | `PUT /api/storage/uploads/{id}/content?token=…` on this application, with the CSRF header among the ticket's headers | This application, which writes them to the directory |
| `s3`         | A presigned `PUT` to the bucket, signed for that media type and that exact length                                    | S3; the bytes never pass through this application    |

- A ticket is valid for 15 minutes. The local token is random, stored as a hash, and works once.
- The exact length is part of what is signed, so a larger file than announced is refused by the store itself.
- Confirming reads the object's size and its first bytes from the store: the size must be the announced one and the content must start as its media type does (`%PDF`, the PNG, JPEG or WebP signature). Only then is the file `stored`.
- Only the uploader may send to or confirm their own pending file.

## Reading a file

| File                             | Address                                                                                  | Answer                                                                                                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public (a program's images)      | `GET /api/storage/files/{id}`, without a session                                         | `local`: the bytes, cacheable for a year, since a file never changes. `s3`: a redirect to a presigned address valid for one hour, itself cacheable for less |
| Private (an application's files) | An address of the owning module, which checks the reader and then calls `StorageService` | The same two answers, for `attachment` download                                                                                                             |

The public address answers `404` for a private or a pending file, so it does not reveal that one exists. Files are served with `X-Content-Type-Options: nosniff` and their stored media type; SVG is not an allowed type, because it can carry script.

## Purposes

Only the purposes with a consumer in sight are defined; a module adds its own with its first screen.

| Purpose            | Media types     | Largest size | Who may upload   | Readable by           |
| ------------------ | --------------- | ------------ | ---------------- | --------------------- |
| `program_image`    | PNG, JPEG, WebP | 5 MB         | An operator      | Anyone                |
| `application_file` | PDF             | 25 MB        | Anyone signed in | Decided by `proposal` |

The 25 MB limit follows the live application form; the brief says 10 MB, and the question is open with GenAI Fund (BEY-41). The limit is a property, so the answer is a configuration change.

## Decisions

| Decision                                                             | Choice                                                                                                                                                                                                                                                                                         | Why                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two object stores from the start                                     | `LocalObjectStorageAdapter` and `S3ObjectStorageAdapter` behind `ObjectStorageAdapterRegistry`, the [Strategy-behind-a-registry pattern](../../../conventions.md#interchangeable-implementations-strategy-behind-a-registry), a closed family keyed by `ObjectStorageProvider` (`local`, `s3`) | Deployment is on AWS, so S3 is the target; access to the AWS account is not granted yet, and a developer's machine should need neither AWS nor an extra container. `BEYONDPILOT_STORAGE_PROVIDER` chooses; deployed environments have no default                 |
| One upload protocol, the store picks the address                     | Reserve, send, confirm. On S3 the browser sends straight to the bucket with a presigned address; locally it sends to this application                                                                                                                                                          | The direct upload is the efficient path on AWS, and the web application must not know which store is in use. Rails Active Storage does the same with its Disk and S3 services; the team's MemoryOS project has the same shape (`authorizeUpload`, then `verify`) |
| A file records its store                                             | `storage_file.provider` is written at reservation; reading resolves the adapter from the row                                                                                                                                                                                                   | An environment that moves from `local` to `s3` keeps serving the files it already has                                                                                                                                                                            |
| Upload addresses belong to `storage`, attaching belongs to the owner | `storage` checks the purpose's rule (signed in, or operator). The owning module, when it saves, checks that the file is stored, has the purpose it expects and was uploaded by the caller                                                                                                      | One upload client in the web application and one place for limits, while the rule about a record stays with the module that owns the record                                                                                                                      |
| No local signing key                                                 | The local ticket carries a random token whose hash is in the file's row                                                                                                                                                                                                                        | One secret fewer to manage; the row already exists                                                                                                                                                                                                               |
| Files are immutable                                                  | A replaced deck is a new file; the old one is deleted by its owner                                                                                                                                                                                                                             | Public files can be cached for good, and a reviewer never sees a file change under them                                                                                                                                                                          |
| Credentials                                                          | The AWS SDK's default chain: the instance or task role on AWS                                                                                                                                                                                                                                  | No access key in configuration or in Git                                                                                                                                                                                                                         |
| Not built now                                                        | Versions, extracted text, virus scanning, image resizing, cleanup of pending files                                                                                                                                                                                                             | Each has no consumer yet; cleanup is step 6 of the plan                                                                                                                                                                                                          |

## Modules

| Module    | Holds                                                                                                                                                                                                                        | Depends on |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `storage` | `StorageService`, `FilePurpose`, `StorageErrorCode`, `StorageException`, `StorageProperties`, the record `StoredFile` that other modules receive; `adapter` (the two adapters and the registry), `web`, `dto`, `persistence` | `identity` |

## Data

`V2__storage_create_files.sql`:

| Table          | Columns                                                                                                                                                                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage_file` | `id`, `provider` (`local`, `s3`), `object_key` (unique), `purpose`, `public_read`, `file_name`, `media_type`, `size_bytes`, `status` (`pending`, `stored`), `uploaded_by_account_id`, `upload_token_hash` (local only), `upload_expires_at`, `created_at`, `stored_at` |

The object key is generated (`<purpose>/<yyyy>/<mm>/<id>`); the name a person gave is kept only as text to show and to download under.

## Configuration

| Variable                                                         | Meaning                                                         | Local default                              |
| ---------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------ |
| `BEYONDPILOT_STORAGE_PROVIDER`                                   | `local` or `s3`                                                 | `local`                                    |
| `BEYONDPILOT_STORAGE_LOCAL_DIRECTORY`                            | Where the local store writes                                    | `backend/build/storage`, which Git ignores |
| `BEYONDPILOT_STORAGE_S3_BUCKET`, `BEYONDPILOT_STORAGE_S3_REGION` | The bucket and its region                                       | —                                          |
| `BEYONDPILOT_STORAGE_S3_ENDPOINT`                                | Another S3-compatible endpoint; used by the tests against MinIO | —                                          |

On AWS the bucket is private, blocks public access, and allows `PUT` and `GET` from the site's origin through its CORS rules. A deployed environment that runs the local store needs a volume, or its files are lost on the next deployment.

## Known limits

- The presigned upload is tested against MinIO in a container (Chainguard's build, since MinIO no longer publishes an image), not against AWS; the first deployment checks it by hand, CORS included.
- A file that is reserved and never confirmed stays until the cleanup of step 6 exists.
- A redirect to S3 leaves the site's origin for the download only; the address expires and names nothing but the object.
