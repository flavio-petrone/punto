# Verifica della release

Collaudo locale del 29 settembre 2026.

| Ambiente | Risultato |
|---|---|
| PHP 8.4.11 + SQLite, richieste HTTP reali | 91 controlli superati |
| PHP 8.4.11 + MariaDB 13.0.2 tramite PDO MySQL | 91 controlli superati |
| Sintassi PHP e JavaScript | Verificata |

La suite `tests/integration.py` avvia una copia temporanea e sessioni separate. Verifica accesso con password e demo, CSRF, separazione tra ruoli/clienti/commesse, conversione atomica e rifiuto dei duplicati, rollback, date e assegnazioni, conflitti di versione, transizioni degli stati, commenti, tempo e budget, upload, versionamento, download autorizzato, approvazioni e chiusura della commessa. Controlla inoltre export CSV, protezione dei percorsi privati, cambio password, backup/ripristino e disattivazione della demo in produzione.

Il contenuto HTML nei commenti viene conservato come testo dal backend ed escapato nell’interfaccia. La suite non esegue un audit di sicurezza esterno né un test di carico. Verifica un salvataggio con versione obsoleta; non simula ogni possibile interleaving di transazioni distribuite.

MySQL 8 è il target dello schema, ma i risultati locali sopra riportati sono relativi a MariaDB. La configurazione CI include un job separato con MySQL 8; il suo stato va verificato nei risultati di GitHub Actions.

## Percorso manuale ripetibile

1. Entra come Studio e apri Atelier Nove.
2. Crea un’attività e assegnala a Marta Leone.
3. Avviala, poi inviala in revisione.
4. Passa al ruolo Cliente, apri l’attività, commenta e approva.
5. Torna al team, registra tempo e carica un PDF o un’immagine entro i limiti.
6. Come cliente scarica il file e approva oppure richiedi modifiche.
7. Controlla lo storico e i report con il ruolo Studio.

La demo salva le modifiche. Le istanze usate dai test automatici sono separate dalla demo di presentazione.

## Verifica nel browser

Anteprima desktop a 1440 px e controlli responsive a 390 e 320 px, senza overflow orizzontale della pagina. Verificati rendering WebGL, selezione delle fasi e pausa; apertura della demo, creazione attività, invio in revisione, passaggio al ruolo cliente e approvazione. Verificati menu mobile, report e upload di una PNG ricodificata dal server in WebP. Gli screenshot nel repository provengono dal software funzionante.
