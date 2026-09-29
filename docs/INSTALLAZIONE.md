# Installazione e operatività

## Requisiti

- PHP 8.2 o successivo; sviluppo e collaudo locale con PHP 8.4.11.
- PDO + `pdo_mysql` per MySQL, oppure `pdo_sqlite` per la demo rapida.
- `mbstring`, `fileinfo`, `gd` con supporto WebP, `zip`.
- MySQL 8+ con InnoDB e utf8mb4. Il percorso PDO MySQL è stato collaudato localmente su MariaDB 13.0.2; non equivale a un test su ogni versione del server MySQL.
- HTTPS per qualsiasi installazione pubblica; filesystem scrivibile in `storage/` dal processo PHP.

## Installazione senza dati demo

1. Crea un database dedicato vuoto. Non usare il database di un’altra applicazione.
2. Copia `config.example.php` in `config.php` e configura i parametri. Mantieni `APP_ENV=production`.
3. Imposta `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` nell’ambiente del comando. Usa almeno 12 caratteri per la password. Evita di scrivere credenziali nella cronologia del terminale: usa l’ambiente del processo o un input riservato del tuo sistema di distribuzione.
4. Esegui `php bin/setup.php`. Il programma rifiuta una seconda installazione o un database già popolato.
5. Configura il server web con **document root sulla cartella `public/`**. `app/`, `config.php`, `database/`, `bin/` e `storage/` devono restare fuori dalla radice pubblica.
6. Imposta `upload_max_filesize=6M` e `post_max_size=7M` in PHP; il limite applicativo del singolo file è 5 MB.
7. Apri `/app.php`, accedi con l’amministratore, crea clienti e accessi, poi una commessa.

`storage/accesso.txt` viene generato durante l’installazione: custodiscilo privatamente. Può essere rimosso dal server dopo aver conservato le credenziali. Non caricare database, backup o configurazione su GitHub.

## Server di sviluppo

```sh
sh bin/serve.sh
```

Ascolta soltanto su 127.0.0.1. Non utilizzare il server PHP integrato per traffico pubblico.

## Apache / Nginx

Su Apache configura il VirtualHost con `DocumentRoot /percorso/punto/public`. La configurazione distribuita in `public/.htaccess` disabilita il listing e nega l’accesso ai dotfile. Su Nginx usa `root /percorso/punto/public`, inoltra i soli file PHP esistenti a PHP-FPM e nega i dotfile. Le pagine sono `index.php`, `app.php`, `api.php`: non serve un rewrite applicativo.

Su hosting che non consentono una document root separata, configura una separazione equivalente lato server prima di usare dati reali. Non basta caricare tutte le cartelle nella directory pubblica. **GitHub Pages non supporta questo backend.**

## HTTPS e reverse proxy

La sessione imposta il cookie Secure quando PHP riceve HTTPS. `TRUST_HTTPS_PROXY=true` forza Secure per un terminatore TLS controllato: va usato solo se gli accessi HTTP sono bloccati o reindirizzati dal proxy e il backend non è raggiungibile direttamente. Non viene accettato ciecamente un header `X-Forwarded-Proto` inviato dal client.

## Backup e ripristino

```sh
php bin/backup.php
```

Produce uno ZIP privato in `storage/backups/`, con snapshot delle tabelle e allegati. L’archivio contiene email, hash delle password e file dei clienti: conservarlo in storage privato, idealmente cifrato dall’infrastruttura. La configurazione e i parametri del database non sono inclusi.

Per ripristinare, prepara un’installazione separata con un **database completamente vuoto**, configura `config.php` ed esegui:

```sh
php bin/restore.php /percorso/backup.zip --empty-database
```

Il comando non sovrascrive un’installazione esistente. Ripristina esclusivamente backup fidati creati da Punto. Dopo il ripristino verifica login, numero di commesse e download dei file prima di sostituire un’istanza. Usa il backup a carico sospeso per una procedura operativa prevedibile.

## Prima di un uso commerciale

Questa release è un progetto di portfolio funzionante, non un servizio gestito con SLA. Per l’uso con clienti reali vanno definiti hosting, dominio, backup periodici con prove di ripristino, monitoraggio, retention dei dati, scansione degli allegati e procedure di recupero degli accessi. Nessuno di questi servizi è attivato dalla pubblicazione su GitHub.
