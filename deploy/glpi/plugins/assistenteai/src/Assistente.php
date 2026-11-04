<?php

namespace GlpiPlugin\Assistenteai;

use CommonITILActor;
use CommonITILObject;
use CommonITILValidation;
use Config;
use Dropdown;
use Glpi\Exception\Http\AccessDeniedHttpException;
use Glpi\Exception\Http\BadRequestHttpException;
use Glpi\RichText\RichText;
use Html;
use ITILFollowup;
use ITILSolution;
use RuntimeException;
use Session;
use Ticket;
use TicketTask;
use User;

/**
 * Logica dell'assistente: legge la chiamata con i permessi del tecnico collegato,
 * costruisce un contesto corto e chiede a Ollama (locale) riassunto, bozza o categoria.
 * La ricerca dei ticket simili usa solo gli embedding.
 */
final class Assistente
{
    public const PREDEFINITI = [
        'url'        => 'http://127.0.0.1:11435',
        'modello'    => 'qwen3.5:4b-q4_K_M',
        'embedding'  => 'embeddinggemma-2:270m',
        'keep_alive' => '8h',
        'timeout'    => '150',
        'interventi' => '4',
        'num_thread' => '4',
        // embeddinggemma dà ~0,75-0,80 anche a chiamate senza nulla in comune (prova del 04/11 sul ticket 89):
        // sotto 0,82 erano solo falsi positivi. Stessa soglia calibrata per le guide del portale.
        'soglia_simili' => '0.82',
    ];

    private const MAX_DESCRIZIONE = 1500;
    private const MAX_INTERVENTO  = 600;
    private const MAX_CANDIDATI   = 400;
    private const NUOVI_PER_GIRO  = 64;

    /** @return array<string, string> */
    public static function config(): array
    {
        $salvati = Config::getConfigurationValues('plugin:assistenteai');
        $out = self::PREDEFINITI;
        foreach ($salvati as $k => $v) {
            if (array_key_exists($k, $out) && trim((string) $v) !== '') {
                $out[$k] = trim((string) $v);
            }
        }
        return $out;
    }

    public static function mostraPer(mixed $item): bool
    {
        return $item instanceof Ticket
            && !$item->isNewItem()
            && Session::getCurrentInterface() === 'central'
            && $item->canViewItem();
    }

    public static function cartella(): string
    {
        return GLPI_PLUGIN_DOC_DIR . '/assistenteai';
    }

    public static function preparaCartella(): void
    {
        $dir = self::cartella();
        if (!is_dir($dir)) {
            @mkdir($dir, 0o750, true);
        }
    }

    public static function svuotaCache(): void
    {
        $file = self::cartella() . '/embedding-ticket.json';
        if (is_file($file)) {
            @unlink($file);
        }
    }

    /** Carica la chiamata solo se il tecnico collegato la puo vedere. */
    public static function ticket(int $id): Ticket
    {
        $ticket = new Ticket();
        if ($id <= 0 || !$ticket->getFromDB($id)) {
            throw new BadRequestHttpException();
        }
        if (!$ticket->canViewItem()) {
            throw new AccessDeniedHttpException();
        }
        return $ticket;
    }

    // ------------------------------------------------------------------ contesto

    private static function testo(?string $html, int $max): string
    {
        $t = RichText::getTextFromHtml((string) $html, false, false, false, true, true);
        $t = preg_replace("/[ \t]+/u", ' ', $t) ?? $t;
        $t = preg_replace("/\n{3,}/u", "\n\n", $t) ?? $t;
        $t = trim($t);
        if (mb_strlen($t) > $max) {
            $t = rtrim(mb_substr($t, 0, $max)) . '…';
        }
        return $t;
    }

    private static function nome(int $users_id): string
    {
        if ($users_id <= 0) {
            return 'sconosciuto';
        }
        $nome = getUserName($users_id);
        return is_string($nome) && $nome !== '' ? $nome : 'utente ' . $users_id;
    }

    private static function nomeProprio(int $users_id): string
    {
        $u = new User();
        if ($users_id > 0 && $u->getFromDB($users_id)) {
            $n = trim((string) ($u->fields['firstname'] ?? ''));
            if ($n !== '') {
                return $n;
            }
            return trim((string) ($u->fields['name'] ?? ''));
        }
        return '';
    }

    private static function richiedente(Ticket $t): array
    {
        foreach ($t->getUsers(CommonITILActor::REQUESTER) as $riga) {
            $id = (int) ($riga['users_id'] ?? 0);
            if ($id > 0) {
                return ['id' => $id, 'nome' => self::nome($id), 'proprio' => self::nomeProprio($id)];
            }
        }
        return ['id' => 0, 'nome' => 'non indicato', 'proprio' => ''];
    }

    /**
     * Ultimi interventi visibili al tecnico collegato (GLPI applica privati e permessi).
     *
     * @return list<array{data: string, autore: string, tipo: string, testo: string}>
     */
    private static function interventi(Ticket $t, int $quanti, bool $solo_pubblici): array
    {
        $righe = [];
        $timeline = $t->getTimelineItems([
            'with_documents'    => false,
            'with_logs'         => false,
            'with_validations'  => false,
            'sort_by_date_desc' => false,
        ]);
        foreach ($timeline as $voce) {
            $tipo = $voce['type'] ?? '';
            $item = $voce['item'] ?? [];
            $etichetta = match ($tipo) {
                ITILFollowup::class => 'risposta',
                TicketTask::class   => 'attività',
                ITILSolution::class => 'soluzione',
                default             => null,
            };
            if ($etichetta === null) {
                continue;
            }
            if ($tipo === ITILSolution::class) {
                $stato = (int) ($item['status'] ?? 0);
                if ($stato === CommonITILValidation::REFUSED) {
                    $etichetta .= ' rifiutata';
                } elseif ($stato === CommonITILValidation::ACCEPTED) {
                    $etichetta .= ' approvata';
                }
            }
            if (!empty($item['is_private'])) {
                if ($solo_pubblici) {
                    continue;
                }
                $etichetta .= ', privata';
            }
            $testo = self::testo($item['content'] ?? '', self::MAX_INTERVENTO);
            if ($testo === '') {
                continue;
            }
            $righe[] = [
                'data'   => (string) ($item['date'] ?? $item['date_creation'] ?? ''),
                'autore' => self::nome((int) ($item['users_id'] ?? 0)),
                'tipo'   => $etichetta,
                'testo'  => $testo,
            ];
        }
        usort($righe, static fn($a, $b) => strcmp($a['data'], $b['data']));
        return array_slice($righe, -max(1, $quanti));
    }

    /**
     * @param bool $solo_pubblici true per la bozza: le note private non devono finire in una risposta al richiedente.
     */
    private static function contesto(Ticket $t, array $cfg, bool $solo_pubblici = false): string
    {
        $rich = self::richiedente($t);
        $cat  = (int) $t->fields['itilcategories_id'];
        $out  = [];
        $out[] = 'CHIAMATA #' . $t->getID() . ': ' . self::testo($t->fields['name'] ?? '', 200);
        $out[] = 'Stato: ' . Ticket::getStatus((int) $t->fields['status']);
        $out[] = 'Categoria: ' . ($cat > 0 ? Dropdown::getDropdownName('glpi_itilcategories', $cat) : 'nessuna');
        $out[] = 'Richiedente: ' . $rich['nome'];
        $out[] = 'Aperta il: ' . Html::convDateTime($t->fields['date']);
        $out[] = '';
        $out[] = 'DESCRIZIONE:';
        $out[] = self::testo($t->fields['content'] ?? '', self::MAX_DESCRIZIONE) ?: '(vuota)';
        $interventi = self::interventi($t, (int) $cfg['interventi'], $solo_pubblici);
        $out[] = '';
        if ($interventi === []) {
            $out[] = 'INTERVENTI: nessuno.';
        } else {
            $out[] = 'ULTIMI INTERVENTI (dal più vecchio al più recente):';
            foreach ($interventi as $i) {
                $out[] = '- ' . Html::convDateTime($i['data']) . ' · ' . $i['autore'] . ' (' . $i['tipo'] . '): ' . $i['testo'];
            }
        }
        return implode("\n", $out);
    }

    // ------------------------------------------------------------------ ollama

    private static function chiama(string $percorso, array $corpo, array $cfg): array
    {
        $ch = curl_init(rtrim($cfg['url'], '/') . $percorso);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($corpo, JSON_UNESCAPED_UNICODE),
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT        => max(10, (int) $cfg['timeout']),
            CURLOPT_PROXY          => '',
        ]);
        $risposta = curl_exec($ch);
        $codice   = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $errore   = curl_error($ch);
        curl_close($ch);

        if ($risposta === false) {
            throw new RuntimeException('L\'assistente non risponde (' . $errore . ').');
        }
        $json = json_decode((string) $risposta, true);
        if ($codice !== 200 || !is_array($json)) {
            $dettaglio = is_array($json) && isset($json['error']) ? (string) $json['error'] : 'HTTP ' . $codice;
            throw new RuntimeException('L\'assistente ha dato un errore (' . $dettaglio . ').');
        }
        return $json;
    }

    private static function chat(string $system, string $utente, int $num_predict, array $cfg, ?array $formato = null): string
    {
        $corpo = [
            'model'      => $cfg['modello'],
            'messages'   => [
                ['role' => 'system', 'content' => $system],
                ['role' => 'user', 'content' => $utente],
            ],
            'stream'     => false,
            'think'      => false,
            'keep_alive' => $cfg['keep_alive'],
            'options'    => [
                'temperature'      => 0.1,
                'presence_penalty' => 0,
                'num_ctx'          => 4096,
                'num_predict'      => $num_predict,
                'num_thread'       => (int) $cfg['num_thread'],
            ],
        ];
        if ($formato !== null) {
            $corpo['format'] = $formato;
        }
        $json = self::chiama('/api/chat', $corpo, $cfg);
        $testo = (string) ($json['message']['content'] ?? '');
        $testo = preg_replace('#<think>.*?</think>#su', '', $testo) ?? $testo;
        $testo = trim($testo);
        if ($testo === '') {
            throw new RuntimeException('L\'assistente ha dato una risposta vuota.');
        }
        return $testo;
    }

    /** @return list<list<float>> */
    private static function embed(array $testi, array $cfg): array
    {
        if ($testi === []) {
            return [];
        }
        $json = self::chiama('/api/embed', [
            'model'      => $cfg['embedding'],
            'input'      => array_values($testi),
            'truncate'   => true,
            'keep_alive' => $cfg['keep_alive'],
            'options'    => ['num_ctx' => 2048, 'num_thread' => (int) $cfg['num_thread']],
        ], $cfg);
        $vettori = $json['embeddings'] ?? null;
        if (!is_array($vettori) || count($vettori) !== count($testi)) {
            throw new RuntimeException('L\'indice dei ticket simili non è disponibile.');
        }
        return $vettori;
    }

    // ------------------------------------------------------------------ azioni

    public static function riassunto(Ticket $t): array
    {
        $cfg = self::config();
        $system = <<<TXT
Sei l'assistente dei tecnici del CED del Comune di Bondeno. Ricevi una chiamata di assistenza con la descrizione e gli ultimi interventi.
Scrivi un riassunto per il tecnico, in italiano, usando solo fatti presenti nel testo. Non inventare cause, interventi, nomi o date.
Rispondi con esattamente quattro righe, senza elenchi puntati, senza grassetto e senza altro testo, in questo formato:
Richiesta: cosa chiede il richiedente o quale problema ha
Fatto finora: gli interventi già fatti dal CED, oppure "nessun intervento registrato"
Ultimo aggiornamento: l'ultima novità, con chi l'ha scritta
Da fare: il prossimo passo sensato per il tecnico; se manca un'informazione, quale chiedere
Ogni riga al massimo 30 parole.
TXT;
        $uscita = self::chat($system, self::contesto($t, $cfg), 260, $cfg);

        $etichette = ['Richiesta', 'Fatto finora', 'Ultimo aggiornamento', 'Da fare'];
        $righe = [];
        foreach (preg_split("/\r?\n/u", $uscita) as $riga) {
            $riga = trim(preg_replace('/^[\-\*\d\.\)\s]+|\*\*/u', '', $riga) ?? $riga);
            if ($riga === '') {
                continue;
            }
            foreach ($etichette as $e) {
                if (mb_stripos($riga, $e . ':') === 0) {
                    $righe[] = ['etichetta' => $e, 'testo' => trim(mb_substr($riga, mb_strlen($e) + 1))];
                    continue 2;
                }
            }
            if ($righe !== []) {
                $righe[count($righe) - 1]['testo'] .= ' ' . $riga;
            }
        }
        if ($righe === []) {
            $righe[] = ['etichetta' => 'Riassunto', 'testo' => $uscita];
        }
        return ['righe' => $righe];
    }

    public static function bozza(Ticket $t, string $variante): array
    {
        $cfg = self::config();
        $rich = self::richiedente($t);
        $tecnico = self::nomeProprio((int) Session::getLoginUserID()) ?: 'Il CED';
        $firma = $tecnico . ' – CED';
        $chi = $rich['proprio'] !== '' ? $rich['proprio'] : 'collega';

        $stile = match ($variante) {
            'breve'   => "- massimo 45 parole;\n- dai del tu, tono cordiale;\n- comincia con \"Ciao {$chi},\"",
            'formale' => "- massimo 90 parole;\n- dai del Lei, tono cortese e istituzionale;\n- comincia con \"Gentile {$chi},\"",
            default   => "- massimo 90 parole;\n- dai del tu, italiano semplice e cordiale;\n- comincia con \"Ciao {$chi},\"",
        };
        $system = <<<TXT
Sei l'assistente dei tecnici del CED del Comune di Bondeno. Scrivi la bozza della prossima risposta del tecnico al richiedente, che è un collega del Comune e non un tecnico.
Regole:
{$stile};
- rispondi all'ultimo intervento della chiamata; se non ci sono interventi, rispondi alla descrizione;
- se ti servono informazioni, fai al massimo 2 domande precise;
- non inventare interventi già fatti, diagnosi, tempi o scadenze; non promettere niente che non sia nel testo;
- non chiedere mai password, codici o dati personali;
- chiudi con una riga vuota e poi la firma esatta: {$firma}
- scrivi solo il testo della risposta, senza titolo, senza oggetto e senza commenti.
TXT;
        $uscita = self::chat($system, self::contesto($t, $cfg, true), 300, $cfg);
        $uscita = preg_replace('/^(oggetto|bozza)\s*:.*\n+/iu', '', $uscita) ?? $uscita;
        if (!str_contains($uscita, $firma)) {
            $uscita = rtrim($uscita) . "\n\n" . $firma;
        }

        $html = '';
        foreach (preg_split("/\n\s*\n/u", trim($uscita)) as $paragrafo) {
            $html .= '<p>' . nl2br(htmlspecialchars(trim($paragrafo), ENT_QUOTES, 'UTF-8'), false) . '</p>';
        }
        return ['testo' => $uscita, 'html' => $html, 'variante' => $variante];
    }

    public static function categoria(Ticket $t): array
    {
        global $DB;
        $cfg = self::config();

        $where = getEntitiesRestrictCriteria('glpi_itilcategories', '', (int) $t->fields['entities_id'], true);
        $tipo = (int) $t->fields['type'] === Ticket::DEMAND_TYPE ? 'is_request' : 'is_incident';
        $categorie = [];
        foreach ($DB->request([
            'SELECT' => ['id', 'completename'],
            'FROM'   => 'glpi_itilcategories',
            'WHERE'  => $where + [$tipo => 1],
            'ORDER'  => 'completename',
            'LIMIT'  => 120,
        ]) as $riga) {
            $categorie[(int) $riga['id']] = (string) $riga['completename'];
        }
        if ($categorie === []) {
            throw new RuntimeException('Non ci sono categorie disponibili per questa chiamata.');
        }

        $elenco = [];
        foreach ($categorie as $id => $nome) {
            $elenco[] = $id . ' | ' . $nome;
        }
        $system = <<<TXT
Sei l'assistente dei tecnici del CED del Comune di Bondeno. Classifica la chiamata.
Scegli la categoria più adatta SOLO tra quelle dell'elenco, indicando il suo numero id.
Scegli l'urgenza da 1 a 5: 1 molto bassa, 2 bassa, 3 media, 4 alta (un ufficio non riesce a lavorare), 5 molto alta (servizio al pubblico fermo o rischio per la sicurezza). Nel dubbio usa 3.
Scrivi il motivo in una frase di massimo 20 parole, in italiano.
TXT;
        $utente = "CATEGORIE (id | nome):\n" . implode("\n", $elenco) . "\n\n" . self::contesto($t, $cfg);
        $formato = [
            'type'       => 'object',
            'properties' => [
                'categoria_id' => ['type' => 'integer'],
                'urgenza'      => ['type' => 'integer', 'minimum' => 1, 'maximum' => 5],
                'motivo'       => ['type' => 'string'],
            ],
            'required'   => ['categoria_id', 'urgenza', 'motivo'],
        ];
        $json = json_decode(self::chat($system, $utente, 120, $cfg, $formato), true);
        $id = (int) ($json['categoria_id'] ?? 0);
        if (!is_array($json) || !isset($categorie[$id])) {
            throw new RuntimeException('L\'assistente non ha indicato una categoria valida. Riprova.');
        }
        $urgenza = min(5, max(1, (int) ($json['urgenza'] ?? 3)));
        $attuale = (int) $t->fields['itilcategories_id'];

        return [
            'categoria' => ['id' => $id, 'nome' => $categorie[$id]],
            'attuale'   => ['id' => $attuale, 'nome' => $attuale > 0 ? Dropdown::getDropdownName('glpi_itilcategories', $attuale) : ''],
            'urgenza'   => ['valore' => $urgenza, 'nome' => Ticket::getUrgencyName($urgenza)],
            'urgenza_attuale' => (int) $t->fields['urgency'],
            'motivo'    => mb_substr(trim((string) ($json['motivo'] ?? '')), 0, 200),
        ];
    }

    public static function simili(Ticket $t): array
    {
        global $DB;
        $cfg = self::config();
        self::preparaCartella();
        $file = self::cartella() . '/embedding-ticket.json';

        $cache = is_file($file) ? json_decode((string) file_get_contents($file), true) : null;
        if (!is_array($cache) || ($cache['modello'] ?? '') !== $cfg['embedding']) {
            $cache = ['modello' => $cfg['embedding'], 'voci' => []];
        }

        // Candidati: chiamate risolte o chiuse nelle entità attive del tecnico.
        $candidati = [];
        foreach ($DB->request([
            'SELECT' => ['id', 'name', 'content'],
            'FROM'   => 'glpi_tickets',
            'WHERE'  => [
                'is_deleted' => 0,
                'status'     => [CommonITILObject::SOLVED, CommonITILObject::CLOSED],
                'NOT'        => ['id' => $t->getID()],
            ] + getEntitiesRestrictCriteria('glpi_tickets'),
            'ORDER'  => 'date_mod DESC',
            'LIMIT'  => self::MAX_CANDIDATI,
        ]) as $riga) {
            $testo = self::testo($riga['name'], 200) . "\n" . self::testo($riga['content'], 800);
            $candidati[(int) $riga['id']] = ['testo' => $testo, 'h' => substr(hash('sha256', $testo), 0, 16)];
        }

        $mancanti = [];
        foreach ($candidati as $id => $c) {
            if (($cache['voci'][$id]['h'] ?? null) !== $c['h']) {
                $mancanti[$id] = $c;
            }
        }
        $da_fare = array_slice($mancanti, 0, self::NUOVI_PER_GIRO, true);
        foreach (array_chunk($da_fare, 16, true) as $blocco) {
            $vettori = self::embed(array_column($blocco, 'testo'), $cfg);
            $i = 0;
            foreach ($blocco as $id => $c) {
                $cache['voci'][$id] = ['h' => $c['h'], 'v' => array_map(static fn($x) => round((float) $x, 5), $vettori[$i++])];
            }
        }
        if ($da_fare !== []) {
            $cache['voci'] = array_intersect_key($cache['voci'], $candidati);
            $tmp = $file . '.' . getmypid() . '.tmp';
            file_put_contents($tmp, json_encode($cache));
            @rename($tmp, $file);
        }

        $query = self::embed([self::testo($t->fields['name'] ?? '', 200) . "\n" . self::testo($t->fields['content'] ?? '', 800)], $cfg)[0];
        $punteggi = [];
        foreach ($cache['voci'] as $id => $voce) {
            if (isset($candidati[$id])) {
                $punteggi[(int) $id] = self::coseno($query, $voce['v']);
            }
        }
        arsort($punteggi);

        $soglia = (float) $cfg['soglia_simili'];
        $risultati = [];
        foreach ($punteggi as $id => $s) {
            if ($s < $soglia || count($risultati) >= 3) {
                break;
            }
            $altro = new Ticket();
            if (!$altro->getFromDB($id) || !$altro->canViewItem()) {
                continue;
            }
            $risultati[] = [
                'id'        => $id,
                'titolo'    => self::testo($altro->fields['name'], 120),
                'punteggio' => round($s, 2),
                'soluzione' => self::ultimaSoluzione($id),
                'url'       => Ticket::getFormURLWithID($id),
            ];
        }

        return [
            'simili'     => $risultati,
            'da_indicizzare' => max(0, count($mancanti) - count($da_fare)),
        ];
    }

    private static function ultimaSoluzione(int $tickets_id): string
    {
        $s = new ITILSolution();
        $righe = $s->find(['itemtype' => Ticket::class, 'items_id' => $tickets_id], ['date_creation DESC'], 1);
        $riga = reset($righe);
        return $riga ? self::testo($riga['content'] ?? '', 180) : '';
    }

    private static function coseno(array $a, array $b): float
    {
        $n = min(count($a), count($b));
        $ab = $aa = $bb = 0.0;
        for ($i = 0; $i < $n; $i++) {
            $ab += $a[$i] * $b[$i];
            $aa += $a[$i] * $a[$i];
            $bb += $b[$i] * $b[$i];
        }
        return $ab / max(1e-12, sqrt($aa * $bb));
    }
}
