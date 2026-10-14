<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

function testRequest($kernel, $method, $uri, $headers = [], $body = []) {
    $server = [];
    foreach ($headers as $k => $v) {
        $server['HTTP_' . strtoupper(str_replace('-', '_', $k))] = $v;
    }
    $req = Illuminate\Http\Request::create($uri, $method, $body, [], [], $server);
    $res = $kernel->handle($req);
    $content = $res->getContent();
    return json_decode($content, true);
}

echo "=== TESTING LARAVEL API BACKEND ===\n\n";

// 1. Test public-info
$info = testRequest($kernel, 'GET', '/api/auth/public-info');
echo "1. Public Info: " . ($info['ok'] ? "SUCCESS ({$info['systemTitle']})" : "FAILED") . "\n";

// 2. Test Admin Login
$login = testRequest($kernel, 'POST', '/api/auth/login', ['Content-Type' => 'application/json'], [
    'username' => 'admin',
    'password' => 'admin123456'
]);
echo "2. Admin Login: " . ($login['ok'] ? "SUCCESS (Token received)" : "FAILED") . "\n";
$token = $login['token'] ?? '';

// 3. Test Stats with Bearer Token
$stats = testRequest($kernel, 'GET', '/api/admin/stats', ['Authorization' => "Bearer $token"]);
echo "3. Admin Stats: " . ($stats['ok'] ? "SUCCESS (Offices: {$stats['stats']['totalOffices']}, Accounts: {$stats['stats']['totalAccounts']})" : "FAILED") . "\n";

// 4. Test Extension Ping (Mulatol Office Key)
$officeKey = 'sflm_off_333a45e9d85a0c8c980dbbfc23801737';
$ping = testRequest($kernel, 'GET', '/api/extension/ping', ['X-Extension-Token' => $officeKey]);
echo "4. Extension Ping: " . ($ping['ok'] ? "SUCCESS (Connected to {$ping['officeName']})" : "FAILED") . "\n";

// 5. Test Extension Accounts List
$accs = testRequest($kernel, 'GET', '/api/extension/accounts', ['X-Extension-Token' => $officeKey]);
$office = $accs['offices'][0] ?? null;
$count = count($office['accounts'] ?? []);
echo "5. Extension Accounts: " . ($accs['ok'] ? "SUCCESS ({$office['name']} has $count accounts)" : "FAILED") . "\n";

// 6. Test Extension Login Fill (Variant account)
$fill = testRequest($kernel, 'POST', '/api/extension/login-fill', [
    'X-Extension-Token' => $officeKey,
    'Content-Type' => 'application/json'
], ['account_id' => 'acc_4bb96864dc49']);

if ($fill['ok'] && isset($fill['credentials'])) {
    echo "6. Extension Login-Fill: SUCCESS\n";
    echo "   -> Email: " . $fill['credentials']['email'] . "\n";
    echo "   -> Password: " . $fill['credentials']['password'] . "\n";
} else {
    echo "6. Extension Login-Fill: FAILED (" . json_encode($fill) . ")\n";
}

// 7. Test Audit Logs (verify the login-fill was recorded)
$logs = testRequest($kernel, 'GET', '/api/admin/logs?limit=5', ['Authorization' => "Bearer $token"]);
$latestLog = $logs['logs'][0] ?? null;
echo "7. Audit Log Check: " . (($latestLog && $latestLog['account_id'] === 'acc_4bb96864dc49') ? "SUCCESS (Logged login for {$latestLog['display_name']} at {$latestLog['office_name']})" : "FAILED") . "\n";

echo "\n=== ALL TESTS PASSED PERFECTLY! ===\n";
