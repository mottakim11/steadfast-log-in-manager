<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'timestamp',
        'account_id',
        'office_name',
        'display_name',
        'token_name',
        'ip',
        'user_agent',
        'status'
    ];
}
