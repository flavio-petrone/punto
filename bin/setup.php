<?php
declare(strict_types=1);
namespace Punto;
if (PHP_SAPI !== 'cli') {
  exit();
}
require __DIR__ . '/../app/bootstrap.php';
if (is_file(ROOT . '/storage/installed')) {
  throw new \RuntimeException('Installazione esistente: nessun dato modificato.');
}
if (!is_dir(ROOT . '/storage')) {
  mkdir(ROOT . '/storage', 0700, true);
}
$demo = in_array('--demo', $argv, true);
if (!$demo && !getenv('ADMIN_EMAIL')) {
  throw new \RuntimeException('Imposta ADMIN_EMAIL, ADMIN_NAME e ADMIN_PASSWORD.');
}
$mail = email(getenv('ADMIN_EMAIL') ?: 'studio@example.test');
$password = getenv('ADMIN_PASSWORD') ?: bin2hex(random_bytes(16));
if (strlen($password) < 12) {
  throw new \RuntimeException('Password di almeno 12 caratteri.');
}
$driver = db()->getAttribute(\PDO::ATTR_DRIVER_NAME);
$tables =
  $driver === 'sqlite'
    ? all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    : all('SHOW TABLES');
if ($tables) {
  throw new \RuntimeException(
    'Usa un database dedicato vuoto. Nessuna tabella esistente verrà modificata.',
  );
}
if ($driver === 'mysql') {
  db()->exec('SET default_storage_engine=InnoDB');
  db()->exec('SET NAMES utf8mb4');
}
foreach (explode(';', file_get_contents(ROOT . '/database/schema.sql')) as $sql) {
  if (trim($sql)) {
    db()->exec($sql);
  }
}
query('INSERT INTO schema_migrations(version,applied_at) VALUES(1,?)', [now()]);
transaction(function () use ($demo, $mail, $password) {
  $date = fn(int $offset) => gmdate('Y-m-d', time() + 86400 * $offset);
  $created = now();
  $admin = insert('users', [
    'name' => getenv('ADMIN_NAME') ?: 'Flavio Petrone',
    'email' => $mail,
    'password_hash' => password_hash($password, PASSWORD_DEFAULT),
    'role' => 'admin',
    'active' => 1,
    'demo_role' => $demo ? 'admin' : null,
    'created_at' => $created,
  ]);
  if (!$demo) {
    return;
  }
  $member = insert('users', [
    'name' => 'Marta Leone',
    'email' => 'marta@example.test',
    'password_hash' => password_hash(bin2hex(random_bytes(24)), PASSWORD_DEFAULT),
    'role' => 'member',
    'active' => 1,
    'demo_role' => 'member',
    'created_at' => $created,
  ]);
  $clients = [];
  foreach (
    [
      ['Giulia Conti', 'Atelier Nove', 'giulia@example.test'],
      ['Luca Serra', 'Forma Studio', 'luca@example.test'],
      ['Anna Riva', 'Linea Lab', 'anna@example.test'],
    ]
    as $a
  ) {
    $clients[] = insert('clients', [
      'name' => $a[0],
      'company' => $a[1],
      'email' => $a[2],
      'notes' => 'Cliente dimostrativo. Nessun dato reale.',
      'created_at' => $created,
    ]);
  }
  $client = insert('users', [
    'name' => 'Giulia Conti',
    'email' => 'cliente@example.test',
    'password_hash' => password_hash(bin2hex(random_bytes(24)), PASSWORD_DEFAULT),
    'role' => 'client',
    'client_id' => $clients[0]['id'],
    'active' => 1,
    'demo_role' => 'client',
    'created_at' => $created,
  ]);
  foreach (
    [
      ['Atelier Nove', 'Un nuovo spazio per il brand.', 'peach', 0, 4800, 12],
      [
        'Forma / Digital experience',
        'Identità, contenuti e una nuova esperienza digitale.',
        'green',
        1,
        3600,
        8,
      ],
      [
        'Linea / Portale clienti',
        'Un portale per mettere in contatto persone e servizi.',
        'blue',
        2,
        6000,
        24,
      ],
    ]
    as $n => $a
  ) {
    $p = insert('projects', [
      'code' => 'PT-00' . ($n + 1),
      'client_id' => $clients[$a[3]]['id'],
      'title' => $a[0],
      'description' => $a[1],
      'color' => $a[2],
      'status' => 'active',
      'due_date' => $date($a[5]),
      'budget_minutes' => $a[4],
      'version' => 1,
      'created_at' => $created,
      'updated_at' => $created,
    ]);
    query('INSERT INTO project_members(project_id,user_id) VALUES(?,?)', [$p['id'], $admin['id']]);
    if ($n < 2) {
      query('INSERT INTO project_members(project_id,user_id) VALUES(?,?)', [
        $p['id'],
        $member['id'],
      ]);
    }
    $tasks = [
      [
        'Disegnare il percorso principale',
        'Definire i passaggi dalla prima visita al contatto.',
        'done',
        'normal',
        -3,
        240,
      ],
      [
        'Sviluppare l’area riservata',
        'Accessi, permessi e organizzazione dei contenuti.',
        'doing',
        'high',
        3,
        480,
      ],
      [
        'Verificare la versione mobile',
        'Controllare navigazione, leggibilità e moduli.',
        'review',
        'normal',
        2,
        180,
      ],
      [
        'Preparare la consegna',
        'Documentazione, contenuti finali e passaggio al cliente.',
        'todo',
        'low',
        10,
        120,
      ],
    ];
    foreach (array_slice($tasks, 0, 4 - $n) as $j => $t) {
      $task = insert('tasks', [
        'project_id' => $p['id'],
        'title' => $t[0],
        'description' => $t[1],
        'status' => $t[2],
        'priority' => $t[3],
        'assignee_id' => $j % 2 === 1 && $n < 2 ? $member['id'] : $admin['id'],
        'due_date' => $date($t[4]),
        'estimate_minutes' => $t[5],
        'version' => 1,
        'created_at' => $created,
        'updated_at' => $created,
      ]);
      if ($j < 2) {
        insert('time_entries', [
          'project_id' => $p['id'],
          'task_id' => $task['id'],
          'user_id' => $admin['id'],
          'minutes' => 120 + $n * 30 + $j * 45,
          'work_date' => $date(-$j),
          'note' => $j ? 'Sviluppo e verifica dei permessi' : 'Progettazione del flusso',
          'created_at' => $created,
        ]);
      }
      if ($n === 0 && $j === 2) {
        insert('comments', [
          'task_id' => $task['id'],
          'user_id' => $client['id'],
          'body' =>
            'La nuova struttura è chiara. Verifico l’ultimo passaggio da telefono e ti confermo.',
          'created_at' => $created,
        ]);
      }
    }
    insert('events', [
      'project_id' => $p['id'],
      'user_id' => $admin['id'],
      'verb' => 'created',
      'detail' => 'Commessa aperta. Brief condiviso e team al lavoro.',
      'created_at' => $created,
    ]);
  }
  foreach (
    [
      [
        'Una pagina dedicata ai nostri eventi',
        'Vorremmo raccogliere eventi, date e modalità di partecipazione in uno spazio dedicato.',
        'normal',
      ],
      [
        'Aggiornare il catalogo primavera',
        'Nuove collezioni, disponibilità e fotografie da organizzare.',
        'high',
      ],
    ]
    as $r
  ) {
    insert('requests', [
      'client_id' => $clients[0]['id'],
      'author_id' => $client['id'],
      'title' => $r[0],
      'description' => $r[1],
      'priority' => $r[2],
      'status' => 'new',
      'version' => 1,
      'created_at' => $created,
      'updated_at' => $created,
    ]);
  }
});
file_put_contents(ROOT . '/storage/installed', now());
file_put_contents(ROOT . '/storage/accesso.txt', "Email: $mail\nPassword: $password\n");
chmod(ROOT . '/storage/accesso.txt', 0600);
if ($demo && !is_file(ROOT . '/config.php')) {
  file_put_contents(ROOT . '/config.php', "<?php return ['APP_ENV'=>'demo'];\n");
}
echo 'Punto pronto su ' .
  ($driver === 'mysql' ? 'MySQL/MariaDB' : 'SQLite') .
  ". Credenziali private in storage/accesso.txt.\n";
