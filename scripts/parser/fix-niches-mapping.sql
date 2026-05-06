-- Правильный маппинг ниш к реальным категориям rekvizitai.vz.lt
-- Основан на реальном списке 291 категории с сайта

UPDATE niches SET search_term = 'odontologija_paslaugos'                    WHERE id = 51; -- Stomatologija
UPDATE niches SET search_term = 'kompiuteriu_remontas_it_paslaugos'         WHERE id = 52; -- IT Konsultacijos
UPDATE niches SET search_term = 'teisines_paslaugos'                        WHERE id = 53; -- Teisininkai (OK)
UPDATE niches SET search_term = 'autoservisai'                              WHERE id = 54; -- Automechanika
UPDATE niches SET search_term = 'statyba'                                   WHERE id = 55; -- Statybos Paslaugos
UPDATE niches SET search_term = 'keliones'                                  WHERE id = 56; -- Turizmas ir Kelionių
UPDATE niches SET search_term = 'saugos_tarnybos'                           WHERE id = 57; -- Apsaugos Paslaugos
UPDATE niches SET search_term = 'svaros_valymo_paslaugos'                   WHERE id = 58; -- Valymo Paslaugos
UPDATE niches SET search_term = 'reklama_paslaugos'                         WHERE id = 59; -- Marketingo ir Reklamos
UPDATE niches SET search_term = 'grozio_salonai_ir_kirpyklos'               WHERE id = 60; -- Grožio Paslaugos
UPDATE niches SET search_term = 'konsultaciju_paslaugos'                    WHERE id = 61; -- Verslo Konsultacijos
UPDATE niches SET search_term = 'apskaitos_paslaugos'                       WHERE id = 62; -- Buhalterijos Paslaugos
UPDATE niches SET search_term = 'mokymo_kursai'                             WHERE id = 63; -- Edukacija ir Mokymai
UPDATE niches SET search_term = 'logistikos_paslaugos'                      WHERE id = 64; -- Logistika ir Sandėliavimas
UPDATE niches SET search_term = 'patalpu_apdaila_remontas'                  WHERE id = 65; -- Remonto Paslaugos
UPDATE niches SET search_term = 'transporto_paslaugos'                      WHERE id = 66; -- Transporto Paslaugos
UPDATE niches SET search_term = 'kavines_klubai_barai_restoranai'           WHERE id = 67; -- Restoranai ir Barai (OK)
UPDATE niches SET search_term = 'architektai'                               WHERE id = 68; -- Architektūra
UPDATE niches SET search_term = 'medicinos_istaigos_paslaugos'              WHERE id = 69; -- Medicininės Paslaugos
UPDATE niches SET search_term = 'draudimas'                                 WHERE id = 70; -- Draudimo Agentūros
UPDATE niches SET search_term = 'fotografijos_paslaugos_iranga'             WHERE id = 71; -- Fotografija
UPDATE niches SET search_term = 'sporto_paslaugos'                          WHERE id = 72; -- Asmeniniai Treneriai
UPDATE niches SET search_term = 'autonuoma'                                 WHERE id = 73; -- Automobilių Nuoma
UPDATE niches SET search_term = 'skolu_isieskojimas'                        WHERE id = 74; -- Skolų Administravimas
UPDATE niches SET search_term = 'personalo_atranka'                         WHERE id = 75; -- Personalo Rekrutimas
UPDATE niches SET search_term = 'psichologai_psichoterapeutai'              WHERE id = 76; -- Psichologinės Paslaugos
UPDATE niches SET search_term = 'sporto_paslaugos'                          WHERE id = 77; -- Sporto Klubai
UPDATE niches SET search_term = 'seo_paslaugos'                             WHERE id = 78; -- Socialinių Medijų Valdymas
UPDATE niches SET search_term = 'eksportas'                                 WHERE id = 79; -- Importo ir Eksporto
UPDATE niches SET search_term = 'internetas_paslaugos'                      WHERE id = 80; -- Hostingas ir VPS
UPDATE niches SET search_term = 'maisto_gamyba'                             WHERE id = 81; -- Maisto Pramonė
UPDATE niches SET search_term = 'zemes_ukis_paslaugos'                      WHERE id = 82; -- Ūkininkavimas
UPDATE niches SET search_term = 'medicinine_iranga'                         WHERE id = 83; -- Medicininės Technikos Pardavimas
UPDATE niches SET search_term = 'pasto_paslaugos'                           WHERE id = 84; -- Kurjerių ir Pašto
UPDATE niches SET search_term = 'bibliotekos_archyvavimo_paslaugos'         WHERE id = 85; -- Bibliotekos
UPDATE niches SET search_term = 'finansine_veikla_ir_tarpininkavimas'       WHERE id = 86; -- Finansų Konsultacijos
UPDATE niches SET search_term = 'veterinarija'                              WHERE id = 87; -- Veterinarinės Paslaugos
UPDATE niches SET search_term = 'kompiuteriu_programines_irangos_kurimas'   WHERE id = 88; -- Inovacijos ir Startupai
UPDATE niches SET search_term = 'energetika_alternatyvioji_energetika'      WHERE id = 89; -- Energetika ir Saulės Paneliai
UPDATE niches SET search_term = 'gamtos_apsauga'                            WHERE id = 90; -- Aplinkos Apsauga
UPDATE niches SET search_term = 'maisto_parduotuves'                        WHERE id = 91; -- Žemės Ūkio Produktų Parduotuvės
UPDATE niches SET search_term = 'apsaugos_sistemos_patalpoms'               WHERE id = 92; -- Namų Saugumo Sistemos
UPDATE niches SET search_term = 'grafika_dizainas'                          WHERE id = 93; -- Vidaus Dizaino Paslaugos
UPDATE niches SET search_term = 'statybos_technika_iranga_nuoma'            WHERE id = 94; -- Mašinų Nuoma
UPDATE niches SET search_term = 'spaustuves_leidyba'                        WHERE id = 95; -- Spausdinimo Paslaugos
UPDATE niches SET search_term = 'vaiku_bureliai'                            WHERE id = 96; -- Lavinimo Centrai (Vaikams)
UPDATE niches SET search_term = 'buities_paslaugos'                         WHERE id = 97; -- Paslaugų Centrai
UPDATE niches SET search_term = 'socialines_paslaugos'                      WHERE id = 98; -- Socialinės Rūpybos Namai
UPDATE niches SET search_term = 'mazmenine_prekyba'                         WHERE id = 99; -- Prekybos Centrai
UPDATE niches SET search_term = 'aukstesniojo_ir_profesinio_mokymo_istaigos' WHERE id = 100; -- Privačios Mokyklos

SELECT id, name, search_term FROM niches ORDER BY id;
