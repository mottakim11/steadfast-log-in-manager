<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Office extends Model
{
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'name',
        'code',
        'secret_key',
        'status'
    ];

    public function accounts(): HasMany
    {
        return $this->hasMany(Account::class, 'office_id', 'id');
    }
}
