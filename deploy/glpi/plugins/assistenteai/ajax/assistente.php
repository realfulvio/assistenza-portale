<?php

/**
 * Endpoint AJAX dell'assistente.
 *
 * GLPI 11 avvia da solo il kernel, controlla che l'utente sia autenticato e verifica
 * il token CSRF nell'intestazione X-Glpi-Csrf-Token delle richieste POST AJAX.
 */

require_once dirname(__DIR__) . '/src/Assistente.php';

use Glpi\Exception\Http\BadRequestHttpException;
use GlpiPlugin\Assistenteai\Assistente;

Session::checkCentralAccess();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    throw new BadRequestHttpException();
}

$azione  = (string) ($_POST['azione'] ?? '');
$variante = in_array($_POST['variante'] ?? '', ['breve', 'formale'], true) ? $_POST['variante'] : 'normale';
$ticket  = Assistente::ticket((int) ($_POST['tickets_id'] ?? 0));

// Permessi e dati di sessione sono gia letti: liberiamo la sessione,
// cosi le altre pagine di GLPI non restano bloccate mentre il modello lavora.
session_write_close();
@set_time_limit(max(60, (int) Assistente::config()['timeout'] + 30));

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

try {
    $esito = match ($azione) {
        'riassunto' => Assistente::riassunto($ticket),
        'bozza'     => Assistente::bozza($ticket, $variante),
        'categoria' => Assistente::categoria($ticket),
        'simili'    => Assistente::simili($ticket),
        default     => throw new BadRequestHttpException(),
    };
    echo json_encode(['ok' => true, 'azione' => $azione] + $esito, JSON_UNESCAPED_UNICODE);
} catch (BadRequestHttpException $e) {
    throw $e;
} catch (Throwable $e) {
    Toolbox::logInFile('assistenteai', sprintf("%s #%d: %s\n", $azione, $ticket->getID(), $e->getMessage()));
    http_response_code(502);
    $messaggio = $e instanceof RuntimeException ? $e->getMessage() : 'Errore interno dell\'assistente.';
    echo json_encode(['ok' => false, 'errore' => $messaggio], JSON_UNESCAPED_UNICODE);
}
