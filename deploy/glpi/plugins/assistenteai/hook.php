<?php

require_once __DIR__ . '/src/Assistente.php';

use GlpiPlugin\Assistenteai\Assistente;

function plugin_assistenteai_install(): bool
{
    Assistente::preparaCartella();
    return true;
}

function plugin_assistenteai_uninstall(): bool
{
    Config::deleteConfigurationValues('plugin:assistenteai', array_keys(Assistente::PREDEFINITI));
    Assistente::svuotaCache();
    return true;
}

/**
 * Riquadro "Assistente" in fondo al pannello destro della chiamata,
 * dopo "Oggetti assistenza collegati".
 *
 * @param array{item?: CommonDBTM, options?: array} $params
 */
function plugin_assistenteai_post_itil_info_section($params): void
{
    $item = $params['item'] ?? null;
    if (!Assistente::mostraPer($item)) {
        return;
    }

    global $CFG_GLPI;
    $endpoint = $CFG_GLPI['root_doc'] . '/plugins/assistenteai/ajax/assistente.php';

    echo '<section class="accordion-item plugin-assistenteai" id="plugin-assistenteai"'
        . ' data-ticket="' . (int) $item->getID() . '"'
        . ' data-endpoint="' . htmlescape($endpoint) . '"'
        . ' aria-label="Assistente">';
    echo '<div class="accordion-header" id="plugin-assistenteai-heading">'
        . '<button class="accordion-button" type="button" data-bs-toggle="collapse"'
        . ' data-bs-target="#plugin-assistenteai-corpo" aria-expanded="true" aria-controls="plugin-assistenteai-corpo">'
        . '<i class="ti ti-sparkles item-icon"></i>'
        . '<span class="item-title">Assistente</span>'
        . '<span class="badge assistenteai-badge ms-2">locale</span>'
        . '</button></div>';
    echo '<div id="plugin-assistenteai-corpo" class="accordion-collapse collapse show" aria-labelledby="plugin-assistenteai-heading">'
        . '<div class="accordion-body">'
        . '<div class="assistenteai-azioni" role="group" aria-label="Azioni dell\'assistente">'
        . '<button type="button" class="btn btn-sm assistenteai-btn" data-azione="riassunto"><i class="ti ti-list-details me-1"></i>Riassumi</button>'
        . '<button type="button" class="btn btn-sm assistenteai-btn" data-azione="bozza"><i class="ti ti-pencil me-1"></i>Bozza risposta</button>'
        . '<button type="button" class="btn btn-sm assistenteai-btn" data-azione="simili"><i class="ti ti-copy me-1"></i>Simili</button>'
        . '<button type="button" class="btn btn-sm assistenteai-btn" data-azione="categoria"><i class="ti ti-tag me-1"></i>Categoria</button>'
        . '</div>'
        . '<div class="assistenteai-uscita" aria-live="polite"></div>'
        . '<div class="assistenteai-nota"><i class="ti ti-lock me-1"></i>Gira sul server del Comune · legge solo ciò che vedi tu · non salva niente da solo</div>'
        . '</div></div>';
    echo '</section>';
}
