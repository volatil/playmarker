CREATE TABLE IF NOT EXISTS usuarios (
    id CHAR(36) NOT NULL,
    google_sub VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    email_verified TINYINT(1) NOT NULL DEFAULT 0,
    full_name VARCHAR(255) NULL,
    given_name VARCHAR(255) NULL,
    family_name VARCHAR(255) NULL,
    avatar_url TEXT NULL,
    locale VARCHAR(32) NULL,
    provider VARCHAR(32) NOT NULL DEFAULT 'google',
    last_login_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_usuarios_google_sub (google_sub),
    UNIQUE KEY uq_usuarios_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tablas (
    id CHAR(36) NOT NULL,
    usuario_id CHAR(36) NOT NULL,
    nombre VARCHAR(64) NOT NULL,
    codigo_compartir VARCHAR(64) NULL,
    estado_json LONGTEXT NOT NULL,
    es_publica TINYINT(1) NOT NULL DEFAULT 0,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ultima_vez_abierta_en TIMESTAMP NULL DEFAULT NULL,
    eliminado_en TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tablas_codigo_compartir (codigo_compartir),
    KEY idx_tablas_usuario_id (usuario_id),
    KEY idx_tablas_usuario_abierta (usuario_id, ultima_vez_abierta_en),
    KEY idx_tablas_usuario_actualizada (usuario_id, actualizado_en),
    CONSTRAINT fk_tablas_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
