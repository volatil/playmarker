<?php

return [
    '/' => 'SitioController@home',
    '/api/auth/google' => 'SitioController@loginWithGoogle',
    '/api/tablas' => 'TablasController@index',
    '/api/tablas/$1' => 'TablasController@resource',
    '/api/tablas/$1/shared' => 'TablasController@shared',
    '/api/tablas/$1/abrir' => 'TablasController@open',
    '/logout' => 'SitioController@logout',
    '/health' => 'SitioController@health',
];
