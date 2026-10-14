<?php

namespace App\Http\Middleware;

use App\Services\JwtService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdminAuthMiddleware
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $authHeader = $request->header('Authorization');
        if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
            return response()->json([
                'ok' => false,
                'error' => 'Unauthorized: Admin authentication token required.'
            ], 401);
        }

        $token = substr($authHeader, 7);
        $decoded = JwtService::verify($token);

        if (!$decoded) {
            return response()->json([
                'ok' => false,
                'error' => 'Unauthorized: Token is expired or invalid.'
            ], 401);
        }

        $request->attributes->set('admin', $decoded);

        return $next($request);
    }
}
