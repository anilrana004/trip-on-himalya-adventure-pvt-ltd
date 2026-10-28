ALTER TABLE trips
    ADD COLUMN meta_title varchar(70),
    ADD COLUMN meta_description varchar(160),
    ADD COLUMN content_brief text;
