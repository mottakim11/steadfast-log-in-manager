<?php

namespace App\Http\Middleware;

use App\Models\Token;
use App\Models\Office;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ExtensionTokenMiddleware
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $tokenVal = $request->header('X-Extension-Token')
            ?? $request->server('HTTP_X_EXTENSION_TOKEN')
            ?? $request->input('token')
            ?? $request->query('token');
        if (empty($tokenVal)) {
            return response()->json([
                'ok' => false,
                'error' => 'Missing X-Extension-Token header'
            ], 401);
        }

        $tokenVal = trim((string)$tokenVal);

        // 1. Check custom tokens in tokens table
        $customToken = Token::where('token', $tokenVal)
            ->where('status', 'active')
            ->first();

        if ($customToken) {
            $request->attributes->set('extensionToken', [
                'id' => $customToken->id,
                'token' => $customToken->token,
                'name' => $customToken->name,
                'office_id' => null,
                'allowed_office_ids' => $customToken->allowed_office_ids,
                'status' => $customToken->status
            ]);
            return $next($request);
        }

        // 2. Check office secret keys in offices table
        $office = Office::where('secret_key', $tokenVal)
            ->where('status', 'active')
            ->first();

        if ($office) {
            $request->attributes->set('extensionToken', [
                'id' => 'tok_' . $office->id,
                'token' => $office->secret_key,
                'name' => $office->name,
                'office_id' => $office->id,
                'allowed_office_ids' => $office->id,
                'status' => $office->status
            ]);
            return $next($request);
        }

        return response()->json([
            'ok' => false,
            'error' => 'Invalid or revoked extension access token'
        ], 403);
    }
}
