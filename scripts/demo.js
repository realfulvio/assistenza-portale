// Avvio in modalita' DEMO: GLPI finto in memoria e accesso simulato (nessun account necessario).
// Uso: npm run demo   poi apri http://127.0.0.1:3000/assistenza/
process.env.DEMO = '1';
require('../src/server').avvia();
