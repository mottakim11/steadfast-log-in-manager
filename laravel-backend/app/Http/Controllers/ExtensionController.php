<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\AuditLog;
use App\Models\Office;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExtensionController extends Controller
{
    /**
     * Ping endpoint for testing extension connectivity
     */
    public function ping(Request $request): JsonResponse
    {
        $token = $request->attributes->get('extensionToken');

        return response()->json([
            'ok' => true,
            'server' => 'SteadfastSecureLoginServer',
            'tokenName' => $token['name'],
            'officeName' => $token['name'],
            'officeId' => $token['office_id'] ?? null,
            'allowedOffices' => $token['allowed_office_ids'] ?? 'all'
        ]);
    }

    /**
     * Get available accounts grouped by office (NO PASSWORDS returned here)
     */
    public function accounts(Request $request): JsonResponse
    {
        $token = $request->attributes->get('extensionToken');
        $allowed = $token['allowed_office_ids'] ?? 'all';

        $officesQuery = Office::where('status', 'active');
        if ($allowed !== 'all') {
            $allowedIds = array_map('trim', explode(',', $allowed));
            $officesQuery->whereIn('id', $allowedIds);
        }

        $offices = $officesQuery->orderBy('name')->get();

        $result = [];
        foreach ($offices as $office) {
            $accounts = Account::where('office_id', $office->id)
                ->where('status', 'active')
                ->orderBy('display_name')
                ->get()
                ->map(function ($acc) {
                    return [
                        'id' => $acc->id,
                        'displayName' => $acc->display_name,
                        'officeId' => $acc->office_id
                    ];
                });

            if ($accounts->isNotEmpty()) {
                $result[] = [
                    'id' => $office->id,
                    'name' => $office->name,
                    'code' => $office->code ?? '',
                    'accounts' => $accounts->values()->all()
                ];
            }
        }

        return response()->json([
            'ok' => true,
            'offices' => $result
        ]);
    }

    /**
     * Real-time Credential Fetch for Immediate Login Fill & Submit
     */
    public function loginFill(Request $request): JsonResponse
    {
        $accountId = $request->input('account_id');
        if (empty($accountId)) {
            return response()->json([
                'ok' => false,
                'error' => 'account_id is required'
            ], 400);
        }

        $account = Account::with('office')->where('id', $accountId)->first();
        if (!$account || $account->status !== 'active') {
            return response()->json([
                'ok' => false,
                'error' => 'Account not found or inactive'
            ], 404);
        }

        $token = $request->attributes->get('extensionToken');
        if (($token['allowed_office_ids'] ?? 'all') !== 'all') {
            $allowed = array_map('trim', explode(',', $token['allowed_office_ids']));
            if (!in_array($account->office_id, $allowed)) {
                return response()->json([
                    'ok' => false,
                    'error' => 'This extension token is not authorized for this office'
                ], 403);
            }
        }

        // Record Audit Log
        $ip = $request->header('X-Forwarded-For') ?? $request->ip() ?? '';
        $userAgent = $request->header('User-Agent') ?? '';

        AuditLog::create([
            'timestamp' => now()->toIso8601String(),
            'account_id' => $account->id,
            'office_name' => $account->office->name ?? 'Unknown',
            'display_name' => $account->display_name,
            'token_name' => $token['name'] ?? 'Office Token',
            'ip' => (string)$ip,
            'user_agent' => (string)$userAgent,
            'status' => 'success'
        ]);

        return response()->json([
            'ok' => true,
            'credentials' => [
                'email' => $account->email,
                'password' => $account->password
            ]
        ]);
    }
}
