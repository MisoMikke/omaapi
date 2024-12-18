<?php
// tarvii tietokanta tunnukset tiedostosta
require_once 'db_connection.php';
// tarvii toimiakseen nämä alla olevat määritykset
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

// errorit pitäisi näkyä näillä konfiguroinneilla
ini_set('display_errors', 0); // virheet poistetaan näkyvistä
ini_set('log_errors', 1);    // kirjaa virheet lokiin

//haetaan action parametri
$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'addSession':
            // lisää uuden session tietokantaan, käyttäjän id, aine, päivä ja kesto
            $data = json_decode(file_get_contents("php://input"), true);

            // tarkastetaan että tiedot saadaan
            if (isset($data['user_id'], $data['subject_id'], $data['session_duration'])) {
                $stmt = $pdo->prepare("INSERT INTO user_sessions (user_id, subject_id, session_date, session_duration) VALUES (?, ?, ?, ?)");

                // kysely tiedoilla
                $stmt->execute([
                    $data['user_id'],
                    $data['subject_id'],
                    date("Y-m-d"), //nykyinen päivä
                    $data['session_duration']
                ]);
                echo json_encode(["status" => "success", "message" => "Session added successfully."]);
            } else {
                echo json_encode(["status" => "error", "message" => "Missing required data."]);
            }
            break;

        case 'getRecentSessions':
            // haetaan viimeisimmät sessiot sivutuksen avulla
            $page = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
            $limit = isset($_GET['limit']) ? max(1, (int) $_GET['limit']) : 10;

            // lasketaan offset eli mistä kohtaa data haetaan sivutukseen
            $offset = ($page - 1) * $limit;

            //laskee kaikki sessiot sivutusta varten
            $totalStmt = $pdo->query("SELECT COUNT(*) AS total FROM user_sessions");
            $total_count = $totalStmt->fetchColumn();

            // haetaan sessiot käyttäen LIMIT ja OFFSET arvoja, 10 tulosta kerrallaan ja seuraavat ovat uusi setti, oma sivunsa
            $stmt = $pdo->prepare("
                SELECT us.session_id, u.username AS user_name, s.subject_name, us.session_date, us.session_duration
                FROM user_sessions us
                JOIN users u ON us.user_id = u.user_id
                JOIN subjects s ON us.subject_id = s.subject_id
                ORDER BY us.session_date DESC
                LIMIT :limit OFFSET :offset
            ");
            $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindParam(':offset', $offset, PDO::PARAM_INT);

            //palauttaa json listana
            $stmt->execute();
            $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // palauttaa sessiot ja niiden kokonaismäärän
            echo json_encode([
                "sessions" => $sessions,
                "total_count" => $total_count
            ]);
            break;

        case 'getUsersAndSubjects':
            // hakee listan missä käyttäjät ja aineet
            $usersStmt = $pdo->query("SELECT user_id, username FROM users");
            $subjectsStmt = $pdo->query("SELECT subject_id, subject_name FROM subjects");

            // palauttaa json muodossa
            echo json_encode([
                "users" => $usersStmt->fetchAll(PDO::FETCH_ASSOC),
                "subjects" => $subjectsStmt->fetchAll(PDO::FETCH_ASSOC)
            ]);
            break;

        case 'getDailyProgress':
            // laskee käyttäjän edistymisen
            $user_id = $_GET['user_id'] ?? 0;
            $today = date("Y-m-d"); // nykyinen päivä
            $weekStartDate = date('Y-m-d', strtotime('monday this week'));

            //laskee päivän kokonais edistymisen käyttäjälle
            $progressStmt = $pdo->prepare("
                SELECT SUM(session_duration) AS total_duration_today
                FROM user_sessions
                WHERE user_id = :user_id AND session_date = :today
            ");
            $progressStmt->execute(['user_id' => $user_id, 'today' => $today]);
            $total_duration_today = $progressStmt->fetchColumn() ?? 0;

            //laskee viikon kokonais edistymisen käyttäjälle
            $weeklyProgressStmt = $pdo->prepare("
                SELECT SUM(session_duration) AS total_duration_week
                FROM user_sessions
                WHERE user_id = :user_id AND session_date >= :weekStartDate
            ");

            //hakee tietokannasta users taulusta päivän ja viikon tavoite ajan
            $weeklyProgressStmt->execute(['user_id' => $user_id, 'weekStartDate' => $weekStartDate]);
            $total_duration_week = $weeklyProgressStmt->fetchColumn() ?? 0;
            $goalStmt = $pdo->prepare("
                SELECT daily_goal_minutes, weekly_goal_hours
                FROM users
                WHERE user_id = :user_id
            ");
            $goalStmt->execute(['user_id' => $user_id]);
            $goals = $goalStmt->fetch(PDO::FETCH_ASSOC);

            //jos tietoja ei löytyisikään, default on 60 minuuttia päivä, 7 tuntia viikko
            $daily_goal = $goals['daily_goal_minutes'] ?? 60;
            $weekly_goal = $goals['weekly_goal_hours'] ?? 7;

            // laske prosentuaalinen määrä
            $daily_progress = min(100, ($total_duration_today / $daily_goal) * 100);
            $weekly_progress = min(100, ($total_duration_week / ($weekly_goal * 60)) * 100); // viikoittainen on tunteina niin muutetaan minuuteiksi

            //palauttaa edistymis datan jsonina
            echo json_encode([
                "total_duration_today" => $total_duration_today,
                "daily_goal" => $daily_goal,
                "daily_progress" => $daily_progress,
                "total_duration_week" => $total_duration_week,
                "weekly_goal" => $weekly_goal,
                "weekly_progress" => $weekly_progress
            ]);
            break;

        case 'deleteSession':
            // poistaa session tietokannasta
            $data = json_decode(file_get_contents("php://input"), true);
        
            // tarkastaa json tietoa
            if (json_last_error() !== JSON_ERROR_NONE) {
                echo json_encode(["status" => "error", "message" => "Invalid JSON input"]);
                exit;
            }

            // tarkastaa että 'session_id' on annettu oikein
            if (isset($data['session_id']) && is_numeric($data['session_id'])) {
                $stmt = $pdo->prepare("DELETE FROM user_sessions WHERE session_id = ?");
                $stmt->execute([$data['session_id']]);
        
                //tarkastaa postettiinko rivi onnistuneesti vai ei
                if ($stmt->rowCount() > 0) {
                    echo json_encode(["status" => "success", "message" => "Session deleted successfully."]);
                } else {
                    echo json_encode(["status" => "error", "message" => "Session not found or could not be deleted."]);
                }
            } else {
                echo json_encode(["status" => "error", "message" => "Missing or invalid session_id."]);
            }
            break;

        case 'modifySession':
            //muokaa session tietoja
            $data = json_decode(file_get_contents("php://input"), true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                echo json_encode(["status" => "error", "message" => "Invalid JSON input"]);
                exit;
            }

            //tarkistetaan että kaikki tarvittavat tiedot on annettu
            if (isset($data['session_id'], $data['subject_id'], $data['session_duration']) &&
                is_numeric($data['session_id']) && is_numeric($data['session_duration'])) {

                $stmt = $pdo->prepare("UPDATE user_sessions SET subject_id = ?, session_duration = ? WHERE session_id = ?");
                $stmt->execute([
                    $data['subject_id'],
                    $data['session_duration'],
                    $data['session_id']
                ]);

                //tarkastetaan päivittyykö rivi
                if ($stmt->rowCount() > 0) {
                    echo json_encode(["status" => "success", "message" => "Session edited successfully"]);
                } else {
                    echo json_encode(["status" => "error", "message" => "Session could not be found or modified."]);
                }
            } else {
                echo json_encode(["status" => "error", "message" => "Missing or invalid data."]);
            }
            break;

        default:
            // jos tulee virheellinen toiminto
            echo json_encode(["status" => "error", "message" => "Invalid action"]);
    }
} catch (Exception $e) {
    // jos tulee error
    echo json_encode(["status" => "error", "message" => "Server error: " . $e->getMessage()]);
}
?>
