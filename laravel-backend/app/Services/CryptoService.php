<?php

namespace App\Services;

class CryptoService
{
    private static ?string $masterKey = null;

    /**
     * Retrieve 32-byte master encryption key
     */
    public static function getMasterKey(): string
    {
        if (self::$masterKey !== null) {
            return self::$masterKey;
        }

        // 1. Check environment variable
        $envKey = env('APP_SECRET_KEY');
        if (!empty($envKey)) {
            self::$masterKey = hash('sha256', $envKey, true);
            return self::$masterKey;
        }

        // 2. Check storage/data/secret.key
        $keyFile = storage_path('data/secret.key');
        if (file_exists($keyFile) && filesize($keyFile) === 32) {
            self::$masterKey = file_get_contents($keyFile);
            return self::$masterKey;
        }

        // 3. Check fallback in parent server/data/secret.key
        $parentKeyFile = base_path('../server/data/secret.key');
        if (file_exists($parentKeyFile) && filesize($parentKeyFile) === 32) {
            self::$masterKey = file_get_contents($parentKeyFile);
            @file_put_contents($keyFile, self::$masterKey);
            return self::$masterKey;
        }

        // 4. Generate fresh 32-byte key
        $generated = random_bytes(32);
        @mkdir(dirname($keyFile), 0755, true);
        @file_put_contents($keyFile, $generated);
        self::$masterKey = $generated;

        return self::$masterKey;
    }

    /**
     * Encrypt plain text using AES-256-GCM
     * Format: base64(iv):base64(authTag):base64(cipherText)
     */
    public static function encrypt(?string $plainText): string
    {
        if ($plainText === null || $plainText === '') {
            return '';
        }

        $key = self::getMasterKey();
        $iv = random_bytes(12);
        $tag = '';
        $cipherText = openssl_encrypt($plainText, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag, '', 16);

        if ($cipherText === false) {
            throw new \RuntimeException('Encryption failed.');
        }

        return base64_encode($iv) . ':' . base64_encode($tag) . ':' . base64_encode($cipherText);
    }

    /**
     * Decrypt AES-256-GCM cipher text
     */
    public static function decrypt(?string $cipherText): string
    {
        if ($cipherText === null || $cipherText === '') {
            return '';
        }

        $parts = explode(':', $cipherText);
        if (count($parts) !== 3) {
            // Not in encrypted format, return as plain
            return $cipherText;
        }

        $key = self::getMasterKey();
        $iv = base64_decode($parts[0]);
        $tag = base64_decode($parts[1]);
        $encrypted = base64_decode($parts[2]);

        $decrypted = openssl_decrypt($encrypted, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
        return $decrypted !== false ? $decrypted : '';
    }
}
