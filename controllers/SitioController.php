<?php

declare(strict_types=1);

class SitioController extends MainController
{
    public function home(): void
    {
        $this->render('sitio/home.php', [
            'meta' => $this->metaDefaults(),
        ]);
    }

    public function health(): void
    {
        $this->renderJson([
            'ok' => true,
            'app' => 'playmarker',
        ]);
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
