<?php

declare(strict_types=1);

class SitioController extends MainController
{
    private const USER_PROVIDER = 'google';

    public function home(): void
    {
        if (!is_logged_in()) {
            $meta = $this->metaDefaults();
            $meta['title'] = 'Iniciar sesion | PlayMarker';
            $meta['description'] = 'Accede con Google para usar PlayMarker.';
            $meta['ogDescription'] = $meta['description'];
            $meta['scripts'] = [];

            $this->render('sitio/login.php', [
                'meta' => $meta,
                'googleClientId' => google_client_id(),
            ]);
        }

        $this->render('sitio/home.php', [
            'meta' => $this->metaDefaults(),
            'user' => current_user(),
        ]);
    }

    public function health(): void
    {
        $this->renderJson([
            'ok' => true,
            'app' => 'playmarker',
        ]);
    }

    public function loginWithGoogle(): void
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->renderJson([
                'success' => false,
                'message' => 'Metodo no permitido.',
            ], 405);
        }

        $payload = json_decode((string) ($_POST['losdatos'] ?? ''), true);

        if (!is_array($payload)) {
            $this->renderJson([
                'success' => false,
                'message' => 'No se recibieron datos validos.',
            ], 422);
        }

        $token = trim((string) ($payload['idtoken'] ?? ''));

        if ($token === '') {
            $this->renderJson([
                'success' => false,
                'message' => 'No se recibio el ID Token.',
            ], 422);
        }

        $googleUser = $this->decodeGoogleIdToken($token);

        if (
            !$googleUser ||
            !isset($googleUser->sub) ||
            trim((string) $googleUser->sub) === '' ||
            !isset($googleUser->email) ||
            trim((string) $googleUser->email) === ''
        ) {
            $this->renderJson([
                'success' => false,
                'message' => 'No se pudo validar el token de Google.',
            ], 422);
        }

        $googleUserData = [
            'id' => app_uuid_v4(),
            'google_sub' => trim((string) $googleUser->sub),
            'email' => trim((string) $googleUser->email),
            'email_verified' => $this->googleEmailVerifiedToInt($googleUser->email_verified ?? false),
            'full_name' => $this->nullableString($googleUser->name ?? null),
            'given_name' => $this->nullableString($googleUser->given_name ?? null),
            'family_name' => $this->nullableString($googleUser->family_name ?? null),
            'avatar_url' => $this->nullableString($googleUser->picture ?? null),
            'locale' => $this->nullableString($googleUser->locale ?? null),
            'provider' => self::USER_PROVIDER,
        ];

        try {
            $user = $this->upsertGoogleUser($googleUserData);
        } catch (Throwable $exception) {
            error_log('Error persistiendo usuario Google: ' . $exception->getMessage());

            $this->renderJson([
                'success' => false,
                'message' => 'No se pudo guardar el usuario en la base de datos.',
            ], 500);
        }

        $_SESSION['user'] = (object) [
            'id' => (string) $user['id'],
            'google_sub' => (string) $user['google_sub'],
            'email' => (string) $user['email'],
            'email_verified' => (bool) $user['email_verified'],
            'name' => trim((string) ($user['full_name'] ?? '')) !== ''
                ? (string) $user['full_name']
                : (string) $user['email'],
            'given_name' => $user['given_name'],
            'family_name' => $user['family_name'],
            'picture' => (string) ($user['avatar_url'] ?? ''),
            'locale' => $user['locale'],
            'provider' => (string) $user['provider'],
            'last_login_at' => $user['last_login_at'],
        ];

        $this->renderJson([
            'success' => true,
            'message' => 'Acceso autorizado.',
            'user' => $_SESSION['user'],
        ]);
    }

    public function logout(): void
    {
        unset($_SESSION['user']);
        header('Location: ' . app_url('/'));
        exit;
    }

    public function error404(): void
    {
        http_response_code(404);

        $meta = $this->metaDefaults();
        $meta['title'] = '404 | PlayMarker';
        $meta['scripts'] = [];

        $this->render('error404.php', [
            'meta' => $meta,
        ]);
    }

    private function upsertGoogleUser(array $googleUserData): array
    {
        $pdo = db_connection();
        $statement = $pdo->prepare(
            'INSERT INTO usuarios (
                id,
                google_sub,
                email,
                email_verified,
                full_name,
                given_name,
                family_name,
                avatar_url,
                locale,
                provider,
                last_login_at
            ) VALUES (
                :id,
                :google_sub,
                :email,
                :email_verified,
                :full_name,
                :given_name,
                :family_name,
                :avatar_url,
                :locale,
                :provider,
                CURRENT_TIMESTAMP
            )
            ON DUPLICATE KEY UPDATE
                email = VALUES(email),
                email_verified = VALUES(email_verified),
                full_name = VALUES(full_name),
                given_name = VALUES(given_name),
                family_name = VALUES(family_name),
                avatar_url = VALUES(avatar_url),
                locale = VALUES(locale),
                provider = VALUES(provider),
                last_login_at = CURRENT_TIMESTAMP'
        );

        $statement->execute($googleUserData);

        $selectStatement = $pdo->prepare(
            'SELECT
                id,
                google_sub,
                email,
                email_verified,
                full_name,
                given_name,
                family_name,
                avatar_url,
                locale,
                provider,
                last_login_at
            FROM usuarios
            WHERE google_sub = :google_sub
            LIMIT 1'
        );
        $selectStatement->execute([
            'google_sub' => $googleUserData['google_sub'],
        ]);

        $user = $selectStatement->fetch();

        if (!is_array($user)) {
            throw new RuntimeException('No se pudo recuperar el usuario persistido.');
        }

        return $user;
    }

    private function nullableString(mixed $value): ?string
    {
        $normalized = trim((string) ($value ?? ''));

        return $normalized === '' ? null : $normalized;
    }

    private function googleEmailVerifiedToInt(mixed $value): int
    {
        if (is_bool($value)) {
            return $value ? 1 : 0;
        }

        $normalized = strtolower(trim((string) $value));

        return in_array($normalized, ['1', 'true', 'yes'], true) ? 1 : 0;
    }
}
