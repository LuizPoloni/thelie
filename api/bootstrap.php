<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

function ready_database(): PDO
{
    static $ready = false;
    $pdo = database();
    if ($ready) {
        return $pdo;
    }

    try {
        $pdo->query('SELECT 1 FROM install_state LIMIT 1');
    } catch (PDOException $error) {
        if ($error->getCode() !== '42S02') {
            throw $error;
        }
        $schema = file_get_contents(__DIR__ . '/../database/schema.sql');
        foreach (explode(';', $schema) as $statement) {
            if (trim($statement) !== '') {
                $pdo->exec($statement);
            }
        }
    }

    $count = (int) $pdo->query('SELECT COUNT(*) FROM products')->fetchColumn();
    if ($count === 0) {
        $rows = require __DIR__ . '/../database/seed-products.php';
        $insert = $pdo->prepare(
            'INSERT IGNORE INTO products
            (slug, section, sort_order, category, kicker, title, description, quote_text, photo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ($rows as [$slug, $section, $order, $category, $kicker, $title, $description, $quote, $filename]) {
            $photo = file_get_contents(__DIR__ . '/../assets/the-lie/' . $filename);
            if ($photo === false) {
                throw new RuntimeException('Seed image missing: ' . $filename);
            }
            $insert->execute([$slug, $section, $order, $category, $kicker, $title, $description, $quote, $photo]);
        }
    }

    $state = $pdo->query('SELECT users_seeded FROM install_state WHERE id = 1')->fetchColumn();
    if ((int) $state === 0) {
        $pdo->beginTransaction();
        try {
            $pdo->exec('INSERT IGNORE INTO install_state (id, users_seeded) VALUES (1, 0)');
            $state = $pdo->query('SELECT users_seeded FROM install_state WHERE id = 1 FOR UPDATE')->fetchColumn();
            if ((int) $state === 0) {
                $users = require __DIR__ . '/../database/seed-users.php';
                $insertUser = $pdo->prepare(
                    'INSERT IGNORE INTO users
                     (username, display_name, email, role, password_hash, must_change_password)
                     VALUES (?, ?, ?, "admin", ?, 1)'
                );
                foreach ($users as $user) {
                    $insertUser->execute([
                        $user['username'], $user['display_name'], $user['email'], $user['hash']
                    ]);
                }
                $pdo->exec('UPDATE install_state SET users_seeded = 1 WHERE id = 1');
            }
            $pdo->commit();
        } catch (Throwable $error) {
            $pdo->rollBack();
            throw $error;
        }
    }

    $ready = true;
    return $pdo;
}
