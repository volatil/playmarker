<?php

return [
    '/' => 'SitioController@home',
    '/api/auth/google' => 'SitioController@loginWithGoogle',
    '/logout' => 'SitioController@logout',
    '/health' => 'SitioController@health',
];
