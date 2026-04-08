<?php

declare(strict_types=1);

class SitioController extends MainController
{
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

        if (!$googleUser || !isset($googleUser->email)) {
            $this->renderJson([
                'success' => false,
                'message' => 'No se pudo validar el token de Google.',
            ], 422);
        }

        $_SESSION['user'] = (object) [
            'email' => (string) $googleUser->email,
            'name' => trim((string) ($googleUser->name ?? '')) !== ''
                ? (string) $googleUser->name
                : (string) $googleUser->email,
            'picture' => (string) ($googleUser->picture ?? ''),
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
}
