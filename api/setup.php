<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer');

$privateFile = dirname(__DIR__, 2) . '/thelie-config.php';
$localFile = __DIR__ . '/config.local.php';
$configured = is_file($privateFile) || is_file($localFile);
$error = '';
$success = false;

session_start([
    'cookie_httponly' => true,
    'cookie_samesite' => 'Strict',
    'cookie_secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'
]);
if (!isset($_SESSION['setup_csrf'])) {
    $_SESSION['setup_csrf'] = bin2hex(random_bytes(32));
}

if (!$configured && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $csrf = (string) ($_POST['csrf'] ?? '');
    $password = (string) ($_POST['password'] ?? '');
    if (!hash_equals($_SESSION['setup_csrf'], $csrf) || $password === '') {
        $error = 'Informe a senha do banco e tente novamente.';
    } else {
        $config = [
            'host' => getenv('THELIE_DB_HOST') ?: 'localhost',
            'port' => getenv('THELIE_DB_PORT') ?: '3306',
            'name' => getenv('THELIE_DB_NAME') ?: 'u901531260_thelie',
            'user' => getenv('THELIE_DB_USER') ?: 'u901531260_thelie',
            'password' => $password
        ];
        try {
            $test = new PDO(
                'mysql:host=' . $config['host'] . ';port=' . $config['port'] . ';dbname=' . $config['name'] . ';charset=utf8mb4',
                $config['user'], $password,
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
            );
            $test->query('SELECT 1');
            $contents = "<?php\ndeclare(strict_types=1);\n\nreturn " . var_export($config, true) . ";\n";
            $destination = null;
            foreach ([$privateFile, $localFile] as $candidate) {
                if (@file_put_contents($candidate, $contents, LOCK_EX) !== false) {
                    $destination = $candidate;
                    break;
                }
            }
            if ($destination === null) {
                throw new RuntimeException('Não foi possível salvar a configuração.');
            }
            @chmod($destination, 0600);
            try {
                require_once __DIR__ . '/bootstrap.php';
                ready_database();
                $configured = true;
                $success = true;
            } catch (Throwable $bootstrapError) {
                unlink($destination);
                throw $bootstrapError;
            }
        } catch (Throwable $exception) {
            error_log('Thelie setup: ' . $exception->getMessage());
            $error = 'Não foi possível conectar e preparar o banco. Confira a senha MySQL.';
        }
    }
}
?><!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>Configuração · Thê-lie Cerâmico</title>
    <link rel="icon" type="image/svg+xml" href="../favicon.svg">
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Jost:wght@400;500&display=swap" rel="stylesheet">
    <style>
        body{margin:0;min-height:100vh;display:grid;place-items:center;background:#faf4e8;color:#3d1c0a;font-family:Jost,sans-serif;padding:18px;box-sizing:border-box}
        main{background:#fffaf2;border:1px solid #e6d6c6;width:min(440px,100%);padding:40px;box-sizing:border-box}
        h1{font:500 38px/1.1 'Cormorant Garamond',serif;margin:10px 0 18px}
        p{font-size:14px;line-height:1.6;color:#795940}.eyebrow{text-transform:uppercase;letter-spacing:.2em;color:#a0522d;font-size:10px}
        label{display:block;font-size:12px;color:#8b4513;margin-top:25px}input{display:block;width:100%;padding:12px;box-sizing:border-box;margin-top:8px;border:1px solid #e6d6c6;font:inherit}
        button{margin-top:20px;width:100%;padding:14px;border:0;background:#8b4513;color:white;font:500 12px Jost,sans-serif;letter-spacing:.1em;cursor:pointer}
        .error{color:#a42d20}
    </style>
</head>
<body><main>
    <p class="eyebrow">Configuração inicial</p>
    <h1>Conectar o ateliê ao banco</h1>
    <?php if ($configured): ?>
        <p><?= $success ? 'Banco conectado. As nove peças e os dois administradores foram cadastrados.' : 'Este site já está configurado.' ?></p>
        <p><a href="../index.html">Voltar ao site</a></p>
    <?php else: ?>
        <p>Informe a senha do usuário MySQL <strong>u901531260_thelie</strong>. Ela ficará salva apenas na hospedagem, fora do GitHub.</p>
        <?php if ($error): ?><p class="error" role="alert"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></p><?php endif; ?>
        <form method="post" autocomplete="off">
            <input type="hidden" name="csrf" value="<?= htmlspecialchars($_SESSION['setup_csrf'], ENT_QUOTES, 'UTF-8') ?>">
            <label>Senha do banco MySQL<input type="password" name="password" required autocomplete="new-password"></label>
            <button type="submit">Conectar e preparar o banco</button>
        </form>
    <?php endif; ?>
</main></body>
</html>
