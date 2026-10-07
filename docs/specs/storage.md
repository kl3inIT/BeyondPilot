# Storage

The `storage` module keeps every uploaded file: a row that records what the file is and who uploaded it, and the
bytes, which sit in an object store (a local directory or an S3 bucket). It was designed and delivered by
[BEY-32](../increments/active/bey-32-storage/design.md). The code is the `storage` application module,
`backend/src/main/java/ai/genaifund/beyondpilot/storage`. Nobody uses storage on its own: a file is always uploaded
for a record of another module, and that module decides who may attach the file and who may read a private one.

## Module

- **Published API.** The package root: `StorageService`, `FilePurpose`, `StoredFile`, `FileDownload`,
  `StorageProperties`, `StorageErrorCode` and `StorageException`.
- **Internal packages.** `web` (`UploadController`, `FileController`), `dto` (`ReserveUploadRequest`,
  `UploadTicketResponse`, `StoredFileResponse`), `persistence` (the `StorageFile` entity and
  `StorageFileRepository`), and `adapter` (the object stores, below).
- **Dependencies.** Closed, with `identity` as its only allowed dependency. `StorageService` asks `IdentityService`
  whether the caller is an active account (`requireActive`) and an operator (`isOperator`). The module publishes no
  event: another module names a file when it saves its own record. `ModulithArchitectureTest` checks the boundary.
- **Tests.** The verification matrix is [docs/tests/storage.md](../tests/storage.md).

## Data

`storage_file` (V3) holds one row per file:

- **Where the bytes are:** `provider` (`local` or `s3`) and `object_key` (unique). The key is generated as
  `<purpose>/<yyyy>/<MM>/<id>`, the month in UTC. The name a person gave never becomes part of a path.
- **What it is:** `purpose`, `public_read`, `file_name`, `media_type` and `size_bytes` (greater than zero). None of
  them changes after the row is written: a file never changes, and a replacement is a new file.
- **State:** `status` (`pending`, then `stored`), `created_at` and `stored_at`.
- **Who:** `uploaded_by_account_id`, a foreign key to `identity_account`.
- **The upload:** `upload_expires_at`, and `upload_token_hash`, set only for a store that receives the bytes through
  this application and cleared when the token is spent or the file is stored.

Rules on the table:

- **Purposes.** A check constraint lists the allowed `purpose` codes. Each new purpose came with its own migration:
  V23, V24, V29, V33 and V37.
- **The store is recorded per file.** `provider` is written at reservation and every later step resolves the adapter
  from the row, so files already stored stay readable after `beyondpilot.storage.provider` changes.
- **Readability is recorded per file.** `public_read` is copied from the purpose at reservation.
- **References from other modules.** `program.cover_file_id` (V4), `proposal.deck_file_id` (V13),
  `talent_profile.photo_file_id` (V20), `solution.deck_file_id` (V25), `organization.logo_file_id` (V29),
  `use_case_attachment.file_id` (V34), and `solution.logo_file_id` and `solution.cover_file_id` (V38) are foreign keys
  to `storage_file`. `solution.image_file_ids` (V38) is a `uuid[]` without a foreign key.

## Purposes

`FilePurpose` fixes, for each purpose, the media types accepted, whether only an operator may upload, and whether
anyone may read the stored file. The largest size is a property of `StorageProperties`.

| Purpose               | Media types                      | Largest size (property, default)     | Who may upload     | Read at the public address |
| --------------------- | -------------------------------- | ------------------------------------ | ------------------ | -------------------------- |
| `program_image`       | PNG, JPEG, WebP                  | `program-image-max-size`, 5MB        | An operator        | Yes                        |
| `talent_photo`        | PNG, JPEG, WebP                  | `talent-photo-max-size`, 2MB         | Any active account | Yes                        |
| `organization_logo`   | PNG, JPEG, WebP                  | `organization-logo-max-size`, 5MB    | Any active account | Yes                        |
| `solution_logo`       | PNG, JPEG, WebP                  | `solution-logo-max-size`, 2MB        | Any active account | Yes                        |
| `solution_image`      | PNG, JPEG, WebP                  | `solution-image-max-size`, 5MB       | Any active account | Yes                        |
| `application_file`    | PDF                              | `application-file-max-size`, 25MB    | Any active account | No                         |
| `solution_deck`       | PDF                              | `solution-deck-max-size`, 25MB       | Any active account | No                         |
| `use_case_attachment` | PDF, PNG, JPEG, DOCX, XLSX, PPTX | `use-case-attachment-max-size`, 25MB | Any active account | No                         |

The properties sit under `beyondpilot.storage`. SVG is in no list. Who may attach a file of a purpose to a record
(an owner of the organization, a member of it) is checked by the module that owns the record, not here.

## Upload

An upload is three requests, the same whatever the store. The web helper `uploadFile` in
`web/src/lib/storage/upload.ts` makes them.

| Method and path                          | Contract                                                                                                                                                                                                                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/storage/uploads`              | Reserve. Body `ReserveUpload`: `purpose`, `fileName` (not blank, at most 255), `mediaType` (not blank, at most 127), `sizeBytes` (positive, the exact length). `201` with `UploadTicket`: the file's `id`, and `method`, `url`, `headers` and `expiresAt` for sending the bytes |
| The ticket's `method` and `url`          | Send the bytes with the ticket's headers. With the local store this is `PUT /api/storage/uploads/{id}/content?token=…`, answered `204`; with S3 it is a presigned address of the bucket                                                                                         |
| `POST /api/storage/uploads/{id}/confirm` | Confirm. `200` with `StoredFile`: `id`, `fileName`, `mediaType`, `sizeBytes`                                                                                                                                                                                                    |

Every upload request needs a session.

### Reserve

- **Caller.** The account must be active. A purpose for operators refuses anyone else with
  `STORAGE_UPLOAD_NOT_PERMITTED` (`403`).
- **Media type.** Stripped and lowercased, then checked against the purpose: `STORAGE_MEDIA_TYPE_NOT_ALLOWED`
  (`400`). It is the announced type, not yet the content.
- **Size.** Over the purpose's largest size: `STORAGE_FILE_TOO_LARGE` (`400`). An unknown purpose or a size of zero
  fails request validation (`400`).
- **Name.** Kept for showing and downloading only: anything up to the last `/` or `\` is dropped, control characters
  are removed, an empty result becomes `file`, and a name over 255 characters keeps its last 255.
- **Ticket.** The row is written `pending` in the store `beyondpilot.storage.provider` names, with
  `upload_expires_at` set `ticket-lifetime` ahead (default `15m`).

### Send, local store

`LocalObjectStorageAdapter` receives the bytes through this application:

- **Address.** The ticket names `PUT /api/storage/uploads/{id}/content?token=…`, with the headers `Content-Type` (the
  announced type) and `X-BeyondPilot-CSRF: 1`. Without the CSRF header the request is refused with `403`.
- **Token.** 32 random bytes, Base64url-encoded, sent only in the ticket; the row keeps its SHA-256 hash.
- **Checks, in order.** The caller's own pending file, in a store that receives through the application, or
  `STORAGE_FILE_NOT_FOUND` (`404`); the ticket not expired, or `STORAGE_TICKET_EXPIRED` (`410`); the request's
  `Content-Length` equal to the announced size, or `STORAGE_CONTENT_MISMATCH` (`400`); the token, or
  `STORAGE_TICKET_REFUSED` (`403`).
- **Single use.** `StorageFileRepository.spendUploadToken` clears the hash in its own transaction before the bytes
  are written, so of two requests with the same token only one proceeds. A send that fails after that point needs a
  new reservation.
- **Length.** Reading stops with an error once the body runs past the announced size, whatever its headers said.
- **Write.** The bytes go to a temporary file beside the target and are moved into place, so a reader never sees half
  a file. An object key that would resolve outside the directory is refused.

### Send, S3

`S3ObjectStorageAdapter` hands out a presigned `PUT` to the bucket, valid for `ticket-lifetime`, with the media type
and the exact length signed. The bucket itself refuses a longer body or another media type, and the bytes never pass
through this application. The ticket's only header is `Content-Type`. The receiving address of the local store
answers `404` for a file in S3.

### Confirm

- **Caller.** Only the uploader; anyone else gets `STORAGE_FILE_NOT_FOUND` (`404`).
- **Nothing sent.** No object under the key: `STORAGE_UPLOAD_MISSING` (`409`).
- **Content check.** The object's size must equal the announced size, and its first 12 bytes must start as the
  media type does: `%PDF-` for PDF, and the PNG, JPEG and WebP (`RIFF` … `WEBP`) signatures. Otherwise the object is
  deleted, the row stays `pending`, and the answer is `STORAGE_CONTENT_MISMATCH` (`400`).
- **Other types.** `StorageService.startsAs` recognises only those four types. Any other accepted type, which today
  means the DOCX, XLSX and PPTX of `use_case_attachment`, fails this check, so such a file cannot be confirmed.
- **Stored.** The row becomes `stored`, `stored_at` is set, the token hash is cleared, and `storage.file.stored` is
  logged with `file_id`, `purpose`, `provider` and `size_bytes`.
- **Repeat.** Confirming a stored file changes nothing and answers `200` again. Confirm does not look at the
  ticket's expiry.

## Reading

| Method and path               | Contract                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/storage/files/{id}` | A stored file whose `public_read` is true, without a session (opened in `SecurityConfiguration`). Local store: `200` with the bytes, the stored media type, the length and `Cache-Control: max-age=31536000, public, immutable`. S3: `302` to a presigned address that serves the file inline, valid for `read-address-lifetime` (default `1h`), with `Cache-Control: max-age=<half that lifetime>, private` |

- **No disclosure.** A private, a pending or an unknown file answers the same `STORAGE_FILE_NOT_FOUND` (`404`), so the
  address does not reveal that a file exists.
- **Private files.** `storage` has no address for them. The owning module checks the reader and then calls
  `StorageService.download(id)`, which returns a `FileDownload` marked as an attachment: either a presigned S3 address
  that downloads the file under its name, or, for the local store, the bytes to stream. The module writes the
  response itself; for example `proposal`'s review (`ReviewController`) and `solution`'s deck
  (`SolutionDirectoryController`).
- **Exactly one way.** A `FileDownload` carries either `redirect` with `redirectLifetime`, or `content`, never both.

## Claiming a file

Another module holds only a file's identifier, in its own column, and goes through `StorageService` for everything
else. It never holds a path, an object key or an address.

- **Attach.** `stored(id, purpose, uploader)` returns the `StoredFile` only when the file is stored, has the purpose
  the record expects and was uploaded by the caller; otherwise `STORAGE_FILE_NOT_FOUND`. Modules call it in the
  transaction that saves their record.
- **Describe.** `describe(id)` and `describe(ids)` return what is known of stored files (name, media type, size,
  purpose, uploader), for showing a record's attachments. Pending files are left out.
- **Delete.** `delete(id)` removes the bytes and then the row; an unknown identifier is not a failure. The owning
  module calls it once its record no longer names the file: `program` (`ReplacedCovers`) and `solution`
  (`DroppedFiles`) after the save commits, in a transaction of their own, logging a failure and leaving the file
  behind; `talent` and `organization` (`OrganizationLogos`) within the save.

Consumers today: `program` (cover), `proposal` (application files), `talent` (photo), `organization` (logo),
`solution` (deck, logo, cover, images) and `usecase` (attachments).

## Object stores

The stores follow the [Strategy-behind-a-registry pattern](../conventions.md#interchangeable-implementations-strategy-behind-a-registry):
`ObjectStorageAdapter`, one implementation per `ObjectStorageProvider` (`LOCAL`, `S3`), resolved by
`ObjectStorageAdapterRegistry`. Startup fails when a provider has no adapter or two.
`ObjectStorageProviderCapabilities.receivesThroughApplication` tells the service whether the store needs the upload
token.

- **Local.** Files live under `beyondpilot.storage.local.directory`, default `build/storage`. The backend image sets
  `BEYONDPILOT_STORAGE_LOCAL_DIRECTORY=/var/lib/beyondpilot/storage`, which `compose.base.yaml` mounts from the
  `storage` volume; staging and production both run `BEYONDPILOT_STORAGE_PROVIDER: local`, and
  `infrastructure/backup/backup.sh` archives that volume.
- **S3.** One bucket, `beyondpilot.storage.s3.bucket` in `beyondpilot.storage.s3.region`, with an optional
  `beyondpilot.storage.s3.endpoint` for another S3-compatible service, addressed by path. The client is built on
  first use, so an environment on the local store never reaches AWS; a missing bucket or region stops that first use
  with an error. Credentials come from the AWS SDK's default chain, never from configuration.

## Configuration

Under `beyondpilot.storage`:

| Property                                | Variable                                                | Default                                                                |
| --------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------- |
| `provider`                              | `BEYONDPILOT_STORAGE_PROVIDER`                          | `local`; none in the `production` profile, so a deployment must set it |
| `ticket-lifetime`                       |                                                         | `15m`                                                                  |
| `read-address-lifetime`                 |                                                         | `1h`                                                                   |
| `*-max-size`                            |                                                         | See [Purposes](#purposes)                                              |
| `local.directory`                       | `BEYONDPILOT_STORAGE_LOCAL_DIRECTORY`                   | `build/storage`                                                        |
| `s3.bucket`, `s3.region`, `s3.endpoint` | `BEYONDPILOT_STORAGE_S3_BUCKET`, `_REGION`, `_ENDPOINT` | Empty                                                                  |

## Pending files

No task removes pending files. A file that is reserved and never confirmed keeps its row, and any bytes that were
sent stay in the store. V3 adds the partial index `storage_file_pending_idx` on `upload_expires_at` for pending rows,
which no code reads yet.

## Failures

`StorageErrorCode`, turned into a problem by `config.ApiExceptionHandler` ([API errors](../conventions.md#api-errors)):

| Code                                                                                   | Category      | Status |
| -------------------------------------------------------------------------------------- | ------------- | ------ |
| `STORAGE_MEDIA_TYPE_NOT_ALLOWED`, `STORAGE_FILE_TOO_LARGE`, `STORAGE_CONTENT_MISMATCH` | Validation    | `400`  |
| `STORAGE_UPLOAD_NOT_PERMITTED`, `STORAGE_TICKET_REFUSED`                               | Not permitted | `403`  |
| `STORAGE_FILE_NOT_FOUND`                                                               | Not found     | `404`  |
| `STORAGE_UPLOAD_MISSING`                                                               | Conflict      | `409`  |
| `STORAGE_TICKET_EXPIRED`                                                               | Gone          | `410`  |
