-- FACOLTATIVO - Trigger sulla coda delle mail di GLPI (glpi_queuednotifications). Fa tre cose:
--  1) scarta la mail «Aggiornamento di una chiamata» generata nei primi 20 secondi di vita del ticket
--     (doppione della «Nuova chiamata» quando il ticket viene assegnato subito);
--  2) scarta la copia per la casella condivisa (l'indirizzo «Amministratore» di GLPI, config admin_email) per
--     aggiornamenti, soluzione e chiusura quando il ticket ha un TECNICO assegnato: cosi' le mail vanno al tecnico
--     e al richiedente; se il ticket e' assegnato solo a un gruppo (o a nessuno) arrivano alla casella condivisa;
--  2b) scarta la mail «Chiusura della chiamata» quando la chiusura e' quella AUTOMATICA di GLPI (azione closeticket):
--     le chiusure manuali, compresa la conferma «Risolto, grazie» dal portale, la inviano normalmente;
--  3) riscrive l'oggetto: "Richiesta n. 23 · Nuova · titolo" (stati: Nuova, Aggiornamento, Risolta, Chiusa),
--     senza il prefisso "[GLPI #0000023]" (che GLPI aggiunge sempre) e senza la "[categoria]" iniziale del titolo.
--
-- Va abbinato ai destinatari descritti in docs/notifiche-mail.md (Amministratore + Richiedente per «Nuova chiamata»;
-- Amministratore + Tecnico assegnato + Richiedente per Aggiornamento, Risolta, Chiusura).
--
-- ATTENZIONE
--  * I testi 'Nuova chiamata', 'Aggiornamento di una chiamata', 'Chiamata risolta', 'Chiusura della chiamata' sono
--    quelli di GLPI in italiano (it_IT): con un'altra lingua controlla gli oggetti reali in glpi_queuednotifications.
--  * Il collegamento delle risposte alle mail (collettore di posta) usa le intestazioni Message-ID/In-Reply-To,
--    non l'oggetto: cambiare l'oggetto non lo rompe.
--  * Modifica solo il database, non il codice di GLPI: ricontrollalo dopo ogni aggiornamento di GLPI.
--  * Usa NOW(): il trigger gira nella connessione di GLPI, che usa lo stesso fuso del PHP.
--
-- Installazione (fai prima un backup del database):
--   sudo mariadb --default-character-set=utf8mb4 glpidb < deploy/glpi/trigger-anti-duplicati.sql
-- Verifica:   sudo mariadb glpidb -e "SHOW TRIGGERS LIKE 'glpi_queuednotifications'"
-- Rimozione:  sudo mariadb glpidb -e "DROP TRIGGER IF EXISTS portale_no_update_alla_creazione"

SET NAMES utf8mb4;
DROP TRIGGER IF EXISTS portale_no_update_alla_creazione;
DELIMITER $$
CREATE TRIGGER portale_no_update_alla_creazione BEFORE INSERT ON glpi_queuednotifications FOR EACH ROW
BEGIN
  DECLARE v_stato VARCHAR(20) DEFAULT NULL;
  DECLARE v_titolo VARCHAR(255) DEFAULT NULL;
  IF NEW.itemtype = 'Ticket' THEN
    -- 1) niente «Aggiornamento» nei primi 20 secondi di vita del ticket
    IF NEW.name LIKE '%Aggiornamento di una chiamata%' THEN
      IF (SELECT TIMESTAMPDIFF(SECOND, t.date, NOW()) FROM glpi_tickets t WHERE t.id = NEW.items_id) BETWEEN -5 AND 20 THEN
        SET NEW.is_deleted = 1;
      END IF;
    END IF;
    -- 2) casella condivisa (admin_email) solo se nessun tecnico e' assegnato (tranne la «Nuova chiamata»)
    IF NEW.name NOT LIKE '%Nuova chiamata%'
       AND NEW.recipient = (SELECT value FROM glpi_configs WHERE context = 'core' AND name = 'admin_email')
       AND EXISTS (SELECT 1 FROM glpi_tickets_users tu WHERE tu.tickets_id = NEW.items_id AND tu.type = 2) THEN
      SET NEW.is_deleted = 1;
    END IF;
    -- 2b) niente mail «Chiusura» quando il ticket e' chiuso dalla chiusura automatica di GLPI (azione automatica
    --     closeticket): nella cronologia la chiusura risulta fatta da "cron_closeticket". Chiusure manuali (tecnico,
    --     o conferma del richiedente dal portale) restano.
    IF NEW.name LIKE '%Chiusura della chiamata%'
       AND (SELECT l.user_name FROM glpi_logs l
            WHERE l.itemtype = 'Ticket' AND l.items_id = NEW.items_id AND l.id_search_option = 12 AND l.new_value = '6'
            ORDER BY l.id DESC LIMIT 1) LIKE 'cron%' THEN
      SET NEW.is_deleted = 1;
    END IF;
    -- 3) oggetto "Richiesta n. N · Stato · titolo senza [categoria]"
    SET v_stato = CASE
      WHEN NEW.name LIKE '%Nuova chiamata%' THEN 'Nuova'
      WHEN NEW.name LIKE '%Chiamata risolta%' THEN 'Risolta'
      WHEN NEW.name LIKE '%Chiusura della chiamata%' THEN 'Chiusa'
      WHEN NEW.name LIKE '%Aggiornamento di una chiamata%' THEN 'Aggiornamento'
      ELSE NULL END;
    IF v_stato IS NOT NULL THEN
      SET v_titolo = (SELECT REGEXP_REPLACE(t.name, '^\\[[^]]*\\][[:space:]]*', '') FROM glpi_tickets t WHERE t.id = NEW.items_id);
      IF v_titolo IS NOT NULL THEN
        SET NEW.name = LEFT(CONCAT('Richiesta n. ', NEW.items_id, ' · ', v_stato, ' · ', v_titolo), 255);
      END IF;
    END IF;
  END IF;
END$$
DELIMITER ;
