<?php

namespace Database\Seeders;

use App\Models\Setting;
use App\Models\Office;
use App\Models\Account;
use App\Models\Token;
use App\Models\AuditLog;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $jsonPath = storage_path('data/database.json');
        if (!File::exists($jsonPath)) {
            $jsonPath = base_path('../server/data/database.json');
        }

        if (!File::exists($jsonPath)) {
            $this->command->warn('No database.json found to seed.');
            return;
        }

        $data = json_decode(File::get($jsonPath), true);
        if (!$data || !is_array($data)) {
            $this->command->error('Invalid database.json format.');
            return;
        }

        // 1. Settings
        if (!empty($data['settings']) && is_array($data['settings'])) {
            foreach ($data['settings'] as $key => $value) {
                Setting::updateOrCreate(['key' => $key], ['value' => $value]);
            }
        }

        // 2. Offices
        if (!empty($data['offices']) && is_array($data['offices'])) {
            foreach ($data['offices'] as $off) {
                Office::updateOrCreate(
                    ['id' => $off['id']],
                    [
                        'name' => $off['name'],
                        'code' => $off['code'] ?? null,
                        'secret_key' => $off['secret_key'] ?? ('sflm_off_' . bin2hex(random_bytes(16))),
                        'status' => $off['status'] ?? 'active',
                        'created_at' => $off['created_at'] ?? now(),
                        'updated_at' => now(),
                    ]
                );
            }
        }

        // 3. Accounts
        if (!empty($data['accounts']) && is_array($data['accounts'])) {
            foreach ($data['accounts'] as $acc) {
                // Use raw cipher fields to preserve exact cipher text
                Account::updateOrCreate(
                    ['id' => $acc['id']],
                    [
                        'office_id' => $acc['office_id'],
                        'display_name' => $acc['display_name'],
                        'email_cipher' => $acc['email_cipher'],
                        'password_cipher' => $acc['password_cipher'],
                        'status' => $acc['status'] ?? 'active',
                        'created_at' => $acc['created_at'] ?? now(),
                        'updated_at' => $acc['updated_at'] ?? now(),
                    ]
                );
            }
        }

        // 4. Tokens
        if (!empty($data['tokens']) && is_array($data['tokens'])) {
            foreach ($data['tokens'] as $tok) {
                Token::updateOrCreate(
                    ['id' => $tok['id']],
                    [
                        'token' => $tok['token'],
                        'name' => $tok['name'],
                        'allowed_office_ids' => $tok['allowed_office_ids'] ?? 'all',
                        'status' => $tok['status'] ?? 'active',
                        'created_at' => $tok['created_at'] ?? now(),
                        'updated_at' => now(),
                    ]
                );
            }
        }

        // 5. Audit logs
        if (!empty($data['audit_logs']) && is_array($data['audit_logs'])) {
            foreach ($data['audit_logs'] as $log) {
                AuditLog::updateOrCreate(
                    ['id' => $log['id']],
                    [
                        'timestamp' => $log['timestamp'] ?? now()->toIso8601String(),
                        'account_id' => $log['account_id'] ?? null,
                        'office_name' => $log['office_name'] ?? null,
                        'display_name' => $log['display_name'] ?? null,
                        'token_name' => $log['token_name'] ?? null,
                        'ip' => $log['ip'] ?? null,
                        'user_agent' => $log['user_agent'] ?? null,
                        'status' => $log['status'] ?? 'success',
                    ]
                );
            }
        }

        $this->command->info('Steadfast Secure Login Manager database seeded successfully!');
    }
}
