-- Public storefront channel as a first-class lead source (Salesforce-style).
-- Customer site lives outside this repo; CRM only records the intake channel.

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;

ALTER TABLE leads
    ADD CONSTRAINT leads_source_check CHECK (source IN (
        'GOOGLE_ADS', 'FACEBOOK_ADS', 'INSTAGRAM', 'WEBSITE', 'STOREFRONT', 'WHATSAPP',
        'REFERRAL', 'JUSTDIAL', 'WALK_IN', 'B2B', 'EXISTING_CUSTOMER', 'OTHER'
    ));
