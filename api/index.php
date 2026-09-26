<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('Cache-Control: no-store');

function reply(int $status, array $data): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function input(): array
{
    if (!str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) {
        reply(415, ['error' => 'Envie os dados em JSON.']);
    }
    $body = file_get_contents('php://input');
    $data = json_decode($body ?: '', true);
    if (!is_array($data)) {
        reply(400, ['error' => 'Dados inválidos.']);
    }
    return $data;
}

function text_field(mixed $value, int $limit, bool $required = true): string
{
    $value = trim((string) ($value ?? ''));
    if (($required && $value === '') || mb_strlen($value) > $limit) {
        reply(422, ['error' => 'Confira os campos obrigatórios e o tamanho dos textos.']);
    }
    return $value;
}

function optional_number(mixed $value, float $maximum): ?float
{
    if ($value === null || $value === '') {
        return null;
    }
    if (!is_numeric($value) || (float) $value < 0 || (float) $value > $maximum) {
        reply(422, ['error' => 'Peso ou medida inválida.']);
    }
    return round((float) $value, 1);
}

function current_user(PDO $pdo): ?array
{
    $token = $_COOKIE['thelie_session'] ?? '';
    if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/', $token)) {
        return null;
    }
    $query = $pdo->prepare(
        'SELECT u.id, u.username, u.display_name, u.email, u.phone, u.role,
                u.must_change_password, s.csrf_token
         FROM user_sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP()'
    );
    $query->execute([hash('sha256', $token)]);
    return $query->fetch(PDO::FETCH_ASSOC) ?: null;
}

function require_user(PDO $pdo, bool $admin = false): array
{
    $user = current_user($pdo);
    if (!$user) {
        reply(401, ['error' => 'Entre na sua conta para continuar.']);
    }
    if (!hash_equals($user['csrf_token'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) {
        reply(403, ['error' => 'Sessão expirada. Atualize a página.']);
    }
    if ($admin && ($user['role'] !== 'admin' || (int) $user['must_change_password'] === 1)) {
        reply(403, ['error' => 'Acesso restrito ao administrador.']);
    }
    return $user;
}

function cookie_options(int $expires): array
{
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    return ['expires' => $expires, 'path' => '/', 'secure' => $secure, 'httponly' => true, 'samesite' => 'Lax'];
}

function public_user(array $user): array
{
    return [
        'id' => (int) $user['id'], 'username' => $user['username'],
        'display_name' => $user['display_name'], 'email' => $user['email'],
        'phone' => $user['phone'], 'role' => $user['role'],
        'must_change_password' => (bool) $user['must_change_password'],
        'csrf_token' => $user['csrf_token']
    ];
}

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $action = $_GET['action'] ?? '';
    if (!in_array($method, ['GET', 'POST', 'PUT', 'PATCH'], true)) {
        reply(405, ['error' => 'Método não permitido.']);
    }
    if ($method !== 'GET' && isset($_SERVER['HTTP_ORIGIN'])) {
        $originHost = parse_url($_SERVER['HTTP_ORIGIN'], PHP_URL_HOST);
        $requestHost = explode(':', $_SERVER['HTTP_HOST'] ?? '')[0];
        if ($originHost !== $requestHost) {
            reply(403, ['error' => 'Origem não permitida.']);
        }
    }

    $pdo = ready_database();

    if ($action === 'products' && $method === 'GET') {
        $rows = $pdo->query(
            'SELECT id, slug, section, sort_order, category, kicker, title, description,
                    quote_text, weight_g, width_cm, height_cm, depth_cm,
                    production_days, photo_version
             FROM products ORDER BY FIELD(section, "galeria", "destaques"), sort_order, id'
        )->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$row) {
            $row['id'] = (int) $row['id'];
            $row['production_days'] = (int) $row['production_days'];
            $row['photo_url'] = '/api/index.php?action=photo&id=' . $row['id'] . '&v=' . $row['photo_version'];
            unset($row['photo_version']);
        }
        reply(200, ['products' => $rows]);
    }

    if ($action === 'photo' && $method === 'GET') {
        $id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
        if (!$id) reply(404, ['error' => 'Foto não encontrada.']);
        $query = $pdo->prepare('SELECT photo FROM products WHERE id = ?');
        $query->execute([$id]);
        $photo = $query->fetchColumn();
        if ($photo === false) reply(404, ['error' => 'Foto não encontrada.']);
        header('Content-Type: image/jpeg');
        header('Cache-Control: public, max-age=86400');
        echo $photo;
        exit;
    }

    if ($action === 'login' && $method === 'POST') {
        $data = input();
        $username = mb_strtolower(text_field($data['username'] ?? '', 60));
        $password = (string) ($data['password'] ?? '');
        $attemptKey = hash('sha256', $username . '|' . ($_SERVER['REMOTE_ADDR'] ?? ''));
        $attempt = $pdo->prepare('SELECT failures, locked_until, updated_at FROM login_attempts WHERE attempt_key = ?');
        $attempt->execute([$attemptKey]);
        $throttle = $attempt->fetch(PDO::FETCH_ASSOC);
        if ($throttle && $throttle['locked_until'] && strtotime($throttle['locked_until']) > time()) {
            reply(429, ['error' => 'Muitas tentativas. Aguarde 15 minutos.']);
        }
        $query = $pdo->prepare('SELECT * FROM users WHERE username = ? OR email = ?');
        $query->execute([$username, $username]);
        $user = $query->fetch(PDO::FETCH_ASSOC);
        if (!$user || !password_verify($password, $user['password_hash'])) {
            $recent = $throttle && strtotime($throttle['updated_at']) > time() - 900;
            $failures = ($recent ? (int) $throttle['failures'] : 0) + 1;
            $update = $pdo->prepare(
                'INSERT INTO login_attempts (attempt_key, failures, locked_until)
                 VALUES (?, ?, IF(? >= 5, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE), NULL))
                 ON DUPLICATE KEY UPDATE failures = VALUES(failures), locked_until = VALUES(locked_until)'
            );
            $update->execute([$attemptKey, $failures, $failures]);
            reply(401, ['error' => 'Usuário ou senha incorretos.']);
        }
        $pdo->prepare('DELETE FROM login_attempts WHERE attempt_key = ?')->execute([$attemptKey]);
        $token = bin2hex(random_bytes(32));
        $csrf = bin2hex(random_bytes(32));
        $create = $pdo->prepare(
            'INSERT INTO user_sessions (token_hash, user_id, csrf_token, expires_at)
             VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY))'
        );
        $create->execute([hash('sha256', $token), $user['id'], $csrf]);
        setcookie('thelie_session', $token, cookie_options(time() + 604800));
        $user['csrf_token'] = $csrf;
        reply(200, ['user' => public_user($user)]);
    }

    if ($action === 'me' && $method === 'GET') {
        $user = current_user($pdo);
        if (!$user) reply(401, ['error' => 'Sessão não iniciada.']);
        reply(200, ['user' => public_user($user)]);
    }

    if ($action === 'logout' && $method === 'POST') {
        require_user($pdo);
        $pdo->prepare('DELETE FROM user_sessions WHERE token_hash = ?')
            ->execute([hash('sha256', $_COOKIE['thelie_session'])]);
        setcookie('thelie_session', '', cookie_options(time() - 3600));
        reply(200, ['ok' => true]);
    }

    if ($action === 'profile' && $method === 'PATCH') {
        $user = require_user($pdo);
        $data = input();
        $name = text_field($data['display_name'] ?? '', 120);
        $email = text_field($data['email'] ?? '', 190, false);
        $phone = text_field($data['phone'] ?? '', 40, false);
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            reply(422, ['error' => 'E-mail inválido.']);
        }
        $update = $pdo->prepare('UPDATE users SET display_name = ?, email = ?, phone = ? WHERE id = ?');
        $update->execute([$name, $email ?: null, $phone ?: null, $user['id']]);
        reply(200, ['ok' => true]);
    }

    if ($action === 'password' && $method === 'POST') {
        $user = require_user($pdo);
        $data = input();
        $current = (string) ($data['current_password'] ?? '');
        $next = (string) ($data['new_password'] ?? '');
        if (strlen($next) < 12 || strlen($next) > 128) {
            reply(422, ['error' => 'Use uma senha de 12 a 128 caracteres.']);
        }
        $query = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
        $query->execute([$user['id']]);
        if (!password_verify($current, (string) $query->fetchColumn())) {
            reply(403, ['error' => 'Senha atual incorreta.']);
        }
        $hash = password_hash($next, PASSWORD_DEFAULT);
        $pdo->prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?')
            ->execute([$hash, $user['id']]);
        $pdo->prepare('DELETE FROM user_sessions WHERE user_id = ? AND token_hash <> ?')
            ->execute([$user['id'], hash('sha256', $_COOKIE['thelie_session'])]);
        reply(200, ['ok' => true]);
    }

    if ($action === 'product' && $method === 'PUT') {
        require_user($pdo, true);
        $data = input();
        $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id) reply(422, ['error' => 'Peça inválida.']);
        $category = text_field($data['category'] ?? '', 80);
        if (!in_array($category, ['escultura', 'animal', 'vaso'], true)) {
            reply(422, ['error' => 'Categoria inválida.']);
        }
        $days = filter_var($data['production_days'] ?? null, FILTER_VALIDATE_INT);
        if (!$days || $days > 365) reply(422, ['error' => 'Prazo inválido.']);
        $update = $pdo->prepare(
            'UPDATE products SET category = ?, kicker = ?, title = ?, description = ?, quote_text = ?,
             weight_g = ?, width_cm = ?, height_cm = ?, depth_cm = ?, production_days = ? WHERE id = ?'
        );
        $update->execute([
            $category, text_field($data['kicker'] ?? '', 120),
            text_field($data['title'] ?? '', 160), text_field($data['description'] ?? '', 3000),
            text_field($data['quote_text'] ?? '', 1000, false),
            optional_number($data['weight_g'] ?? null, 9999999),
            optional_number($data['width_cm'] ?? null, 99999),
            optional_number($data['height_cm'] ?? null, 99999),
            optional_number($data['depth_cm'] ?? null, 99999),
            $days, $id
        ]);
        reply(200, ['ok' => true]);
    }

    if ($action === 'photo-upload' && $method === 'POST') {
        require_user($pdo, true);
        $id = filter_input(INPUT_POST, 'id', FILTER_VALIDATE_INT);
        $file = $_FILES['photo'] ?? null;
        if (!$id || !$file || $file['error'] !== UPLOAD_ERR_OK || $file['size'] > 5 * 1024 * 1024) {
            reply(422, ['error' => 'Escolha um JPG de até 5 MB.']);
        }
        $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
        if (!in_array($extension, ['jpg', 'jpeg'], true) || $mime !== 'image/jpeg') {
            reply(422, ['error' => 'A foto precisa ser JPG.']);
        }
        $size = @getimagesize($file['tmp_name']);
        if (!$size || $size[2] !== IMAGETYPE_JPEG) {
            reply(422, ['error' => 'A foto precisa ser JPG.']);
        }
        $image = file_get_contents($file['tmp_name']);
        $update = $pdo->prepare('UPDATE products SET photo = ?, photo_version = photo_version + 1 WHERE id = ?');
        $update->bindValue(1, $image, PDO::PARAM_LOB);
        $update->bindValue(2, $id, PDO::PARAM_INT);
        $update->execute();
        reply(200, ['ok' => true]);
    }

    reply(404, ['error' => 'Página não encontrada.']);
} catch (Throwable $error) {
    error_log('Thelie API: ' . $error->getMessage());
    reply(503, ['error' => 'Serviço indisponível no momento.']);
}
