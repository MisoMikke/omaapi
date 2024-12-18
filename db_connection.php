<?php
// näillä tiedosto toimii, sis CORS JSON
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
// tunnukset ja käytettävä tietokanta
$host = 'localhost';
$db = 'learning_tracker';
$user = 'root';  // default tunnukset, muutettavissa
$pass = '';
$charset = 'utf8mb4';
//$host = 'localhost';
//$db = 'somi2';
//$user = 'somi2';  // näillä geronimon tietokantaan, mutta pitäisi olla projekti siellä kai että toimisi
//$pass = 'kaut1234';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    die("Database connection failed: " . $e->getMessage());
}
