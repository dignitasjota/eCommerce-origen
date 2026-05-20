-- ─────────────────────────────────────────────────────────────────────
--  Migración acumulada Sprints 1-5 + tareas continuas
--  Generada el 2026-05-02 con `prisma migrate diff` contra la BD remota.
--
--  Aplicar con:
--    npx prisma db push --accept-data-loss=false
--  o ejecutar manualmente con un cliente MySQL:
--    mysql -h HOST -u USER -p DB_NAME < prisma/migrations-pending.sql
--
--  ⚠️ HACER BACKUP PREVIO. Aunque todos los cambios son aditivos (ADD COLUMN,
--  CREATE TABLE, CREATE INDEX) no hay vuelta atrás automática.
--
--  Notas de seguridad:
--    - El MODIFY del enum `orders.status` solo añade 'PENDING_PAYMENT' AL
--      FINAL del enum, no al inicio: en MariaDB el orden importa porque los
--      valores se almacenan como índice. Añadir al final es O(1) sobre el
--      schema; añadir al inicio reescribiría toda la tabla.
--    - Todas las columnas nuevas son NULL o tienen DEFAULT, así que filas
--      existentes no rompen.
-- ─────────────────────────────────────────────────────────────────────

-- AlterTable
ALTER TABLE `addresses` ADD COLUMN `tax_id` VARCHAR(32) NULL;

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `fulfillment_status` ENUM('UNFULFILLED', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED', 'RETURNED') NOT NULL DEFAULT 'UNFULFILLED',
    ADD COLUMN `invoice_number` VARCHAR(50) NULL,
    ADD COLUMN `invoice_url` VARCHAR(500) NULL,
    ADD COLUMN `payment_intent_id` VARCHAR(255) NULL,
    MODIFY `status` ENUM('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'PENDING_PAYMENT') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `products` ADD COLUMN `barcode` VARCHAR(50) NULL,
    ADD COLUMN `dimensions` VARCHAR(100) NULL,
    ADD COLUMN `weight` DECIMAL(8, 3) NULL;

-- AlterTable
ALTER TABLE `reviews` ADD COLUMN `images` TEXT NULL,
    ADD COLUMN `is_verified_purchase` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `last_login_at` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NULL,
    `action` VARCHAR(100) NOT NULL,
    `entity_type` VARCHAR(50) NOT NULL,
    `entity_id` VARCHAR(36) NULL,
    `metadata` LONGTEXT NULL,
    `ip_address` VARCHAR(45) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_audit_user`(`user_id`),
    INDEX `idx_audit_entity`(`entity_type`, `entity_id`),
    INDEX `idx_audit_created`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_movements` (
    `id` VARCHAR(36) NOT NULL,
    `variant_id` VARCHAR(36) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `reason` ENUM('PURCHASE', 'REFUND', 'ADJUSTMENT', 'RESTOCK', 'RESERVATION_RELEASE') NOT NULL,
    `reference_id` VARCHAR(36) NULL,
    `note` VARCHAR(255) NULL,
    `user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_stock_variant`(`variant_id`),
    INDEX `idx_stock_reason`(`reason`),
    INDEX `idx_stock_created`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscribers` (
    `id` VARCHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `locale` VARCHAR(5) NOT NULL DEFAULT 'es',
    `confirm_token` VARCHAR(255) NULL,
    `confirmed_at` DATETIME(3) NULL,
    `unsubscribed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_subscriber_email`(`email`),
    UNIQUE INDEX `uq_subscriber_token`(`confirm_token`),
    INDEX `idx_subscribers_confirmed`(`confirmed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webhook_events` (
    `id` VARCHAR(36) NOT NULL,
    `provider` VARCHAR(50) NOT NULL,
    `event_id` VARCHAR(255) NOT NULL,
    `event_type` VARCHAR(100) NULL,
    `processed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_webhook_provider`(`provider`),
    UNIQUE INDEX `uq_webhook_provider_event`(`provider`, `event_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `uq_payment_intent_id` ON `orders`(`payment_intent_id`);

-- CreateIndex
CREATE UNIQUE INDEX `uq_invoice_number` ON `orders`(`invoice_number`);
