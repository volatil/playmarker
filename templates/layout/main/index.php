<?php $scripts = $meta['scripts'] ?? []; ?>
<!DOCTYPE html>
<html lang="es">
<head>
    <?php include APP_ROOT . '/templates/components/head.php'; ?>
</head>
<body>
    <?php include $viewPath; ?>

    <?php foreach ($scripts as $script): ?>
    <script src="<?= htmlspecialchars($script, ENT_QUOTES, 'UTF-8') ?>"></script>
    <?php endforeach; ?>
</body>
</html>
