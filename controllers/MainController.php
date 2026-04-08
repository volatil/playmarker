<?php

declare(strict_types=1);

class MainController
{
    protected function render(string $view, array $params = [], string $layout = 'main'): void
    {
        $viewPath = APP_ROOT . '/views/' . ltrim($view, '/');
        $layoutPath = APP_ROOT . '/templates/layout/' . $layout . '/index.php';

        if (!file_exists($viewPath)) {
            http_response_code(500);
            echo 'Vista no encontrada.';
            exit;
        }

        extract($params, EXTR_SKIP);

        if (file_exists($layoutPath)) {
            include $layoutPath;
            exit;
        }

        include $viewPath;
        exit;
    }

    protected function renderJson(array $data, int $statusCode = 200): void
    {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    protected function metaDefaults(): array
    {
        return [
            'title' => 'PlayMarker',
            'description' => 'Organiza alineaciones, mueve fichas y ajusta posiciones sobre la cancha con PlayMarker.',
            'ogTitle' => 'PlayMarker',
            'ogDescription' => 'Organiza alineaciones, mueve fichas y ajusta posiciones sobre la cancha.',
            'ogImage' => asset_url('images/og-image.png'),
            'faviconSvg' => asset_url('images/favicon.svg'),
            'faviconIco' => asset_url('images/favicon.ico'),
            'stylesheets' => [
                asset_url('css/styles.css'),
            ],
            'scripts' => [
                asset_url('js/app.js'),
            ],
        ];
    }
}
