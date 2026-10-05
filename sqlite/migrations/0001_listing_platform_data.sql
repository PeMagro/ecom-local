-- Each marketplace needs its own extra fields to build that platform's publish
-- payload (Mercado Livre: condition/listing_type_id/attributes/sale_terms/...;
-- Shopee/Amazon will need their own, different fields later). Rather than add
-- a column per platform, platform_data holds whatever that row's `marketplace`
-- needs, as JSON — interpreted by that platform's own client/server code.
ALTER TABLE marketplace_listings ADD COLUMN platform_data TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(platform_data));
