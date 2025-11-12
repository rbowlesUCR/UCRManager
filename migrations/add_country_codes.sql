-- Add country codes table and populate with comprehensive data
-- Also add countryCode column to phone_number_inventory

-- Create country_codes table
CREATE TABLE IF NOT EXISTS country_codes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL UNIQUE,
  country_name TEXT NOT NULL,
  iso2 TEXT NOT NULL,
  iso3 TEXT NOT NULL,
  region TEXT,
  flag TEXT
);

-- Add countryCode column to phone_number_inventory if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='phone_number_inventory' AND column_name='country_code'
  ) THEN
    ALTER TABLE phone_number_inventory ADD COLUMN country_code TEXT;
  END IF;
END $$;

-- Populate country_codes with comprehensive international data
INSERT INTO country_codes (country_code, country_name, iso2, iso3, region, flag) VALUES
-- North America
('+1', 'United States', 'US', 'USA', 'North America', '🇺🇸'),
('+1', 'Canada', 'CA', 'CAN', 'North America', '🇨🇦'),

-- Europe
('+44', 'United Kingdom', 'GB', 'GBR', 'Europe', '🇬🇧'),
('+33', 'France', 'FR', 'FRA', 'Europe', '🇫🇷'),
('+49', 'Germany', 'DE', 'DEU', 'Europe', '🇩🇪'),
('+39', 'Italy', 'IT', 'ITA', 'Europe', '🇮🇹'),
('+34', 'Spain', 'ES', 'ESP', 'Europe', '🇪🇸'),
('+31', 'Netherlands', 'NL', 'NLD', 'Europe', '🇳🇱'),
('+32', 'Belgium', 'BE', 'BEL', 'Europe', '🇧🇪'),
('+41', 'Switzerland', 'CH', 'CHE', 'Europe', '🇨🇭'),
('+43', 'Austria', 'AT', 'AUT', 'Europe', '🇦🇹'),
('+45', 'Denmark', 'DK', 'DNK', 'Europe', '🇩🇰'),
('+46', 'Sweden', 'SE', 'SWE', 'Europe', '🇸🇪'),
('+47', 'Norway', 'NO', 'NOR', 'Europe', '🇳🇴'),
('+358', 'Finland', 'FI', 'FIN', 'Europe', '🇫🇮'),
('+353', 'Ireland', 'IE', 'IRL', 'Europe', '🇮🇪'),
('+351', 'Portugal', 'PT', 'PRT', 'Europe', '🇵🇹'),
('+30', 'Greece', 'GR', 'GRC', 'Europe', '🇬🇷'),
('+48', 'Poland', 'PL', 'POL', 'Europe', '🇵🇱'),
('+420', 'Czech Republic', 'CZ', 'CZE', 'Europe', '🇨🇿'),
('+36', 'Hungary', 'HU', 'HUN', 'Europe', '🇭🇺'),
('+40', 'Romania', 'RO', 'ROU', 'Europe', '🇷🇴'),
('+359', 'Bulgaria', 'BG', 'BGR', 'Europe', '🇧🇬'),
('+385', 'Croatia', 'HR', 'HRV', 'Europe', '🇭🇷'),
('+421', 'Slovakia', 'SK', 'SVK', 'Europe', '🇸🇰'),
('+386', 'Slovenia', 'SI', 'SVN', 'Europe', '🇸🇮'),
('+372', 'Estonia', 'EE', 'EST', 'Europe', '🇪🇪'),
('+371', 'Latvia', 'LV', 'LVA', 'Europe', '🇱🇻'),
('+370', 'Lithuania', 'LT', 'LTU', 'Europe', '🇱🇹'),
('+352', 'Luxembourg', 'LU', 'LUX', 'Europe', '🇱🇺'),
('+356', 'Malta', 'MT', 'MLT', 'Europe', '🇲🇹'),
('+357', 'Cyprus', 'CY', 'CYP', 'Europe', '🇨🇾'),
('+354', 'Iceland', 'IS', 'ISL', 'Europe', '🇮🇸'),

-- Asia-Pacific
('+61', 'Australia', 'AU', 'AUS', 'Asia-Pacific', '🇦🇺'),
('+64', 'New Zealand', 'NZ', 'NZL', 'Asia-Pacific', '🇳🇿'),
('+81', 'Japan', 'JP', 'JPN', 'Asia-Pacific', '🇯🇵'),
('+82', 'South Korea', 'KR', 'KOR', 'Asia-Pacific', '🇰🇷'),
('+86', 'China', 'CN', 'CHN', 'Asia-Pacific', '🇨🇳'),
('+852', 'Hong Kong', 'HK', 'HKG', 'Asia-Pacific', '🇭🇰'),
('+853', 'Macau', 'MO', 'MAC', 'Asia-Pacific', '🇲🇴'),
('+886', 'Taiwan', 'TW', 'TWN', 'Asia-Pacific', '🇹🇼'),
('+65', 'Singapore', 'SG', 'SGP', 'Asia-Pacific', '🇸🇬'),
('+60', 'Malaysia', 'MY', 'MYS', 'Asia-Pacific', '🇲🇾'),
('+66', 'Thailand', 'TH', 'THA', 'Asia-Pacific', '🇹🇭'),
('+84', 'Vietnam', 'VN', 'VNM', 'Asia-Pacific', '🇻🇳'),
('+63', 'Philippines', 'PH', 'PHL', 'Asia-Pacific', '🇵🇭'),
('+62', 'Indonesia', 'ID', 'IDN', 'Asia-Pacific', '🇮🇩'),
('+91', 'India', 'IN', 'IND', 'Asia-Pacific', '🇮🇳'),
('+92', 'Pakistan', 'PK', 'PAK', 'Asia-Pacific', '🇵🇰'),
('+94', 'Sri Lanka', 'LK', 'LKA', 'Asia-Pacific', '🇱🇰'),
('+880', 'Bangladesh', 'BD', 'BGD', 'Asia-Pacific', '🇧🇩'),
('+95', 'Myanmar', 'MM', 'MMR', 'Asia-Pacific', '🇲🇲'),

-- Middle East
('+971', 'United Arab Emirates', 'AE', 'ARE', 'Middle East', '🇦🇪'),
('+966', 'Saudi Arabia', 'SA', 'SAU', 'Middle East', '🇸🇦'),
('+972', 'Israel', 'IL', 'ISR', 'Middle East', '🇮🇱'),
('+965', 'Kuwait', 'KW', 'KWT', 'Middle East', '🇰🇼'),
('+974', 'Qatar', 'QA', 'QAT', 'Middle East', '🇶🇦'),
('+973', 'Bahrain', 'BH', 'BHR', 'Middle East', '🇧🇭'),
('+968', 'Oman', 'OM', 'OMN', 'Middle East', '🇴🇲'),
('+962', 'Jordan', 'JO', 'JOR', 'Middle East', '🇯🇴'),
('+961', 'Lebanon', 'LB', 'LBN', 'Middle East', '🇱🇧'),
('+90', 'Turkey', 'TR', 'TUR', 'Middle East', '🇹🇷'),

-- Africa
('+27', 'South Africa', 'ZA', 'ZAF', 'Africa', '🇿🇦'),
('+20', 'Egypt', 'EG', 'EGY', 'Africa', '🇪🇬'),
('+234', 'Nigeria', 'NG', 'NGA', 'Africa', '🇳🇬'),
('+254', 'Kenya', 'KE', 'KEN', 'Africa', '🇰🇪'),
('+233', 'Ghana', 'GH', 'GHA', 'Africa', '🇬🇭'),
('+212', 'Morocco', 'MA', 'MAR', 'Africa', '🇲🇦'),
('+216', 'Tunisia', 'TN', 'TUN', 'Africa', '🇹🇳'),
('+213', 'Algeria', 'DZ', 'DZA', 'Africa', '🇩🇿'),

-- Latin America
('+52', 'Mexico', 'MX', 'MEX', 'Latin America', '🇲🇽'),
('+55', 'Brazil', 'BR', 'BRA', 'Latin America', '🇧🇷'),
('+54', 'Argentina', 'AR', 'ARG', 'Latin America', '🇦🇷'),
('+56', 'Chile', 'CL', 'CHL', 'Latin America', '🇨🇱'),
('+57', 'Colombia', 'CO', 'COL', 'Latin America', '🇨🇴'),
('+51', 'Peru', 'PE', 'PER', 'Latin America', '🇵🇪'),
('+58', 'Venezuela', 'VE', 'VEN', 'Latin America', '🇻🇪'),
('+593', 'Ecuador', 'EC', 'ECU', 'Latin America', '🇪🇨'),
('+502', 'Guatemala', 'GT', 'GTM', 'Latin America', '🇬🇹'),
('+506', 'Costa Rica', 'CR', 'CRI', 'Latin America', '🇨🇷'),
('+507', 'Panama', 'PA', 'PAN', 'Latin America', '🇵🇦'),
('+503', 'El Salvador', 'SV', 'SLV', 'Latin America', '🇸🇻'),
('+504', 'Honduras', 'HN', 'HND', 'Latin America', '🇭�N'),
('+505', 'Nicaragua', 'NI', 'NIC', 'Latin America', '🇳🇮'),
('+598', 'Uruguay', 'UY', 'URY', 'Latin America', '🇺🇾'),
('+595', 'Paraguay', 'PY', 'PRY', 'Latin America', '🇵🇾'),
('+591', 'Bolivia', 'BO', 'BOL', 'Latin America', '🇧🇴'),

-- Caribbean
('+1-876', 'Jamaica', 'JM', 'JAM', 'Caribbean', '🇯🇲'),
('+1-809', 'Dominican Republic', 'DO', 'DOM', 'Caribbean', '🇩🇴'),
('+1-787', 'Puerto Rico', 'PR', 'PRI', 'Caribbean', '🇵🇷'),
('+1-868', 'Trinidad and Tobago', 'TT', 'TTO', 'Caribbean', '🇹🇹'),
('+1-246', 'Barbados', 'BB', 'BRB', 'Caribbean', '🇧🇧'),
('+1-242', 'Bahamas', 'BS', 'BHS', 'Caribbean', '🇧🇸'),
('+1-345', 'Cayman Islands', 'KY', 'CYM', 'Caribbean', '🇰🇾')
ON CONFLICT (country_code) DO NOTHING;

-- Create index on country_code for faster filtering
CREATE INDEX IF NOT EXISTS idx_phone_number_country_code ON phone_number_inventory(country_code);

-- Update existing phone numbers to auto-detect country code from lineUri
UPDATE phone_number_inventory
SET country_code = CASE
  WHEN line_uri LIKE 'tel:+1%' THEN '+1'
  WHEN line_uri LIKE 'tel:+44%' THEN '+44'
  WHEN line_uri LIKE 'tel:+61%' THEN '+61'
  WHEN line_uri LIKE 'tel:+33%' THEN '+33'
  WHEN line_uri LIKE 'tel:+49%' THEN '+49'
  WHEN line_uri LIKE 'tel:+39%' THEN '+39'
  WHEN line_uri LIKE 'tel:+34%' THEN '+34'
  WHEN line_uri LIKE 'tel:+31%' THEN '+31'
  WHEN line_uri LIKE 'tel:+32%' THEN '+32'
  WHEN line_uri LIKE 'tel:+41%' THEN '+41'
  WHEN line_uri LIKE 'tel:+43%' THEN '+43'
  WHEN line_uri LIKE 'tel:+45%' THEN '+45'
  WHEN line_uri LIKE 'tel:+46%' THEN '+46'
  WHEN line_uri LIKE 'tel:+47%' THEN '+47'
  WHEN line_uri LIKE 'tel:+358%' THEN '+358'
  WHEN line_uri LIKE 'tel:+353%' THEN '+353'
  WHEN line_uri LIKE 'tel:+351%' THEN '+351'
  WHEN line_uri LIKE 'tel:+30%' THEN '+30'
  WHEN line_uri LIKE 'tel:+48%' THEN '+48'
  WHEN line_uri LIKE 'tel:+420%' THEN '+420'
  WHEN line_uri LIKE 'tel:+36%' THEN '+36'
  WHEN line_uri LIKE 'tel:+40%' THEN '+40'
  WHEN line_uri LIKE 'tel:+81%' THEN '+81'
  WHEN line_uri LIKE 'tel:+82%' THEN '+82'
  WHEN line_uri LIKE 'tel:+86%' THEN '+86'
  WHEN line_uri LIKE 'tel:+852%' THEN '+852'
  WHEN line_uri LIKE 'tel:+65%' THEN '+65'
  WHEN line_uri LIKE 'tel:+60%' THEN '+60'
  WHEN line_uri LIKE 'tel:+91%' THEN '+91'
  WHEN line_uri LIKE 'tel:+971%' THEN '+971'
  WHEN line_uri LIKE 'tel:+966%' THEN '+966'
  WHEN line_uri LIKE 'tel:+27%' THEN '+27'
  WHEN line_uri LIKE 'tel:+52%' THEN '+52'
  WHEN line_uri LIKE 'tel:+55%' THEN '+55'
  WHEN line_uri LIKE 'tel:+54%' THEN '+54'
  WHEN line_uri LIKE 'tel:+56%' THEN '+56'
  WHEN line_uri LIKE 'tel:+57%' THEN '+57'
  ELSE NULL
END
WHERE country_code IS NULL;

COMMIT;
