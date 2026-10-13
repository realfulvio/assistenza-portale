-- FACOLTATIVO - Scarta le mail «Aggiornamento di una chiamata» generate nei primi secondi di vita di un ticket.
--
-- Perche': quando il portale crea un ticket, GLPI lo assegna subito al gruppo tecnico (regola o GLPI_GROUP_ID)
-- e genera, oltre alla mail «Nuova chiamata», anche una mail «Aggiornamento». Questo trigger lascia solo la prima.
-- Gli aggiornamenti veri (fatti dai tecnici dopo la soglia) partono normalmente.
--
-- ATTENZIONE
--  * Il testo 'Aggiornamento di una chiamata' e' quello di GLPI in italiano (lingua it_IT): con un'altra lingua
--    controlla l'oggetto reale in glpi_queuednotifications e adatta la condizione LIKE.
--  * La soglia (20 secondi) si cambia nella riga BETWEEN.
--  * Il confronto usa NOW(): il trigger gira nella connessione di GLPI, che imposta il fuso del database uguale
--    a quello del PHP, quindi glpi_tickets.date e NOW() sono nello stesso fuso. Verifica comunque con un ticket
--    di prova (deve arrivare una sola mail «Nuova chiamata»).
--  * E' una modifica al solo database, non al codice di GLPI. Ricontrollala dopo ogni aggiornamento di GLPI.
--
-- Installazione (fai prima un backup del database):
--   sudo mariadb glpidb < deploy/glpi/trigger-anti-duplicati.sql
-- Verifica:
--   sudo mariadb glpidb -e "SHOW TRIGGERS LIKE 'glpi_queuednotifications'"
-- Rimozione:
--   sudo mariadb glpidb -e "DROP TRIGGER IF EXISTS portale_no_update_alla_creazione"

DROP TRIGGER IF EXISTS portale_no_update_alla_creazione;
DELIMITER $$
CREATE TRIGGER portale_no_update_alla_creazione BEFORE INSERT ON glpi_queuednotifications FOR EACH ROW
BEGIN
  IF NEW.itemtype = 'Ticket' AND NEW.name LIKE '%Aggiornamento di una chiamata%' THEN
    IF (SELECT TIMESTAMPDIFF(SECOND, t.date, NOW()) FROM glpi_tickets t WHERE t.id = NEW.items_id) BETWEEN -5 AND 20 THEN
      SET NEW.is_deleted = 1;
    END IF;
  END IF;
END$$
DELIMITER ;
