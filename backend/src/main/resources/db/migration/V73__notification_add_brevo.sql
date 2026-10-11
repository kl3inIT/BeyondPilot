-- Brevo as a fourth email provider: its API key and the token its webhook presents, both AES-GCM ciphertexts as the
-- other providers' secrets are. Existing rows keep their provider; no row is rewritten.
alter table email_settings
    add column brevo_api_key       bytea,
    -- Brevo signs no report: its webhook is recognised by this bearer token.
    add column brevo_webhook_token bytea,
    drop constraint email_settings_provider,
    add constraint email_settings_provider check (provider in ('ses', 'resend', 'smtp', 'brevo'));

alter table email_message
    drop constraint email_message_provider,
    add constraint email_message_provider check (provider in ('ses', 'resend', 'smtp', 'brevo'));
