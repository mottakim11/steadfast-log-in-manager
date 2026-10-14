<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\ExtensionController;
use App\Http\Middleware\AdminAuthMiddleware;
use App\Http\Middleware\ExtensionTokenMiddleware;
use Illuminate\Support\Facades\Route;

// ---------------- Public & Auth Endpoints ---------------- //
Route::get('/auth/public-info', [AdminController::class, 'publicInfo']);
Route::post('/auth/login', [AdminController::class, 'login']);

// ---------------- Protected Admin Endpoints ---------------- //
Route::middleware(AdminAuthMiddleware::class)->group(function () {
    Route::get('/auth/verify', [AdminController::class, 'verify']);
    Route::post('/auth/change-password', [AdminController::class, 'changePassword']);

    // Offices
    Route::get('/admin/offices', [AdminController::class, 'getOffices']);
    Route::post('/admin/offices', [AdminController::class, 'createOffice']);
    Route::put('/admin/offices/{id}', [AdminController::class, 'updateOffice']);
    Route::post('/admin/offices/{id}/regenerate-key', [AdminController::class, 'regenerateOfficeKey']);
    Route::delete('/admin/offices/{id}', [AdminController::class, 'deleteOffice']);

    // Accounts
    Route::get('/admin/accounts', [AdminController::class, 'getAccounts']);
    Route::get('/admin/accounts/{id}', [AdminController::class, 'getAccount']);
    Route::post('/admin/accounts', [AdminController::class, 'createAccount']);
    Route::put('/admin/accounts/{id}', [AdminController::class, 'updateAccount']);
    Route::delete('/admin/accounts/{id}', [AdminController::class, 'deleteAccount']);

    // Extension Tokens
    Route::get('/admin/tokens', [AdminController::class, 'getTokens']);
    Route::post('/admin/tokens', [AdminController::class, 'createToken']);
    Route::put('/admin/tokens/{id}', [AdminController::class, 'updateToken']);
    Route::delete('/admin/tokens/{id}', [AdminController::class, 'deleteToken']);

    // Stats, Logs & Settings
    Route::get('/admin/stats', [AdminController::class, 'getStats']);
    Route::get('/admin/logs', [AdminController::class, 'getLogs']);
    Route::get('/admin/settings', [AdminController::class, 'getSettings']);
    Route::post('/admin/settings', [AdminController::class, 'saveSettings']);

    // Backup & Restore
    Route::get('/admin/backup/export', [AdminController::class, 'exportBackup']);
    Route::post('/admin/backup/import', [AdminController::class, 'importBackup']);
});

// ---------------- Extension Client Endpoints ---------------- //
Route::middleware(ExtensionTokenMiddleware::class)->group(function () {
    Route::get('/extension/ping', [ExtensionController::class, 'ping']);
    Route::get('/extension/accounts', [ExtensionController::class, 'accounts']);
    Route::post('/extension/login-fill', [ExtensionController::class, 'loginFill']);
});
