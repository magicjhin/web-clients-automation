-- Seed file: 50 best Lithuanian niches ranked by AI
-- search_term = category URL key from rekvizitai.vz.lt/imones/{key}/1/
-- Usage: psql -U leadgen -d leadgen_app -f db/niches_seed.sql

INSERT INTO niches (name, search_term, ai_rank, status) VALUES

-- Tier 1: High priority (rank 1-10)
('Stomatologija (Odontologija)', 'odontologijos_klinikos', 1, 'pending'),
('IT Konsultacijos ir Paslaugos', 'informaciniu_technologiju_imoniu_paslaugos', 2, 'pending'),
('Teisininkai ir Teisinės Paslaugos', 'teisines_paslaugos', 3, 'pending'),
('Automechanika ir Techninės Paslaugos', 'autoservisu_paslaugos', 4, 'pending'),
('Statybos Paslaugos', 'statybos_imoniu_paslaugos', 5, 'pending'),
('Turizmas ir Kelionių Paslaugos', 'turizmo_agenturu_paslaugos', 6, 'pending'),
('Apsaugos Paslaugos', 'apsaugos_imoniu_paslaugos', 7, 'pending'),
('Valymo Paslaugos', 'valymo_imoniu_paslaugos', 8, 'pending'),
('Marketingo ir Reklamos Agentūros', 'reklamos_imoniu_paslaugos', 9, 'pending'),
('Grožio Paslaugos (Kirpyklos, Salonai)', 'grozio_salonai', 10, 'pending'),

-- Tier 2: Medium-high priority (rank 11-25)
('Verslo Konsultacijos', 'verslo_konsultacijos', 11, 'pending'),
('Buhalterijos Paslaugos', 'buhalteriu_paslaugos', 12, 'pending'),
('Edukacija ir Mokymai', 'mokymu_centrai', 13, 'pending'),
('Logistika ir Sandėliavimas', 'logistikos_imoniu_paslaugos', 14, 'pending'),
('Remonto Paslaugos (Elektra, Santechnika)', 'remonto_paslaugos', 15, 'pending'),
('Transporto Paslaugos', 'keleiviu_vezimo_paslaugos', 16, 'pending'),
('Restoranai ir Barai', 'kavines_klubai_barai_restoranai', 17, 'pending'),
('Architektūra ir Namų Projektavimas', 'architektu_paslaugos', 18, 'pending'),
('Medicininės Paslaugos (Privatūs Gydytojai)', 'privacios_sveikatos_prieziuros_istaigos', 19, 'pending'),
('Draudimo Agentūros', 'draudimo_brokeriu_paslaugos', 20, 'pending'),
('Fotografija ir Vaizdo Paslaugos', 'fotografu_paslaugos', 21, 'pending'),
('Asmeniniai Treneriai ir Konsultantai', 'sporto_klubai_saliai', 22, 'pending'),
('Automobilių Nuoma', 'automobiliu_nuoma', 23, 'pending'),
('Skolų Administravimas', 'skolu_administravimo_imoniu_paslaugos', 24, 'pending'),
('Personalo Rekrutimas', 'personalo_parinkimo_paslaugos', 25, 'pending'),

-- Tier 3: Medium priority (rank 26-40)
('Psichologinės Paslaugos', 'psichologu_paslaugos', 26, 'pending'),
('Sporto Klubai ir Treniruokliai', 'sporto_klubai_saliai', 27, 'pending'),
('Socialinių Medijų Valdymas', 'reklamos_imoniu_paslaugos', 28, 'pending'),
('Importo ir Eksporto Konsultacijos', 'verslo_konsultacijos', 29, 'pending'),
('Hostingas ir VPS Paslaugos', 'informaciniu_technologiju_imoniu_paslaugos', 30, 'pending'),
('Maisto Pramonė', 'maisto_gamybos_imoniu_paslaugos', 31, 'pending'),
('Ūkininkavimas ir Žemės Ūkis', 'zemdirbystes_paslaugos', 32, 'pending'),
('Medicininės Technikos Pardavimas', 'medicinos_prietaisu_tiekimas', 33, 'pending'),
('Kurjerių ir Pašto Paslaugos', 'pasto_ir_kurjeriu_paslaugos', 34, 'pending'),
('Bibliotekos ir Informacijos Centrai', 'bibliotekos', 35, 'pending'),
('Finansų Konsultacijos', 'finansiniu_paslaugu_imoniu_paslaugos', 36, 'pending'),
('Veterinarinės Paslaugos', 'veterinarines_paslaugos', 37, 'pending'),
('Inovacijos ir Startupai', 'informaciniu_technologiju_imoniu_paslaugos', 38, 'pending'),
('Energetika ir Saulės Paneliai', 'energetikos_imoniu_paslaugos', 39, 'pending'),
('Aplinkos Apsauga', 'aplinkosaugos_imoniu_paslaugos', 40, 'pending'),

-- Tier 4: Lower priority (rank 41-50)
('Žemės Ūkio Produktų Parduotuvės', 'maisto_produktu_parduotuves', 41, 'pending'),
('Namų Saugumo Sistemos', 'apsaugos_imoniu_paslaugos', 42, 'pending'),
('Vidaus Dizaino Paslaugos', 'interjero_dizaino_paslaugos', 43, 'pending'),
('Mašinų Nuoma (Konstruktyvūs Darbai)', 'technikos_nuoma', 44, 'pending'),
('Spausdinimo Paslaugos', 'spausdinimo_paslaugos', 45, 'pending'),
('Lavinimo Centrai (Vaikams)', 'vaiku_ugdymo_istaigos', 46, 'pending'),
('Paslaugų Centrai', 'buitines_technikos_remontas', 47, 'pending'),
('Socialinės Rūpybos Namai', 'socialines_rupybos_istaigos', 48, 'pending'),
('Prekybos Centrai', 'prekybos_centrai', 49, 'pending'),
('Privačios Mokyklos', 'privaciosios_mokyklos', 50, 'pending')

ON CONFLICT DO NOTHING;

SELECT COUNT(*) as total_niches FROM niches;
