<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->text('value')->nullable();
        });

        Schema::create('offices', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('name');
            $table->string('code')->nullable();
            $table->string('secret_key')->unique();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('accounts', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('office_id')->index();
            $table->string('display_name');
            $table->text('email_cipher');
            $table->text('password_cipher');
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('tokens', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('token')->unique();
            $table->string('name');
            $table->text('allowed_office_ids')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->string('timestamp')->nullable();
            $table->string('account_id')->nullable();
            $table->string('office_name')->nullable();
            $table->string('display_name')->nullable();
            $table->string('token_name')->nullable();
            $table->string('ip')->nullable();
            $table->text('user_agent')->nullable();
            $table->string('status')->default('success');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('tokens');
        Schema::dropIfExists('accounts');
        Schema::dropIfExists('offices');
        Schema::dropIfExists('settings');
    }
};
