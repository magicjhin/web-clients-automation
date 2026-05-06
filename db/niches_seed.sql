-- Seed file: 50 best Lithuanian niches ranked by AI
-- Criteria: niche size (200+ companies), payment capacity, B2B character, legality, audit simplicity
-- Usage: psql -U leadgen -d leadgen_app -f db/niches_seed.sql

INSERT INTO niches (name, search_term, ai_rank, status) VALUES

-- Tier 1: High priority (rank 1-10)
('Stomatologija (Odontologija)', 'stomatologija', 1, 'pending'),
('IT Konsultacijos ir Paslaugos', 'it konsultacijos', 2, 'pending'),
('Teisininkai ir Teisinės Paslaugos', 'teisininkai', 3, 'pending'),
('Dirbtuvės ir Techninės Paslaugos', 'automechanika', 4, 'pending'),
('Statybos Paslaugos', 'statyba', 5, 'pending'),
('Turizmą ir Apjungtų Paslaugų', 'turizmą operatoriai', 6, 'pending'),
('Apsaugos Paslaugos', 'apsaugos paslaugos', 7, 'pending'),
('Valymo Paslaugos', 'valymo paslaugos', 8, 'pending'),
('Marketingo ir Reklamos Agentūros', 'marketingo agentūra', 9, 'pending'),
('Grožio Paslaugos (Kirpyklai, Salionai)', 'grožio paslaugos', 10, 'pending'),

-- Tier 2: Medium-high priority (rank 11-25)
('Verslininkų Konsultacijos', 'verslininkų konsultacijos', 11, 'pending'),
('Buhalterijos Paslaugos', 'buhalterijos paslaugos', 12, 'pending'),
('Edukacija ir Mokymai', 'mokymai', 13, 'pending'),
('Logistika ir Sandėliavimas', 'logistika', 14, 'pending'),
('Remonto Paslaugos (Elektra, Santechnika)', 'remonto paslaugos', 15, 'pending'),
('Ieškinėjų ir Taksistų Paslaugos', 'transportavimas', 16, 'pending'),
('Restoranai ir Barai', 'restoranai', 17, 'pending'),
('Namų Projektavimas (Architektūra)', 'architektūra', 18, 'pending'),
('Medicinines Paslaugos (Privatūs Gydytojai)', 'privatūs gydytojai', 19, 'pending'),
('Draudimo Agentūros', 'draudimas', 20, 'pending'),
('Fotografija ir Vaizdo Paslaugos', 'fotografija', 21, 'pending'),
('Personalinės Paslaugos (Treneris, Konsultantas)', 'personalinės treniruotės', 22, 'pending'),
('Automobilių Nuoma', 'automobilių nuoma', 23, 'pending'),
('Skola Administravimas', 'skolų administravimas', 24, 'pending'),
('Biuro Paslaugos ir Personalo Rekrutimas', 'personalas', 25, 'pending'),

-- Tier 3: Medium priority (rank 26-40)
('Psichologinės Paslaugos', 'psichologas', 26, 'pending'),
('Sporto Paslaugos (Treniruokliai, Yoga)', 'sporto klubai', 27, 'pending'),
('Socialinės Medijos Vadyba', 'socialinės medijos vadyba', 28, 'pending'),
('Verslo Konsultacijos (Export, Import)', 'verslo konsultacija', 29, 'pending'),
('Tūpinimo Paslaugos (Hostingas, VPS)', 'hostingas', 30, 'pending'),
('Maisto Pramonė (Pavaros, Butai)', 'maistas', 31, 'pending'),
('Ūkininkavimas ir Žemės Ūkis', 'ūkininkai', 32, 'pending'),
('Medicininės Technikos Pardavimas', 'medicininė technika', 33, 'pending'),
('Laisvalapių Paslaugos (Kurjeriai, Paštas)', 'kurierjų paslaugos', 34, 'pending'),
('Bibliotekos ir Informacijos Centrai', 'bibliotekos', 35, 'pending'),
('Finansų Konsultacijos', 'finansų konsultacija', 36, 'pending'),
('Veterinarinės Paslaugos', 'veterinarija', 37, 'pending'),
('Inovacijos ir Startupai', 'startupai', 38, 'pending'),
('Energetika ir Saulės Paneeliai', 'saulės paneeliai', 39, 'pending'),
('Aplinkos Apsauga', 'aplinkos apsauga', 40, 'pending'),

-- Tier 4: Lower priority (rank 41-50)
('Žemės Ūkio Produktų Parduotuvės', 'žemės ūkio produktai', 41, 'pending'),
('Namų Saugumo Sistemos', 'saugumo sistemos', 42, 'pending'),
('Vidaus Dizaino Paslaugos', 'vidaus dizainas', 43, 'pending'),
('Mašinų Nuoma (Konstrukcija, Žemės Darbai)', 'mašinų nuoma', 44, 'pending'),
('Spausdinimo Paslaugos', 'spausdinimas', 45, 'pending'),
('Lavinimo Centrai (Vaikams)', 'lavinimo centrai', 46, 'pending'),
('Paslaugų Centro Paslaugos', 'paslaugų centrai', 47, 'pending'),
('Socialinės Rūpybos Namai', 'socialinė rūpyba', 48, 'pending'),
('Prekybos Centro Paslaugos', 'prekyba', 49, 'pending'),
('Švietimo Institucijos (Privačios Mokyklos)', 'privačios mokyklos', 50, 'pending');

-- Verification query
SELECT COUNT(*) as total_niches FROM niches;
