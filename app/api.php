<?php
declare(strict_types=1);
namespace Punto;
require __DIR__ . '/bootstrap.php';
start_session();
if (!is_file(ROOT . '/storage/installed')) {
  reject('Installa Punto seguendo il README.', 503);
}
$action = $_GET['action'] ?? 'state';
$method = $_SERVER['REQUEST_METHOD'];

function project_tasks(string $id): array
{
  return all(
    'SELECT t.*,u.name AS assignee_name FROM {{tasks}} t LEFT JOIN {{users}} u ON u.id=t.assignee_id WHERE t.project_id=? ORDER BY t.created_at,t.id',
    [$id],
  );
}
function client_access(string $id): array
{
  $u = auth();
  $c = row('SELECT * FROM {{clients}} WHERE id=?', [$id]);
  if (!$c) {
    reject('Cliente non trovato.', 404);
  }
  if ($u['role'] !== 'admin' && ($u['role'] !== 'client' || $u['client_id'] !== $id)) {
    reject('Operazione non consentita.', 403);
  }
  return $c;
}
function task_record(string $id): array
{
  $t = row('SELECT * FROM {{tasks}} WHERE id=?', [$id]);
  if (!$t) {
    reject('Attività non trovata.', 404);
  }
  project($t['project_id']);
  return $t;
}
function assignee(mixed $id, string $projectId): ?string
{
  if (!$id) {
    return null;
  }
  $id = text($id, 24, true);
  if (
    !row(
      'SELECT m.user_id FROM {{project_members}} m JOIN {{users}} u ON u.id=m.user_id WHERE m.project_id=? AND m.user_id=? AND u.active=1 AND u.role<>?',
      [$projectId, $id, 'client'],
    )
  ) {
    reject('Assegna l’attività a una persona del team della commessa.');
  }
  return $id;
}
function create_project(array $d, array $client): array
{
  $member = text($d['member_id'] ?? '', 24);
  if (
    $member &&
    !row('SELECT id FROM {{users}} WHERE id=? AND role<>? AND active=1', [$member, 'client'])
  ) {
    reject('Responsabile non valido.');
  }
  $p = insert('projects', [
    'code' => 'PT-' . strtoupper(substr(id(), 0, 6)),
    'client_id' => $client['id'],
    'title' => text($d['title'] ?? null, 160, true),
    'description' => text($d['description'] ?? '', 4000),
    'status' => 'active',
    'due_date' => day($d['due_date'] ?? null),
    'budget_minutes' => integer($d['budget_minutes'] ?? 2400, 0, 600000),
    'color' => choice($d['color'] ?? 'green', ['green', 'peach', 'blue']),
    'version' => 1,
    'created_at' => now(),
    'updated_at' => now(),
  ]);
  foreach (array_unique(array_filter([auth()['id'], $member])) as $userId) {
    query('INSERT INTO {{project_members}}(project_id,user_id) VALUES (?,?)', [$p['id'], $userId]);
  }
  event($p['id'], 'created', 'Commessa aperta: ' . $p['title']);
  return $p;
}
function report(array $projects): array
{
  return array_map(function ($p) {
    $tasks = row(
      "SELECT COUNT(*) AS total,SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) AS done,SUM(CASE WHEN status='review' THEN 1 ELSE 0 END) AS review FROM {{tasks}} WHERE project_id=?",
      [$p['id']],
    );
    $minutes = (int) query('SELECT COALESCE(SUM(minutes),0) FROM {{time_entries}} WHERE project_id=?', [
      $p['id'],
    ])->fetchColumn();
    return [
      'id' => $p['id'],
      'title' => $p['title'],
      'client_name' => $p['client_name'],
      'status' => $p['status'],
      'due_date' => $p['due_date'],
      'budget_minutes' => (int) $p['budget_minutes'],
      'minutes' => $minutes,
      'tasks' => (int) $tasks['total'],
      'done' => (int) $tasks['done'],
      'review' => (int) $tasks['review'],
    ];
  }, $projects);
}
if ($method === 'GET') {
  if ($action === 'state') {
    $u = current_user();
    if (!$u) {
      json(['user' => null, 'csrf' => $_SESSION['csrf'], 'demo' => demo()]);
    }
    $projects = visible_projects($u);
    $ids = array_column($projects, 'id');
    $marks = implode(',', array_fill(0, count($ids), '?')) ?: 'NULL';
    $clients =
      $u['role'] === 'admin'
        ? all('SELECT * FROM {{clients}} ORDER BY name')
        : all(
          "SELECT id,name,email,company FROM {{clients}} WHERE id IN (SELECT client_id FROM {{projects}} WHERE id IN ($marks))" .
            ($u['role'] === 'client' ? ' OR id=?' : '') .
            ' ORDER BY name',
          [...$ids, ...$u['role'] === 'client' ? [$u['client_id']] : []],
        );
    $requests =
      $u['role'] === 'admin'
        ? all(
          'SELECT r.*,c.name AS client_name FROM {{requests}} r JOIN {{clients}} c ON c.id=r.client_id ORDER BY r.created_at DESC',
        )
        : ($u['role'] === 'client'
          ? all(
            'SELECT r.*,c.name AS client_name FROM {{requests}} r JOIN {{clients}} c ON c.id=r.client_id WHERE r.client_id=? ORDER BY r.created_at DESC',
            [$u['client_id']],
          )
          : []);
    json([
      'csrf' => $_SESSION['csrf'],
      'user' => $u,
      'demo' => demo(),
      'projects' => $projects,
      'clients' => $clients,
      'requests' => $requests,
      'tasks' => all(
        "SELECT t.*,u.name AS assignee_name,p.title AS project_title FROM {{tasks}} t JOIN {{projects}} p ON p.id=t.project_id LEFT JOIN {{users}} u ON u.id=t.assignee_id WHERE t.project_id IN ($marks) ORDER BY t.due_date,t.created_at",
        $ids,
      ),
      'events' => all(
        "SELECT e.*,u.name AS actor,p.title AS project_title FROM {{events}} e JOIN {{users}} u ON u.id=e.user_id JOIN {{projects}} p ON p.id=e.project_id WHERE e.project_id IN ($marks) ORDER BY e.created_at DESC,e.id DESC LIMIT 20",
        $ids,
      ),
      'people' =>
        $u['role'] === 'admin'
          ? all('SELECT id,name,email,role,client_id,active FROM {{users}} ORDER BY name')
          : all(
            "SELECT DISTINCT u.id,u.name,u.role FROM {{users}} u JOIN {{project_members}} m ON m.user_id=u.id WHERE m.project_id IN ($marks)",
            $ids,
          ),
      'report' => report($projects),
    ]);
  }
  $u = auth();
  if ($action === 'project') {
    $p = project(text($_GET['id'] ?? '', 24, true));
    json([
      'project' => $p,
      'tasks' => project_tasks($p['id']),
      'members' => all(
        'SELECT u.id,u.name FROM {{users}} u JOIN {{project_members}} m ON m.user_id=u.id WHERE m.project_id=?',
        [$p['id']],
      ),
      'time' =>
        $u['role'] === 'client'
          ? []
          : all(
            'SELECT e.*,u.name AS user_name,t.title AS task_title FROM {{time_entries}} e JOIN {{users}} u ON u.id=e.user_id LEFT JOIN {{tasks}} t ON t.id=e.task_id WHERE e.project_id=? ORDER BY e.work_date DESC,e.created_at DESC',
            [$p['id']],
          ),
      'deliverables' => all(
        'SELECT id,project_id,title,original_name,mime,bytes,revision,status,feedback,version,created_at FROM {{deliverables}} WHERE project_id=? ORDER BY revision DESC',
        [$p['id']],
      ),
      'events' => all(
        'SELECT e.*,u.name AS actor FROM {{events}} e JOIN {{users}} u ON u.id=e.user_id WHERE e.project_id=? ORDER BY e.created_at DESC,e.id DESC LIMIT 80',
        [$p['id']],
      ),
    ]);
  }
  if ($action === 'task') {
    $t = task_record(text($_GET['id'] ?? '', 24, true));
    json([
      'task' => $t,
      'comments' => all(
        'SELECT c.*,u.name AS author,u.role FROM {{comments}} c JOIN {{users}} u ON u.id=c.user_id WHERE task_id=? ORDER BY c.created_at,c.id',
        [$t['id']],
      ),
    ]);
  }
  if ($action === 'download') {
    $f = row('SELECT * FROM {{deliverables}} WHERE id=?', [text($_GET['id'] ?? '', 24, true)]);
    if (!$f) {
      reject('File non trovato.', 404);
    }
    project($f['project_id']);
    $path = ROOT . '/storage/uploads/' . $f['filename'];
    if (!is_file($path)) {
      reject('File non disponibile.', 404);
    }
    header('Content-Type: ' . $f['mime']);
    header('Content-Length: ' . filesize($path));
    header(
      "Content-Disposition: attachment; filename*=UTF-8''" . rawurlencode($f['original_name']),
    );
    readfile($path);
    exit();
  }
  if ($action === 'export') {
    team();
    $data = report(visible_projects($u));
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="punto-commesse.csv"');
    $f = fopen('php://output', 'w');
    fwrite($f, "\xEF\xBB\xBF");
    fputcsv(
      $f,
      [
        'Commessa',
        'Cliente',
        'Stato',
        'Scadenza',
        'Budget ore',
        'Ore registrate',
        'Attività',
        'Approvate',
      ],
      ';',
      '"',
      '',
    );
    foreach ($data as $p) {
      $line = [
        $p['title'],
        $p['client_name'],
        $p['status'],
        $p['due_date'] ?? '',
        round($p['budget_minutes'] / 60, 2),
        round($p['minutes'] / 60, 2),
        $p['tasks'],
        $p['done'],
      ];
      $line = array_map(
        fn($v) => is_string($v) && preg_match('/^[=+@\-\t\r]/', $v) ? "'" . $v : $v,
        $line,
      );
      fputcsv($f, $line, ';', '"', '');
    }
    fclose($f);
    exit();
  }
  reject('Risorsa non trovata.', 404);
}
if ($method !== 'POST') {
  reject('Metodo non consentito.', 405);
}
csrf();
$d = payload();
if ($action === 'login') {
  $key = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'local');
  query('DELETE FROM {{login_attempts}} WHERE created_at<?', [gmdate('Y-m-d H:i:s', time() - 900)]);
  if (
    (int) query('SELECT COUNT(*) FROM {{login_attempts}} WHERE ip_hash=?', [$key])->fetchColumn() >= 10
  ) {
    reject('Troppi tentativi. Attendi 15 minuti.', 429);
  }
  insert('login_attempts', ['ip_hash' => $key, 'created_at' => now()]);
  $u = row('SELECT * FROM {{users}} WHERE email=? AND active=1', [email($d['email'] ?? '')]);
  $dummy = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
  $ok = password_verify(text($d['password'] ?? '', 500), $u['password_hash'] ?? $dummy);
  if (!$u || !$ok) {
    reject('Email o password non corrette.', 401);
  }
  query('DELETE FROM {{login_attempts}} WHERE ip_hash=?', [$key]);
  session_regenerate_id(true);
  $_SESSION['uid'] = $u['id'];
  $_SESSION['csrf'] = bin2hex(random_bytes(32));
  json(['ok' => true, 'csrf' => $_SESSION['csrf']]);
}
if ($action === 'demo') {
  if (!demo()) {
    reject('La demo rapida è disponibile solo in locale.', 403);
  }
  $u = row('SELECT id FROM {{users}} WHERE demo_role=? AND active=1', [
    choice($d['role'] ?? 'admin', ['admin', 'member', 'client']),
  ]);
  if (!$u) {
    reject('Profilo demo non disponibile.', 404);
  }
  session_regenerate_id(true);
  $_SESSION['uid'] = $u['id'];
  $_SESSION['csrf'] = bin2hex(random_bytes(32));
  json(['ok' => true, 'csrf' => $_SESSION['csrf']]);
}
if ($action === 'logout') {
  $_SESSION = ['csrf' => bin2hex(random_bytes(32))];
  session_regenerate_id(true);
  json(['ok' => true, 'csrf' => $_SESSION['csrf']]);
}
$u = auth();
if ($action === 'password_change') {
  $record = row('SELECT password_hash FROM {{users}} WHERE id=?', [$u['id']]);
  if (!password_verify(text($d['current_password'] ?? '', 128, true), $record['password_hash'])) {
    reject('La password attuale non è corretta.', 422);
  }
  $password = text($d['password'] ?? '', 128, true);
  if (strlen($password) < 12) {
    reject('Usa almeno 12 caratteri per la nuova password.');
  }
  query('UPDATE {{users}} SET password_hash=? WHERE id=?', [
    password_hash($password, PASSWORD_DEFAULT),
    $u['id'],
  ]);
  session_regenerate_id(true);
  $_SESSION['csrf'] = bin2hex(random_bytes(32));
  json(['ok' => true, 'csrf' => $_SESSION['csrf']]);
}
if ($action === 'client_create') {
  admin();
  $c = insert('clients', [
    'name' => text($d['name'] ?? '', 120, true),
    'email' => email($d['email'] ?? ''),
    'company' => text($d['company'] ?? '', 120),
    'notes' => text($d['notes'] ?? '', 2000),
    'created_at' => now(),
  ]);
  json($c, 201);
}
if ($action === 'user_create') {
  admin();
  $role = choice($d['role'] ?? '', ['member', 'client']);
  $cid = $role === 'client' ? client_access(text($d['client_id'] ?? '', 24, true))['id'] : null;
  $password = text($d['password'] ?? '', 128, true);
  if (strlen($password) < 12) {
    reject('Usa almeno 12 caratteri per la password.');
  }
  $mail = email($d['email'] ?? '');
  if (row('SELECT id FROM {{users}} WHERE email=?', [$mail])) {
    reject('Esiste già un accesso con questa email.', 409);
  }
  $person = insert('users', [
    'name' => text($d['name'] ?? '', 100, true),
    'email' => $mail,
    'password_hash' => password_hash($password, PASSWORD_DEFAULT),
    'role' => $role,
    'client_id' => $cid,
    'active' => 1,
    'created_at' => now(),
  ]);
  json(['id' => $person['id']], 201);
}
if ($action === 'request_create') {
  if ($u['role'] === 'member') {
    reject('Operazione non consentita.', 403);
  }
  $c = client_access(
    $u['role'] === 'client' ? $u['client_id'] : text($d['client_id'] ?? '', 24, true),
  );
  json(
    insert('requests', [
      'client_id' => $c['id'],
      'author_id' => $u['id'],
      'title' => text($d['title'] ?? '', 160, true),
      'description' => text($d['description'] ?? '', 4000, true),
      'priority' => choice($d['priority'] ?? 'normal', ['low', 'normal', 'high']),
      'status' => 'new',
      'version' => 1,
      'created_at' => now(),
      'updated_at' => now(),
    ]),
    201,
  );
}
if ($action === 'request_convert' || $action === 'request_decline') {
  admin();
  $result = transaction(function () use ($action, $d) {
    $r = row('SELECT * FROM {{requests}} WHERE id=?', [text($d['id'] ?? '', 24, true)]);
    if (!$r) {
      reject('Richiesta non trovata.', 404);
    }
    if ($r['status'] !== 'new') {
      reject('Questa richiesta è già stata gestita.', 409);
    }
    version_update(
      'requests',
      $r,
      ['status' => $action === 'request_convert' ? 'accepted' : 'declined'],
      $d['version'] ?? 0,
    );
    if ($action === 'request_decline') {
      return ['ok' => true];
    }
    $p = create_project(
      ['title' => $r['title'], 'description' => $r['description']] + $d,
      client_access($r['client_id']),
    );
    query('UPDATE {{requests}} SET project_id=? WHERE id=?', [$p['id'], $r['id']]);
    return $p;
  });
  json($result);
}
if ($action === 'project_create') {
  admin();
  json(
    transaction(fn() => create_project($d, client_access(text($d['client_id'] ?? '', 24, true)))),
    201,
  );
}
if ($action === 'task_comment') {
  $t = task_record(text($d['task_id'] ?? '', 24, true));
  writable(project($t['project_id']));
  json(
    transaction(function () use ($d, $t, $u) {
      lock_project($t['project_id']);
      $c = insert('comments', [
        'task_id' => $t['id'],
        'user_id' => $u['id'],
        'body' => text($d['body'] ?? '', 3000, true),
        'created_at' => now(),
      ]);
      event($t['project_id'], 'comment', 'Commento su: ' . $t['title']);
      return $c;
    }),
    201,
  );
}
if ($action === 'task_update' || $action === 'task_status') {
  json(
    transaction(function () use ($action, $d, $u) {
      $t = task_record(text($d['id'] ?? '', 24, true));
      $p = lock_project($t['project_id']);
      if ($action === 'task_status') {
        $state = choice($d['status'] ?? '', STATUSES);
        $rules =
          $u['role'] === 'client'
            ? ['review' => ['done', 'doing'], 'done' => ['doing']]
            : [
              'todo' => ['doing'],
              'doing' => ['todo', 'review'],
              'review' => ['doing'],
              'done' => [],
            ];
        if (!in_array($state, $rules[$t['status']] ?? [], true)) {
          reject('Questo passaggio di stato non è consentito per il tuo ruolo.', 403);
        }
        $patch = ['status' => $state];
      } else {
        team();
        if ($t['status'] === 'done') {
          reject('L’attività è approvata: il cliente deve riaprirla prima di modificarla.', 409);
        }
        $patch = [
          'title' => text($d['title'] ?? '', 160, true),
          'description' => text($d['description'] ?? '', 4000),
          'priority' => choice($d['priority'] ?? 'normal', ['low', 'normal', 'high']),
          'assignee_id' => assignee($d['assignee_id'] ?? null, $p['id']),
          'due_date' => day($d['due_date'] ?? null),
          'estimate_minutes' => integer($d['estimate_minutes'] ?? 0, 0, 60000),
        ];
      }
      version_update('tasks', $t, $patch, $d['version'] ?? 0);
      event(
        $p['id'],
        $action,
        $t['title'] . ($action === 'task_status' ? ' → ' . $state : ' · dettagli aggiornati'),
      );
      return ['ok' => true];
    }),
  );
}
$p = project(text($d['project_id'] ?? '', 24, true));
if ($action === 'project_update') {
  admin();
  json(
    transaction(function () use ($p, $d) {
      lock_project($p['id'], false);
      $status = choice($d['status'] ?? $p['status'], ['active', 'completed', 'archived']);
      if ($status === 'completed') {
        if (
          (int) query('SELECT COUNT(*) FROM {{tasks}} WHERE project_id=? AND status<>?', [
            $p['id'],
            'done',
          ])->fetchColumn() > 0
        ) {
          reject('Ci sono attività ancora da approvare.', 409);
        }
        $last = row(
          'SELECT status FROM {{deliverables}} WHERE project_id=? ORDER BY revision DESC LIMIT 1',
          [$p['id']],
        );
        if (!$last || $last['status'] !== 'approved') {
          reject(
            'Carica una consegna e ottieni l’approvazione del cliente prima di completare la commessa.',
            409,
          );
        }
      }
      version_update(
        'projects',
        $p,
        [
          'title' => text($d['title'] ?? $p['title'], 160, true),
          'description' => text($d['description'] ?? $p['description'], 4000),
          'status' => $status,
          'due_date' => day($d['due_date'] ?? $p['due_date']),
          'budget_minutes' => integer($d['budget_minutes'] ?? $p['budget_minutes'], 0, 600000),
        ],
        $d['version'] ?? 0,
      );
      event($p['id'], 'project_updated', 'Commessa aggiornata · ' . $status);
      return ['ok' => true];
    }),
  );
}
writable($p);
if ($action === 'member_add') {
  admin();
  $uid = text($d['user_id'] ?? '', 24, true);
  if (!row('SELECT id FROM {{users}} WHERE id=? AND role<>? AND active=1', [$uid, 'client'])) {
    reject('Persona non valida.');
  }
  if (
    row('SELECT user_id FROM {{project_members}} WHERE project_id=? AND user_id=?', [$p['id'], $uid])
  ) {
    json(['ok' => true]);
  }
  transaction(function () use ($p, $uid) {
    lock_project($p['id']);
    query('INSERT INTO {{project_members}}(project_id,user_id) VALUES(?,?)', [$p['id'], $uid]);
    event($p['id'], 'member_added', 'Una persona è entrata nel team della commessa.');
  });
  json(['ok' => true]);
}
if ($action === 'task_create') {
  team();
  json(
    transaction(function () use ($p, $d) {
      lock_project($p['id']);
      $task = insert('tasks', [
        'project_id' => $p['id'],
        'title' => text($d['title'] ?? '', 160, true),
        'description' => text($d['description'] ?? '', 4000),
        'status' => 'todo',
        'priority' => choice($d['priority'] ?? 'normal', ['low', 'normal', 'high']),
        'assignee_id' => assignee($d['assignee_id'] ?? null, $p['id']),
        'due_date' => day($d['due_date'] ?? null),
        'estimate_minutes' => integer($d['estimate_minutes'] ?? 0, 0, 60000),
        'version' => 1,
        'created_at' => now(),
        'updated_at' => now(),
      ]);
      event($p['id'], 'task_created', 'Nuova attività: ' . $task['title']);
      return $task;
    }),
    201,
  );
}
if ($action === 'time_create') {
  team();
  $taskId = text($d['task_id'] ?? '', 24);
  if ($taskId && !row('SELECT id FROM {{tasks}} WHERE id=? AND project_id=?', [$taskId, $p['id']])) {
    reject('Attività non appartenente alla commessa.');
  }
  $date = day($d['work_date'] ?? null, true);
  if ($date > gmdate('Y-m-d')) {
    reject('Non puoi registrare tempo nel futuro.');
  }
  json(
    transaction(function () use ($p, $d, $u, $taskId, $date) {
      lock_project($p['id']);
      $entry = insert('time_entries', [
        'project_id' => $p['id'],
        'task_id' => $taskId ?: null,
        'user_id' => $u['id'],
        'minutes' => integer($d['minutes'] ?? 0, 1, 1440),
        'work_date' => $date,
        'note' => text($d['note'] ?? '', 500, true),
        'created_at' => now(),
      ]);
      event($p['id'], 'time_logged', 'Registrati ' . $entry['minutes'] . ' minuti di lavoro.');
      return $entry;
    }),
    201,
  );
}
if ($action === 'delivery_upload') {
  team();
  $title = text($d['title'] ?? '', 160, true);
  $f = $_FILES['file'] ?? null;
  if (!$f || $f['error'] !== UPLOAD_ERR_OK || $f['size'] > 5 * 1024 * 1024) {
    reject('Scegli un PDF, JPG, PNG o WebP entro 5 MB.');
  }
  $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
  $types = [
    'application/pdf' => 'pdf',
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
  ];
  if (!isset($types[$mime])) {
    reject('Il formato del file non è consentito.');
  }
  if (str_starts_with($mime, 'image/')) {
    $size = @getimagesize($f['tmp_name']);
    if (!$size || $size[0] * $size[1] > 12000000) {
      reject('Immagine non valida o superiore a 12 megapixel.');
    }
    $img = @imagecreatefromstring(file_get_contents($f['tmp_name']));
    if (!$img) {
      reject('Immagine non leggibile.');
    }
    $mime = 'image/webp';
    $extension = 'webp';
  } else {
    if (file_get_contents($f['tmp_name'], false, null, 0, 5) !== '%PDF-') {
      reject('PDF non valido.');
    }
    $extension = 'pdf';
  }
  $name = id() . '.' . $extension;
  $path = ROOT . '/storage/uploads/' . $name;
  if (!is_dir(dirname($path))) {
    mkdir(dirname($path), 0700, true);
  }
  $saved = isset($img) ? imagewebp($img, $path, 85) : move_uploaded_file($f['tmp_name'], $path);
  if (!$saved) {
    reject('Impossibile salvare il file.', 503);
  }
  chmod($path, 0600);
  try {
    $delivery = transaction(function () use ($p, $u, $f, $name, $path, $mime, $title, $extension) {
      // Lock the project row to serialize delivery revision numbers on both drivers.
      query('UPDATE {{projects}} SET version=version+1 WHERE id=?', [$p['id']]);
      $fresh = project($p['id']);
      writable($fresh);
      $revision =
        1 +
        (int) query('SELECT COALESCE(MAX(revision),0) FROM {{deliverables}} WHERE project_id=?', [
          $p['id'],
        ])->fetchColumn();
      $original = preg_replace('/[\x00-\x1f\x7f]/', '', basename($f['name']));
      if ($mime === 'image/webp') {
        $original = pathinfo($original, PATHINFO_FILENAME) . '.webp';
      }
      $r = insert('deliverables', [
        'project_id' => $p['id'],
        'user_id' => $u['id'],
        'title' => $title,
        'filename' => $name,
        'original_name' => mb_substr($original, 0, 190),
        'mime' => $mime,
        'bytes' => filesize($path),
        'revision' => $revision,
        'status' => 'review',
        'feedback' => '',
        'version' => 1,
        'created_at' => now(),
        'updated_at' => now(),
      ]);
      event($p['id'], 'delivery_uploaded', 'Consegna v' . $revision . ': ' . $title);
      return ['id' => $r['id'], 'revision' => $revision];
    });
  } catch (\Throwable $e) {
    unlink($path);
    throw $e;
  }
  json($delivery, 201);
}
if ($action === 'delivery_review') {
  if ($u['role'] !== 'client') {
    reject('L’approvazione è riservata al cliente.', 403);
  }
  json(
    transaction(function () use ($p, $d, $u) {
      lock_project($p['id']);
      $f = row('SELECT * FROM {{deliverables}} WHERE id=? AND project_id=?', [
        text($d['id'] ?? '', 24, true),
        $p['id'],
      ]);
      if (!$f) {
        reject('Consegna non trovata.', 404);
      }
      if ($f['status'] !== 'review') {
        reject('La consegna è già stata valutata.', 409);
      }
      $status = choice($d['status'] ?? '', ['approved', 'changes']);
      $feedback = text($d['feedback'] ?? '', 2000, $status === 'changes');
      version_update(
        'deliverables',
        $f,
        ['status' => $status, 'feedback' => $feedback, 'reviewer_id' => $u['id']],
        $d['version'] ?? 0,
      );
      event(
        $p['id'],
        'delivery_reviewed',
        'Consegna v' .
          $f['revision'] .
          ($status === 'approved' ? ' approvata dal cliente.' : ' · richieste modifiche.'),
      );
      return ['ok' => true];
    }),
  );
}
reject('Operazione non trovata.', 404);
