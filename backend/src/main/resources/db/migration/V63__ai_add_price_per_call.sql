-- What a call to an OCR service costs (BEY-102). A service bills by the call, not by the token, so its price is kept
-- on the provider in US dollars per 1,000 calls, as an operator enters it, and copied onto each usage row as it was
-- then. Null means nobody entered one. Chat and embedding providers have none.
alter table ai_provider
    add column price_per_1k_calls numeric(12, 6),
    add constraint ai_provider_call_price check (
        price_per_1k_calls is null or (purpose = 'ocr' and price_per_1k_calls >= 0));

alter table ai_usage
    add column price_per_1k_calls numeric(12, 6);
