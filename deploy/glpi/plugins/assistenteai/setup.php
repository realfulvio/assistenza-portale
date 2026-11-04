<?php

/**
 * Assistente AI per i tecnici nella scheda chiamata di GLPI.
 *
 * Usa lo stesso Ollama locale del portale assistenza (solo loopback).
 * Legge le chiamate con la sessione del tecnico collegato: vede solo cio che vede lui.
 * Non modifica niente da solo: propone, e il tecnico decide se applicare.
 */

use Glpi\Plugin\Hooks;

define('PLUGIN_ASSISTENTEAI_VERSION', '0.1.0');
// La versione massima e esclusa: con GLPI 11.1 o 12 il plugin si disattiva da solo.
define('PLUGIN_ASSISTENTEAI_MIN_GLPI', '11.0.0');
define('PLUGIN_ASSISTENTEAI_MAX_GLPI', '11.1.0');

function plugin_version_assistenteai(): array
{
    return [
        'name'         => 'Assistente AI',
        'version'      => PLUGIN_ASSISTENTEAI_VERSION,
        'author'       => 'CED Comune di Bondeno',
        'license'      => 'GPLv3+',
        'homepage'     => 'https://github.com/realfulvio/assistenza-portale',
        'requirements' => [
            'glpi' => [
                'min' => PLUGIN_ASSISTENTEAI_MIN_GLPI,
                'max' => PLUGIN_ASSISTENTEAI_MAX_GLPI,
            ],
            'php'  => [
                'exts' => ['curl' => ['required' => true]],
            ],
        ],
    ];
}

function plugin_init_assistenteai(): void
{
    global $PLUGIN_HOOKS;

    $PLUGIN_HOOKS[Hooks::ADD_CSS]['assistenteai']                = ['css/assistente.css'];
    $PLUGIN_HOOKS[Hooks::ADD_JAVASCRIPT]['assistenteai']         = ['js/assistente.js'];
    $PLUGIN_HOOKS[Hooks::POST_ITIL_INFO_SECTION]['assistenteai'] = 'plugin_assistenteai_post_itil_info_section';
}

function plugin_assistenteai_check_prerequisites(): bool
{
    return true;
}

function plugin_assistenteai_check_config($verbose = false): bool
{
    return true;
}
