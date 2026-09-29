<?php
declare(strict_types=1);
namespace Punto;
use RuntimeException;
require __DIR__ . '/_private/app/bootstrap.php';
start_session();
header('Referrer-Policy: no-referrer');
header('X-Robots-Tag: noindex, nofollow');
$hash = (string) config('INSTALL_TOKEN_HASH', '');
if (is_file(ROOT . '/storage/installed') || strlen($hash) !== 64 || time() > (int) config('INSTALL_EXPIRES', 0)) {
  http_response_code(404);
  exit('Installazione non disponibile.');
}
$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  try {
    if (!hash_equals($_SESSION['csrf'], (string) ($_POST['csrf'] ?? '')) ||
        !hash_equals($hash, hash('sha256', (string) ($_POST['token'] ?? '')))) {
      throw new RuntimeException('Codice non valido oppure sessione scaduta.');
    }
    $mail = email($_POST['email'] ?? '');
    $name = text($_POST['name'] ?? '', 100, true);
    $password = (string) ($_POST['password'] ?? '');
    if (strlen($password) < 12 || strlen($password) > 72) {
      throw new RuntimeException('Scegli una password da 12 a 72 caratteri.');
    }
    foreach ([str_starts_with((string) config('DB_DSN'), 'mysql:') ? 'pdo_mysql' : 'pdo_sqlite', 'mbstring', 'fileinfo', 'gd'] as $extension) {
      if (!extension_loaded($extension)) throw new RuntimeException('Manca un requisito PHP: ' . $extension);
    }
    if (table_prefix() === '') throw new RuntimeException('Imposta un prefisso dedicato al progetto.');
    $lock = fopen(ROOT . '/storage/setup.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) throw new RuntimeException('Installazione già in corso.');
    try {
      if (is_file(ROOT . '/storage/installed')) throw new RuntimeException('Punto è già installato.');
      if (!is_writable(ROOT . '/storage')) throw new RuntimeException('Storage non scrivibile.');
      create_schema();
      transaction(function () use ($mail, $name, $password) {
        query('INSERT INTO {{schema_migrations}}(version,applied_at) VALUES(1,?)', [now()]);
        insert('users', ['name' => $name, 'email' => $mail,
          'password_hash' => password_hash($password, PASSWORD_DEFAULT), 'role' => 'admin',
          'active' => 1, 'demo_role' => null, 'created_at' => now()]);
      });
      if (file_put_contents(ROOT . '/storage/installed', now(), LOCK_EX) === false) {
        throw new RuntimeException('Impossibile bloccare l’installazione.');
      }
      chmod(ROOT . '/storage/installed', 0600);
    } finally { flock($lock, LOCK_UN); fclose($lock); }
    session_regenerate_id(true);
    header('Location: app.php', true, 303);
    exit;
  } catch (\PDOException $e) {
    error_log('Punto setup database: ' . $e->getMessage());
    $error = 'Connessione o inizializzazione del database non riuscita. Verifica la configurazione.';
  } catch (ApiError|RuntimeException $e) {
    $error = $e->getMessage();
  } catch (\Throwable $e) {
    error_log('Punto setup: ' . $e->getMessage());
    $error = 'Installazione interrotta. Controlla configurazione e registro errori prima di riprovare.';
  }
}
function escape_install(string $v): string { return htmlspecialchars($v, ENT_QUOTES, 'UTF-8'); }
?>
<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Attiva il tuo workspace · Punto</title><style>
*{box-sizing:border-box}body{margin:0;background:#f2f3ec;color:#183c36;font:16px system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;padding:28px}main{width:100%;max-width:520px;background:#fff;padding:40px;border:1px solid #dfe5db;border-radius:24px}h1{font-size:32px;letter-spacing:-1px}p{line-height:1.6;color:#5c6a63}.brand{font-weight:800;font-size:24px}label{display:block;margin:18px 0 6px;font-size:14px;font-weight:600}input{width:100%;padding:13px;border:1px solid #a9b6af;border-radius:9px;font:inherit}button{margin-top:25px;padding:15px;width:100%;background:#234e40;color:white;border:0;border-radius:10px;font:inherit;cursor:pointer}.error{padding:12px;background:#fff0eb;color:#803324;border-radius:10px}small{display:block;margin-top:24px;color:#63756b;line-height:1.6}
</style></head><body><main><div class="brand">Punto.</div><h1>Il tuo spazio di lavoro.</h1><p>Crea il tuo accesso amministratore. L’attivazione aggiunge soltanto le tabelle dedicate a Punto.</p>
<?php if ($error): ?><p class="error" role="alert"><?= escape_install($error) ?></p><?php endif ?>
<form method="post" autocomplete="off"><input type="hidden" name="csrf" value="<?= escape_install($_SESSION['csrf']) ?>">
<label for="token">Codice privato di attivazione</label><input id="token" name="token" type="password" required autocomplete="off">
<label for="name">Il tuo nome</label><input id="name" name="name" required maxlength="100" value="Flavio Petrone" autocomplete="name">
<label for="email">Email per accedere</label><input id="email" name="email" type="email" required maxlength="254" autocomplete="username">
<label for="password">Password del workspace</label><input id="password" name="password" type="password" required minlength="12" maxlength="72" autocomplete="new-password">
<button type="submit">Attiva Punto</button></form><small>Usa una password nuova di almeno 12 caratteri. Dopo l’attivazione questa pagina viene disabilitata.</small></main></body></html>
