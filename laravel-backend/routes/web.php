<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->file(public_path('index.html'));
});

Route::get('/login', function () {
    return response()->file(public_path('login.html'));
});

Route::fallback(function () {
    return response()->file(public_path('index.html'));
});
