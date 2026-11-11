-- Sync Trip On Himalaya website catalogue gaps into CRM trips.
-- Idempotent on slug so local API inserts and Flyway both stay safe.

INSERT INTO trips (
    id, name, slug, category, booking_type, difficulty, base_cost, duration_days,
    itinerary, inclusions, exclusions, is_active, created_at, updated_at, version
)
SELECT gen_random_uuid(), v.name, v.slug, v.category, v.booking_type, v.difficulty,
       v.base_cost, v.duration_days, v.itinerary, pack.inclusions, pack.exclusions,
       TRUE, now(), now(), 0
FROM (VALUES
    ('Bali Pass Trek', 'bali-pass-trek', 'TREK', 'FIXED_BATCH', 'VERY_DIFFICULT', 18999.00, 8,
     'High-altitude cross-over via Bali Pass (upto ~16,200 ft). Source: triponhimalaya.com/bali-pass-trek'),
    ('Buran Ghati Trek', 'buran-ghati-trek', 'TREK', 'FIXED_BATCH', 'DIFFICULT', 16999.00, 7,
     'Himachal classic via Janglik–Dayara–Litham–Buran Pass. Source: triponhimalaya.com/buran-ghati-trek'),
    ('Gaumukh Tapovan Trek', 'gaumukh-tapovan-trek', 'TREK', 'FIXED_BATCH', 'DIFFICULT', 15999.00, 7,
     'Gangotri–Gaumukh glacier and Tapovan meadows. Source: triponhimalaya.com/gaumukh-tapovan-trek'),
    ('Rupin Pass Trek', 'rupin-pass-trek', 'TREK', 'FIXED_BATCH', 'VERY_DIFFICULT', 17999.00, 8,
     'Dhaula to Sangla via Rupin waterfall gully and Rupin Pass. Source: triponhimalaya.com/rupin-pass-trek'),
    ('Rupin Supin Valley Trek', 'rupin-supin-valley-trek', 'TREK', 'FIXED_BATCH', 'MODERATE', 12999.00, 6,
     '6-day moderate valley trek up to ~12,468 ft. Source: triponhimalaya.com/rupin-supin-valley-trek'),
    ('Pin Bhaba Pass Trek', 'pin-bhaba-pass-trek', 'TREK', 'FIXED_BATCH', 'DIFFICULT', 18999.00, 8,
     'Kinnaur–Spiti crossover via Pin Bhaba Pass. Source: triponhimalaya.com/pin-bhaba-pass-trek'),
    ('Kedar Tal Trek', 'kedar-tal-trek', 'TREK', 'FIXED_BATCH', 'DIFFICULT', 14999.00, 6,
     'Alpine lake trek above Gangotri. Source: triponhimalaya.com/kedar-tal-trek'),
    ('Baraadsar Lake Trek', 'baraadsar-lake-trek', 'TREK', 'FIXED_BATCH', 'MODERATE', 11999.00, 5,
     'High-altitude lake trek in Garhwal. Source: triponhimalaya.com/baraadsar-lake-trek'),
    ('Maldaru Lake Trek', 'maldaru-lake-trek', 'TREK', 'FIXED_BATCH', 'MODERATE', 12999.00, 6,
     'Remote Garhwal lake trek. Source: triponhimalaya.com/maldaru-lake-trek'),
    ('Ruinsara Lake Trek', 'ruinsara-lake-trek', 'TREK', 'FIXED_BATCH', 'MODERATE', 13999.00, 7,
     'Har Ki Dun region lake trek. Source: triponhimalaya.com/ruinsara-lake-trek'),
    ('Vijay Top Trek', 'vijay-top-trek', 'TREK', 'FIXED_BATCH', 'MODERATE', 9999.00, 5,
     'Hidden gem near Kedarkantha belt. Source: triponhimalaya.com/vijay-top-trek'),
    ('Changsheel Bugyal Trek', 'changsheel-bugyal-trek', 'TREK', 'FIXED_BATCH', 'MODERATE', 10999.00, 5,
     'Meadow trek on Changsheel ridge. Source: triponhimalaya.com/changsheel-bugyal-trek'),
    ('Kashmir Great Lakes Trek', 'kashmir-great-lakes-trek', 'TREK', 'FIXED_BATCH', 'DIFFICULT', 19999.00, 8,
     '8-day alpine lakes circuit (~13,750 ft). Source: triponhimalaya.com/kashmir-great-lake-trek'),
    ('Deoriatal Chopta Chandrashila Trek', 'deoriatal-chopta-chandrashila', 'TREK', 'FIXED_BATCH', 'EASY', 7999.00, 4,
     'Deoriatal, Chopta and Chandrashila summit. Source: triponhimalaya.com/deoriatal-chopta-chandrashila'),
    ('Everest Base Camp Trek', 'everest-base-camp-trek', 'TREK', 'FIXED_BATCH', 'DIFFICULT', 74999.00, 14,
     'Nepal EBC classic advertised on Trip On Himalaya. Source: triponhimalaya.com'),
    ('Har Ki Dun with Ruinsara Tal Trek', 'har-ki-dun-ruinsara-tal-trek', 'TREK', 'FIXED_BATCH', 'MODERATE', 14999.00, 8,
     'Extended Har Ki Dun with Ruinsara Tal. Source: triponhimalaya.com'),
    ('Gangotri Yatra', 'gangotri-yatra', 'PILGRIMAGE', 'CUSTOM_FIT', 'EASY', 8999.00, 3,
     'Gangotri temple pilgrimage. Source: triponhimalaya.com/gangotri'),
    ('Yamunotri Yatra', 'yamunotri-yatra', 'PILGRIMAGE', 'CUSTOM_FIT', 'EASY', 8999.00, 3,
     'Yamunotri temple pilgrimage. Source: triponhimalaya.com/yamunotri'),
    ('Badrinath Yatra', 'badrinath-yatra', 'PILGRIMAGE', 'CUSTOM_FIT', 'EASY', 9999.00, 3,
     'Badrinath temple pilgrimage. Source: triponhimalaya.com'),
    ('Kasol Kheerganga Manali Solang Tour', 'kasol-kheerganga-manali-solang', 'LEISURE', 'CUSTOM_FIT', 'EASY', 9999.00, 5,
     'Himachal leisure circuit. Source: triponhimalaya.com/kasol-kheerganga-manali-solang'),
    ('Nainital Tour Package', 'nainital-tour-package', 'LEISURE', 'CUSTOM_FIT', 'EASY', 7999.00, 3,
     'Nainital sightseeing package. Source: triponhimalaya.com/nainital-tour-package'),
    ('Chopta Tungnath Chandrashila Trip', 'chopta-tungnath-chandrasheela-trip', 'TREK', 'FIXED_BATCH', 'EASY', 6999.00, 3,
     'Short Chopta–Tungnath–Chandrashila trip. Source: triponhimalaya.com/chopta-tungnath-chandrasheela-trip')
) AS v(name, slug, category, booking_type, difficulty, base_cost, duration_days, itinerary)
CROSS JOIN (
    SELECT
        E'Meals during trek (breakfast, lunch, dinner)\nTented / lodge stay as per itinerary\nTrek leader and local guides\nPermits and forest entry where applicable\nCamping equipment (tents, sleeping mats)\nFirst-aid support and safety briefing\nPickup/drop as mentioned in package' AS inclusions,
        E'Personal trekking gear and clothing\nTravel insurance\nAny hotel stay before/after trek dates\nPorter for personal bag (unless opted)\nTips, personal expenses, and laundry\nGST if billed separately\nAnything not listed in inclusions' AS exclusions
) pack
WHERE NOT EXISTS (SELECT 1 FROM trips t WHERE t.slug = v.slug);
