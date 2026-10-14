<?php

namespace App\Models;

use App\Services\CryptoService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Account extends Model
{
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'office_id',
        'display_name',
        'email_cipher',
        'password_cipher',
        'status'
    ];

    protected $appends = ['email', 'password'];

    public function office(): BelongsTo
    {
        return $this->belongsTo(Office::class, 'office_id', 'id');
    }

    public function getEmailAttribute(): string
    {
        return CryptoService::decrypt($this->email_cipher);
    }

    public function getPasswordAttribute(): string
    {
        return CryptoService::decrypt($this->password_cipher);
    }

    public function setEmailAttribute(?string $value): void
    {
        $this->attributes['email_cipher'] = CryptoService::encrypt($value);
    }

    public function setPasswordAttribute(?string $value): void
    {
        $this->attributes['password_cipher'] = CryptoService::encrypt($value);
    }
}
