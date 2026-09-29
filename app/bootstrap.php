<?php
declare(strict_types=1);
namespace Punto;

use PDO;
use RuntimeException;
use Throwable;

const ROOT = __DIR__ . '/..';
const STATUSES = ['todo', 'doing', 'review', 'done'];
function config(string $key, mixed $default = null): mixed
{
  static $settings;
  $settings ??= is_file(ROOT . '/config.php') ? require ROOT . '/config.php' : [];
  $env = getenv($key);
  return $env !== false ? $env : $settings[$key] ?? $default;
}
function db(): PDO
{
  static $pdo;
  if (!$pdo) {
    $pdo = new PDO(
      config('DB_DSN', 'sqlite:' . ROOT . '/storage/punto.sqlite'),
      (string) config('DB_USER', ''),
      (string) config('DB_PASSWORD', ''),
      [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
      ],
    );
    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
      $pdo->exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000');
    }
  }
  return $pdo;
}
const TABLES = ['schema_migrations', 'clients', 'users', 'projects', 'project_members',
  'requests', 'tasks', 'comments', 'time_entries', 'deliverables', 'events', 'login_attempts'];
function table_prefix(): string
{
  $prefix = (string) config('DB_TABLE_PREFIX', '');
  if ($prefix !== '' && !preg_match('/^[a-z][a-z0-9_]{0,23}_$/D', $prefix)) {
    throw new RuntimeException('Prefisso database non valido.');
  }
  return $prefix;
}
function table_name(string $name): string
{
  if (!in_array($name, TABLES, true)) {
    throw new RuntimeException('Tabella non riconosciuta.');
  }
  return '`' . table_prefix() . $name . '`';
}
function sql_identifiers(string $sql): string
{
  // Only explicit identifiers in developer-written SQL are expanded. Values remain PDO parameters.
  return preg_replace_callback('/\{\{([a-z_]+)\}\}/', fn($m) => table_name($m[1]), $sql);
}
function assert_empty_installation(): void
{
  $prefix = table_prefix();
  $tables = db()->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite'
    ? all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    : all('SHOW TABLES');
  foreach ($tables as $record) {
    if ($prefix === '' || str_starts_with((string) array_values($record)[0], $prefix)) {
      throw new RuntimeException('Installazione già presente o prefisso occupato. Nessuna tabella modificata.');
    }
  }
}
function create_schema(): void
{
  assert_empty_installation();
  $mysql = db()->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
  // schema.sql also remains valid standalone SQL for a dedicated, empty database.
  $schema = file_get_contents(ROOT . '/database/schema.sql');
  $schema = preg_replace_callback('/\b(CREATE TABLE|REFERENCES|ON) ([a-z_]+)\b/',
    fn($m) => $m[1] . ' ' . table_name($m[2]), $schema);
  $schema = preg_replace_callback('/\bCREATE INDEX ([a-z_]+)\b/',
    fn($m) => 'CREATE INDEX `' . table_prefix() . $m[1] . '`', $schema);
  foreach (explode(';', $schema) as $statement) {
    $statement = trim($statement);
    if ($statement === '') continue;
    if ($mysql && str_starts_with($statement, 'CREATE TABLE')) {
      $statement .= ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    }
    db()->exec($statement);
  }
}
function query(string $sql, array $params = []): \PDOStatement
{
  $s = db()->prepare(sql_identifiers($sql));
  $s->execute($params);
  return $s;
}
function all(string $sql, array $params = []): array
{
  return query($sql, $params)->fetchAll();
}
function row(string $sql, array $params = []): ?array
{
  return query($sql, $params)->fetch() ?: null;
}
function id(): string
{
  return bin2hex(random_bytes(12));
}
function now(): string
{
  return gmdate('Y-m-d H:i:s');
}
function insert(string $table, array $data): array
{
  $data = ['id' => id()] + $data;
  $cols = array_keys($data);
  query(
    'INSERT INTO ' .
      table_name($table) .
      ' (' .
      implode(',', $cols) .
      ') VALUES (' .
      implode(',', array_fill(0, count($cols), '?')) .
      ')',
    array_values($data),
  );
  return $data;
}
final class ApiError extends RuntimeException
{
  public function __construct(string $message, public int $status = 422)
  {
    parent::__construct($message);
  }
}
function reject(string $message, int $status = 422): never
{
  throw new ApiError($message, $status);
}
function transaction(callable $fn): mixed
{
  db()->beginTransaction();
  try {
    $r = $fn();
    db()->commit();
    return $r;
  } catch (Throwable $e) {
    if (db()->inTransaction()) {
      db()->rollBack();
    }
    throw $e;
  }
}
function text(mixed $value, int $max = 2000, bool $required = false): string
{
  if (!is_string($value) && !is_numeric($value) && $value !== null) {
    reject('Formato del campo non valido.');
  }
  $v = trim((string) $value);
  if (mb_strlen($v) > $max) {
    reject("Il testo supera il limite di $max caratteri.");
  }
  if ($required && $v === '') {
    reject('Completa i campi obbligatori.');
  }
  return $v;
}
function email(mixed $v): string
{
  $v = mb_strtolower(text($v, 254, true));
  if (!filter_var($v, FILTER_VALIDATE_EMAIL)) {
    reject('Inserisci un indirizzo email valido.');
  }
  return $v;
}
function integer(mixed $v, int $min = 0, int $max = 1000000): int
{
  if (filter_var($v, FILTER_VALIDATE_INT) === false || (int) $v < $min || (int) $v > $max) {
    reject('Valore numerico non valido.');
  }
  return (int) $v;
}
function choice(mixed $v, array $list): string
{
  if (!is_string($v) || !in_array($v, $list, true)) {
    reject('Scelta non valida.');
  }
  return $v;
}
function day(mixed $v, bool $required = false): ?string
{
  if ($v === '' || $v === null) {
    if ($required) {
      reject('Indica una data.');
    }
    return null;
  }
  if (!is_string($v) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) {
    reject('Data non valida.');
  }
  [$y, $m, $d] = array_map('intval', explode('-', $v));
  if (!checkdate($m, $d, $y) || $y < 2000 || $y > 2100) {
    reject('Data non valida.');
  }
  return $v;
}
function payload(): array
{
  if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 6 * 1024 * 1024) {
    reject('Richiesta troppo grande.', 413);
  }
  if (str_contains($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data')) {
    return $_POST;
  }
  $raw = file_get_contents('php://input', false, null, 0, 100001);
  if (strlen($raw) > 100000) {
    reject('Richiesta troppo grande.', 413);
  }
  try {
    $v = json_decode($raw ?: '{}', true, 32, JSON_THROW_ON_ERROR);
  } catch (\JsonException) {
    reject('Richiesta non valida.');
  }
  if (!is_array($v)) {
    reject('Richiesta non valida.');
  }
  return $v;
}
function json(mixed $data, int $status = 200): never
{
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
  exit();
}
function headers(): void
{
  header('X-Content-Type-Options: nosniff');
  header('Referrer-Policy: same-origin');
  header('X-Frame-Options: DENY');
  header(
    "Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  );
  header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
}
function start_session(): void
{
  headers();
  header('Cache-Control: no-store');
  ini_set('session.use_strict_mode', '1');
  ini_set('display_errors', '0');
  session_name('punto_studio');
  $https =
    (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
    filter_var(config('TRUST_HTTPS_PROXY', false), FILTER_VALIDATE_BOOLEAN);
  session_set_cookie_params([
    'httponly' => true,
    'samesite' => 'Lax',
    'secure' => $https,
    'path' => '/',
  ]);
  session_start();
  if (isset($_SESSION['seen']) && time() - $_SESSION['seen'] > 7200) {
    $_SESSION = [];
    session_regenerate_id(true);
  }
  $_SESSION['seen'] = time();
  $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
}
function csrf(): void
{
  if (!hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) {
    reject('Sessione scaduta. Ricarica la pagina.', 419);
  }
}
function current_user(): ?array
{
  return isset($_SESSION['uid'])
    ? row('SELECT id,name,email,role,client_id,active FROM {{users}} WHERE id=? AND active=1', [
      $_SESSION['uid'],
    ])
    : null;
}
function auth(): array
{
  return current_user() ?? reject('Accedi per continuare.', 401);
}
function team(): array
{
  $u = auth();
  if ($u['role'] === 'client') {
    reject('Operazione riservata al team.', 403);
  }
  return $u;
}
function admin(): array
{
  $u = auth();
  if ($u['role'] !== 'admin') {
    reject('Operazione riservata all’amministratore.', 403);
  }
  return $u;
}
function demo(): bool
{
  return config('APP_ENV') === 'demo' &&
    in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true);
}
function visible_projects(array $u): array
{
  $sql = 'SELECT p.*, c.name AS client_name FROM {{projects}} p JOIN {{clients}} c ON c.id=p.client_id';
  $args = [];
  if ($u['role'] === 'client') {
    $sql .= ' WHERE p.client_id=?';
    $args[] = $u['client_id'];
  } elseif ($u['role'] === 'member') {
    $sql .= ' WHERE p.id IN (SELECT project_id FROM {{project_members}} WHERE user_id=?)';
    $args[] = $u['id'];
  }
  return all($sql . ' ORDER BY p.created_at DESC,p.id', $args);
}
function project(string $id): array
{
  $u = auth();
  $p = row(
    'SELECT p.*,c.name AS client_name FROM {{projects}} p JOIN {{clients}} c ON c.id=p.client_id WHERE p.id=?',
    [$id],
  );
  if (!$p) {
    reject('Commessa non trovata.', 404);
  }
  if (
    ($u['role'] === 'client' && $u['client_id'] !== $p['client_id']) ||
    ($u['role'] === 'member' &&
      !row('SELECT user_id FROM {{project_members}} WHERE project_id=? AND user_id=?', [$id, $u['id']]))
  ) {
    reject('Non hai accesso a questa commessa.', 403);
  }
  return $p;
}
function writable(array $p): void
{
  if ($p['status'] !== 'active') {
    reject('La commessa è chiusa. Riaprila prima di modificarla.', 409);
  }
}
function lock_project(string $id, bool $mustBeActive = true): array
{
  // A write lock serializes closing a project with task, time and delivery mutations.
  query('UPDATE {{projects}} SET updated_at=updated_at WHERE id=?', [$id]);
  $p = project($id);
  if ($mustBeActive) {
    writable($p);
  }
  return $p;
}
function event(string $projectId, string $verb, string $detail): void
{
  insert('events', [
    'project_id' => $projectId,
    'user_id' => auth()['id'],
    'verb' => $verb,
    'detail' => $detail,
    'created_at' => now(),
  ]);
}
function version_update(string $table, array $old, array $data, mixed $version): void
{
  $table = table_name($table);
  $v = integer($version, 1);
  $assign = implode(',', array_map(fn($key) => "$key=?", array_keys($data)));
  $s = query("UPDATE $table SET $assign,version=version+1,updated_at=? WHERE id=? AND version=?", [
    ...array_values($data),
    now(),
    $old['id'],
    $v,
  ]);
  if ($s->rowCount() !== 1) {
    reject('Qualcuno ha aggiornato questo elemento. Ricarica prima di salvare.', 409);
  }
}
set_exception_handler(function (Throwable $e): void {
  if (PHP_SAPI === 'cli') {
    fwrite(STDERR, $e->getMessage() . PHP_EOL);
    exit(1);
  }
  if ($e instanceof ApiError) {
    json(['error' => $e->getMessage()], $e->status);
  }
  error_log('Punto: ' . $e->getMessage());
  json(['error' => 'Operazione non completata. Riprova tra poco.'], 500);
});
