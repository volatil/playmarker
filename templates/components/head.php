<?php
$meta = $meta ?? [];
$title = $meta['title'] ?? 'PlayMarker';
$description = $meta['description'] ?? '';
$ogTitle = $meta['ogTitle'] ?? $title;
$ogDescription = $meta['ogDescription'] ?? $description;
$ogImage = $meta['ogImage'] ?? '';
$faviconIco = $meta['faviconIco'] ?? '';
$stylesheets = $meta['stylesheets'] ?? [];
?>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= htmlspecialchars($title, ENT_QUOTES, 'UTF-8') ?></title>
<meta name="description" content="<?= htmlspecialchars($description, ENT_QUOTES, 'UTF-8') ?>">
<meta property="og:title" content="<?= htmlspecialchars($ogTitle, ENT_QUOTES, 'UTF-8') ?>">
<meta property="og:description" content="<?= htmlspecialchars($ogDescription, ENT_QUOTES, 'UTF-8') ?>">
<meta property="og:type" content="website">
<meta property="og:image" content="<?= htmlspecialchars($ogImage, ENT_QUOTES, 'UTF-8') ?>">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="<?= htmlspecialchars($ogTitle, ENT_QUOTES, 'UTF-8') ?>">
<meta name="twitter:description" content="<?= htmlspecialchars($ogDescription, ENT_QUOTES, 'UTF-8') ?>">
<meta name="twitter:image" content="<?= htmlspecialchars($ogImage, ENT_QUOTES, 'UTF-8') ?>">
<?php if ($faviconIco !== ''): ?>
<link rel="alternate icon" href="<?= htmlspecialchars($faviconIco, ENT_QUOTES, 'UTF-8') ?>" sizes="any">
<?php endif; ?>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;700&family=Manrope:wght@400;500;700&display=swap" rel="stylesheet">
<?php foreach ($stylesheets as $stylesheet): ?>
<link rel="stylesheet" href="<?= htmlspecialchars($stylesheet, ENT_QUOTES, 'UTF-8') ?>">
<?php endforeach; ?>
