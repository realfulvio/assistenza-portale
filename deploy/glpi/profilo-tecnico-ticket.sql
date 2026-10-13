-- FACOLTATIVO - Profilo GLPI «Tecnico Ticket»: menu ridotto a Assistenza (ticket, pianificazione, statistiche).
-- Utile per i tecnici che usano GLPI solo per i ticket. Non tocca il profilo Super-Admin.
--
-- Stato: usato in questa forma su GLPI 11.0.x. NON e' un'opzione ufficiale di GLPI: i valori numerici dei
-- diritti (es. 519175) sono quelli del profilo standard «Technician» di GLPI 11. Prima di usarlo:
--   1) fai un backup:  sudo mariadb-dump glpidb glpi_profiles glpi_profilerights glpi_profiles_users | gzip > ~/profili-prima.sql.gz
--   2) provalo su un GLPI di test;
--   3) in alternativa crea il profilo dall'interfaccia: Amministrazione > Profili > Technician > Clona.
--
-- Installazione:  sudo mariadb glpidb < deploy/glpi/profilo-tecnico-ticket.sql
-- Rimozione:      vedi in fondo al file.

SET @tech := (SELECT id FROM glpi_profiles WHERE name = 'Technician' LIMIT 1);

INSERT INTO glpi_profiles (name, interface, is_default, helpdesk_hardware, helpdesk_item_type, use_mentions,
                           ticket_status, comment, problem_status, create_ticket_on_login, tickettemplates_id,
                           changetemplates_id, problemtemplates_id, change_status, managed_domainrecordtypes,
                           date_creation, date_mod)
SELECT 'Tecnico Ticket', interface, 0, 0, '[]', use_mentions, ticket_status, 'Solo ticket (profilo semplificato)',
       problem_status, 0, 0, 0, 0, change_status, managed_domainrecordtypes, NOW(), NOW()
FROM glpi_profiles WHERE id = @tech;
SET @p := LAST_INSERT_ID();

-- Tutti i diritti a 0, poi solo quelli necessari ai ticket
INSERT INTO glpi_profilerights (profiles_id, name, rights)
SELECT @p, name, 0 FROM glpi_profilerights WHERE profiles_id = @tech;

UPDATE glpi_profilerights p
JOIN glpi_profilerights t ON t.profiles_id = @tech AND t.name = p.name
SET p.rights = t.rights
WHERE p.profiles_id = @p AND p.name IN ('ticket', 'followup', 'task', 'planning', 'statistic', 'personalization', 'password_update');

UPDATE glpi_profiles SET last_rights_update = NOW() WHERE id = @p;
SELECT @p AS id_profilo_tecnico_ticket;

-- Assegnazione ai tecnici (sostituisci i login) come profilo PREDEFINITO, lasciando gli altri profili:
--   INSERT INTO glpi_profiles_users (users_id, profiles_id, entities_id, is_recursive, is_dynamic, is_default_profile)
--     SELECT id, @p, 0, 1, 0, 0 FROM glpi_users WHERE name IN ('nome1.cognome1', 'nome2.cognome2');
--   UPDATE glpi_users SET profiles_id = @p WHERE name IN ('nome1.cognome1', 'nome2.cognome2');
--
-- Rimozione:
--   SET @p := (SELECT id FROM glpi_profiles WHERE name = 'Tecnico Ticket');
--   UPDATE glpi_users SET profiles_id = 0 WHERE profiles_id = @p;
--   DELETE FROM glpi_profiles_users WHERE profiles_id = @p;
--   DELETE FROM glpi_profilerights WHERE profiles_id = @p;
--   DELETE FROM glpi_profiles WHERE id = @p;
