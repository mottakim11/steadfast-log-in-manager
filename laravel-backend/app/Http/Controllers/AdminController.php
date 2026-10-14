<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\AuditLog;
use App\Models\Office;
use App\Models\Setting;
use App\Models\Token;
use App\Services\JwtService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AdminController extends Controller
{
    /**
     * Public metadata for login page & quick links
     */
    public function publicInfo(): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'chromeWebStoreUrl' => Setting::getVal('chrome_web_store_url', 'https://chromewebstore.google.com/'),
            'systemTitle' => Setting::getVal('system_title', 'Steadfast Secure Auto Login')
        ]);
    }

    /**
     * Admin login
     */
    public function login(Request $request): JsonResponse
    {
        $username = trim((string)$request->input('username'));
        $password = (string)$request->input('password');

        if (empty($username) || empty($password)) {
            return response()->json([
                'ok' => false,
                'error' => 'Username and password are required'
            ], 400);
        }

        $storedUsername = Setting::getVal('admin_username', 'admin');
        $storedHash = Setting::getVal('admin_password_hash');

        if ($username !== $storedUsername) {
            return response()->json([
                'ok' => false,
                'error' => 'Invalid credentials. Only Administrator is allowed.'
            ], 401);
        }

        if (!empty($storedHash) && !password_verify($password, $storedHash)) {
            return response()->json([
                'ok' => false,
                'error' => 'Invalid credentials. Only Administrator is allowed.'
            ], 401);
        }

        $token = JwtService::sign(['username' => $username, 'role' => 'admin']);

        return response()->json([
            'ok' => true,
            'token' => $token,
            'username' => $username,
            'chromeWebStoreUrl' => Setting::getVal('chrome_web_store_url'),
            'isDefaultPassword' => ($password === 'admin123456')
        ]);
    }

    /**
     * Verify Admin Token
     */
    public function verify(Request $request): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'admin' => $request->attributes->get('admin')
        ]);
    }

    /**
     * Change Admin Password
     */
    public function changePassword(Request $request): JsonResponse
    {
        $currentPassword = (string)$request->input('currentPassword');
        $newPassword = (string)$request->input('newPassword');

        if (strlen($newPassword) < 6) {
            return response()->json([
                'ok' => false,
                'error' => 'New password must be at least 6 characters long'
            ], 400);
        }

        $storedHash = Setting::getVal('admin_password_hash');
        if (!empty($storedHash) && !password_verify($currentPassword, $storedHash)) {
            return response()->json([
                'ok' => false,
                'error' => 'Current password does not match'
            ], 400);
        }

        $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
        Setting::setVal('admin_password_hash', $newHash);

        return response()->json([
            'ok' => true,
            'message' => 'Password updated successfully!'
        ]);
    }

    // ---------------- Offices ---------------- //

    public function getOffices(): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'offices' => Office::orderBy('name')->get()
        ]);
    }

    public function createOffice(Request $request): JsonResponse
    {
        $name = trim((string)$request->input('name'));
        if (empty($name)) {
            return response()->json(['ok' => false, 'error' => 'Office name is required'], 400);
        }

        $office = Office::create([
            'id' => 'off_' . bin2hex(random_bytes(6)),
            'name' => $name,
            'code' => trim((string)$request->input('code', '')),
            'secret_key' => 'sflm_off_' . bin2hex(random_bytes(16)),
            'status' => $request->input('status', 'active')
        ]);

        return response()->json(['ok' => true, 'office' => $office]);
    }

    public function updateOffice(string $id, Request $request): JsonResponse
    {
        $office = Office::find($id);
        if (!$office) {
            return response()->json(['ok' => false, 'error' => 'Office not found'], 404);
        }

        if ($request->has('name')) $office->name = trim((string)$request->input('name'));
        if ($request->has('code')) $office->code = trim((string)$request->input('code'));
        if ($request->has('status')) $office->status = $request->input('status');
        $office->save();

        return response()->json(['ok' => true, 'office' => $office]);
    }

    public function regenerateOfficeKey(string $id): JsonResponse
    {
        $office = Office::find($id);
        if (!$office) {
            return response()->json(['ok' => false, 'error' => 'Office not found'], 404);
        }

        $office->secret_key = 'sflm_off_' . bin2hex(random_bytes(16));
        $office->save();

        return response()->json([
            'ok' => true,
            'office' => $office,
            'message' => 'Office secret key regenerated successfully!'
        ]);
    }

    public function deleteOffice(string $id): JsonResponse
    {
        Account::where('office_id', $id)->delete();
        Office::where('id', $id)->delete();

        return response()->json(['ok' => true, 'message' => 'Office deleted successfully']);
    }

    // ---------------- Accounts ---------------- //

    public function getAccounts(Request $request): JsonResponse
    {
        $officeId = $request->query('office_id');
        $query = Account::with('office')->orderBy('display_name');

        if (!empty($officeId)) {
            $query->where('office_id', $officeId);
        }

        $accounts = $query->get()->map(function ($acc) {
            return [
                'id' => $acc->id,
                'office_id' => $acc->office_id,
                'office_name' => $acc->office->name ?? 'Unknown',
                'display_name' => $acc->display_name,
                'email' => $acc->email,
                'status' => $acc->status,
                'created_at' => $acc->created_at,
                'updated_at' => $acc->updated_at
            ];
        });

        return response()->json(['ok' => true, 'accounts' => $accounts]);
    }

    public function getAccount(string $id): JsonResponse
    {
        $acc = Account::with('office')->find($id);
        if (!$acc) {
            return response()->json(['ok' => false, 'error' => 'Account not found'], 404);
        }

        return response()->json([
            'ok' => true,
            'account' => [
                'id' => $acc->id,
                'office_id' => $acc->office_id,
                'office_name' => $acc->office->name ?? 'Unknown',
                'display_name' => $acc->display_name,
                'email' => $acc->email,
                'password' => $acc->password,
                'status' => $acc->status,
                'created_at' => $acc->created_at,
                'updated_at' => $acc->updated_at
            ]
        ]);
    }

    public function createAccount(Request $request): JsonResponse
    {
        $officeId = $request->input('office_id');
        $displayName = trim((string)$request->input('display_name'));
        $email = trim((string)$request->input('email'));
        $password = (string)$request->input('password');

        if (empty($officeId) || empty($displayName) || empty($email) || empty($password)) {
            return response()->json([
                'ok' => false,
                'error' => 'Office, Display Name, Email, and Password are all required'
            ], 400);
        }

        $account = new Account();
        $account->id = 'acc_' . bin2hex(random_bytes(6));
        $account->office_id = $officeId;
        $account->display_name = $displayName;
        $account->email = $email;
        $account->password = $password;
        $account->status = $request->input('status', 'active');
        $account->save();

        return response()->json(['ok' => true, 'account' => $account]);
    }

    public function updateAccount(string $id, Request $request): JsonResponse
    {
        $acc = Account::find($id);
        if (!$acc) {
            return response()->json(['ok' => false, 'error' => 'Account not found'], 404);
        }

        if ($request->has('office_id')) $acc->office_id = $request->input('office_id');
        if ($request->has('display_name')) $acc->display_name = trim((string)$request->input('display_name'));
        if ($request->has('email')) $acc->email = trim((string)$request->input('email'));
        if ($request->filled('password')) $acc->password = (string)$request->input('password');
        if ($request->has('status')) $acc->status = $request->input('status');
        $acc->save();

        return response()->json(['ok' => true, 'account' => $acc]);
    }

    public function deleteAccount(string $id): JsonResponse
    {
        Account::where('id', $id)->delete();
        return response()->json(['ok' => true, 'message' => 'Account deleted successfully']);
    }

    // ---------------- Tokens ---------------- //

    public function getTokens(): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'tokens' => Token::orderByDesc('created_at')->get()
        ]);
    }

    public function createToken(Request $request): JsonResponse
    {
        $name = trim((string)$request->input('name'));
        if (empty($name)) {
            return response()->json(['ok' => false, 'error' => 'Token description name is required'], 400);
        }

        $token = Token::create([
            'id' => 'tok_' . bin2hex(random_bytes(6)),
            'token' => 'sflm_' . bin2hex(random_bytes(24)),
            'name' => $name,
            'allowed_office_ids' => $request->input('allowed_office_ids', 'all'),
            'status' => $request->input('status', 'active')
        ]);

        return response()->json(['ok' => true, 'token' => $token]);
    }

    public function updateToken(string $id, Request $request): JsonResponse
    {
        $token = Token::find($id);
        if (!$token) {
            return response()->json(['ok' => false, 'error' => 'Token not found'], 404);
        }

        if ($request->has('name')) $token->name = trim((string)$request->input('name'));
        if ($request->has('allowed_office_ids')) $token->allowed_office_ids = $request->input('allowed_office_ids');
        if ($request->has('status')) $token->status = $request->input('status');
        $token->save();

        return response()->json(['ok' => true, 'token' => $token]);
    }

    public function deleteToken(string $id): JsonResponse
    {
        Token::where('id', $id)->delete();
        return response()->json(['ok' => true, 'message' => 'Token deleted']);
    }

    // ---------------- Stats, Logs & Settings ---------------- //

    public function getStats(): JsonResponse
    {
        $officesCount = Office::count();
        $accountsCount = Account::count();
        $activeTokensCount = Token::where('status', 'active')->count();

        $todayPrefix = now()->format('Y-m-d');
        $todayLogins = AuditLog::where('timestamp', 'like', "{$todayPrefix}%")->count();

        return response()->json([
            'ok' => true,
            'stats' => [
                'totalOffices' => $officesCount,
                'totalAccounts' => $accountsCount,
                'activeTokens' => $activeTokensCount,
                'todayLogins' => $todayLogins
            ]
        ]);
    }

    public function getLogs(Request $request): JsonResponse
    {
        $limit = max(1, min((int)$request->query('limit', 100), 500));
        $logs = AuditLog::orderByDesc('id')->limit($limit)->get();

        return response()->json(['ok' => true, 'logs' => $logs]);
    }

    public function getSettings(): JsonResponse
    {
        $settings = Setting::all()->pluck('value', 'key')->all();
        return response()->json(['ok' => true, 'settings' => $settings]);
    }

    public function saveSettings(Request $request): JsonResponse
    {
        if ($request->has('chrome_web_store_url')) {
            Setting::setVal('chrome_web_store_url', trim((string)$request->input('chrome_web_store_url')));
        }
        if ($request->has('system_title')) {
            Setting::setVal('system_title', trim((string)$request->input('system_title')));
        }
        if ($request->filled('admin_username')) {
            Setting::setVal('admin_username', trim((string)$request->input('admin_username')));
        }

        $settings = Setting::all()->pluck('value', 'key')->all();
        return response()->json([
            'ok' => true,
            'message' => 'Settings saved successfully',
            'settings' => $settings
        ]);
    }

    // ---------------- Backup & Restore ---------------- //

    public function exportBackup(): JsonResponse
    {
        $settings = Setting::all()->pluck('value', 'key')->all();
        $offices = Office::all()->toArray();
        $accounts = Account::all()->map(function ($a) {
            return [
                'id' => $a->id,
                'office_id' => $a->office_id,
                'display_name' => $a->display_name,
                'email_cipher' => $a->email_cipher,
                'password_cipher' => $a->password_cipher,
                'status' => $a->status,
                'created_at' => $a->created_at,
                'updated_at' => $a->updated_at
            ];
        })->toArray();
        $tokens = Token::all()->toArray();
        $auditLogs = AuditLog::orderByDesc('id')->limit(500)->get()->toArray();

        $data = [
            'settings' => $settings,
            'offices' => $offices,
            'accounts' => $accounts,
            'tokens' => $tokens,
            'audit_logs' => $auditLogs
        ];

        $dateStr = now()->format('Y-m-d');
        return response()->json($data)
            ->header('Content-Disposition', 'attachment; filename="steadfast_backup_' . $dateStr . '.json"');
    }

    public function importBackup(Request $request): JsonResponse
    {
        $backupData = $request->input('backupData');
        if (!is_array($backupData) || (!isset($backupData['offices']) && !isset($backupData['accounts']))) {
            return response()->json(['ok' => false, 'error' => 'Invalid backup format'], 400);
        }

        if (!empty($backupData['settings']) && is_array($backupData['settings'])) {
            foreach ($backupData['settings'] as $k => $v) {
                Setting::setVal($k, $v);
            }
        }

        if (!empty($backupData['offices']) && is_array($backupData['offices'])) {
            foreach ($backupData['offices'] as $off) {
                Office::updateOrCreate(
                    ['id' => $off['id']],
                    [
                        'name' => $off['name'],
                        'code' => $off['code'] ?? null,
                        'secret_key' => $off['secret_key'] ?? ('sflm_off_' . bin2hex(random_bytes(16))),
                        'status' => $off['status'] ?? 'active',
                        'created_at' => $off['created_at'] ?? now(),
                        'updated_at' => now()
                    ]
                );
            }
        }

        if (!empty($backupData['accounts']) && is_array($backupData['accounts'])) {
            foreach ($backupData['accounts'] as $acc) {
                Account::updateOrCreate(
                    ['id' => $acc['id']],
                    [
                        'office_id' => $acc['office_id'],
                        'display_name' => $acc['display_name'],
                        'email_cipher' => $acc['email_cipher'],
                        'password_cipher' => $acc['password_cipher'],
                        'status' => $acc['status'] ?? 'active',
                        'created_at' => $acc['created_at'] ?? now(),
                        'updated_at' => $acc['updated_at'] ?? now()
                    ]
                );
            }
        }

        if (!empty($backupData['tokens']) && is_array($backupData['tokens'])) {
            foreach ($backupData['tokens'] as $tok) {
                Token::updateOrCreate(
                    ['id' => $tok['id']],
                    [
                        'token' => $tok['token'],
                        'name' => $tok['name'],
                        'allowed_office_ids' => $tok['allowed_office_ids'] ?? 'all',
                        'status' => $tok['status'] ?? 'active',
                        'created_at' => $tok['created_at'] ?? now(),
                        'updated_at' => now()
                    ]
                );
            }
        }

        return response()->json([
            'ok' => true,
            'message' => 'Database backup restored successfully!'
        ]);
    }
}
