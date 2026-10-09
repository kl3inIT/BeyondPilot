-- OCR services as a third purpose of a provider, and the reader of document pages (BEY-102). A page that is only a
-- picture is read by a chat model that reads images, as before, or by an OCR service an operator connected.

-- An OCR provider is reached through an adapter at an address the operator gives, as a chat provider is, and has no
-- vendor.
alter table ai_provider
    drop constraint ai_provider_purpose,
    drop constraint ai_provider_vendor,
    add constraint ai_provider_purpose check (purpose in ('embedding', 'chat', 'ocr')),
    add constraint ai_provider_vendor check (
        (purpose = 'embedding' and vendor in ('openai', 'openrouter')) or (purpose in ('chat', 'ocr') and vendor is null));

-- The reader of document pages is the row's model or this OCR provider, never both. Removing the provider leaves the
-- task without a reader. The model chosen before this change stays chosen.
alter table ai_task_model
    add column ocr_provider_id uuid references ai_provider (id) on delete set null,
    add constraint ai_task_model_ocr_task check (ocr_provider_id is null or task = 'document_reading'),
    add constraint ai_task_model_one_reader check (model_id is null or ocr_provider_id is null);
