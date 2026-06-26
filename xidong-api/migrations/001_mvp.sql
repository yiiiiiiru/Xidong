-- ============================================================
-- 溪东社区智慧养老 MVP — 数据库初始化 DDL
-- Version: 1.0.0 | Date: 2026-06-25
-- 10 张核心表，对齐系统设计 §7
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. 老人主表
CREATE TABLE IF NOT EXISTS `elder` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `name` VARCHAR(50) NOT NULL,
  `gender` ENUM('男','女') NOT NULL DEFAULT '男',
  `age` INT,
  `grid_id` BIGINT,
  `community` VARCHAR(100),
  `building` VARCHAR(20) NOT NULL COMMENT '楼长隔离键',
  `unit` VARCHAR(20),
  `room` VARCHAR(20),
  `phone` VARCHAR(20) COMMENT 'AES加密存储',
  `id_card` VARCHAR(64) COMMENT 'AES加密存储',
  `chronic_disease` TEXT COMMENT '楼长不可见',
  `risk_class` ENUM('A','B','C') NOT NULL DEFAULT 'C',
  `plan_level` ENUM('full','standard','basic') NOT NULL DEFAULT 'basic',
  `habit_profile` JSON COMMENT '{"t_sleep":"22:00","delta_min":90,"bed_leave_min":30,"bath_threshold_min":30,"install_days":0,"baseline_ready":false}',
  `is_homebound` TINYINT NOT NULL DEFAULT 0 COMMENT '长期居家，关闭R-DOOR-01',
  `property_phone` VARCHAR(20) COMMENT '对应物业24h值班电话',
  `notes` TEXT,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_building` (`building`),
  INDEX `idx_risk_class` (`risk_class`),
  INDEX `idx_plan_level` (`plan_level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. 紧急联系人
CREATE TABLE IF NOT EXISTS `emergency_contact` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `elder_id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(50) NOT NULL,
  `relation` VARCHAR(20),
  `phone` VARCHAR(20) NOT NULL,
  `priority` INT NOT NULL DEFAULT 1 COMMENT '1最高',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`elder_id`) REFERENCES `elder`(`id`) ON DELETE CASCADE,
  INDEX `idx_elder` (`elder_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 老人状态管理（外出/住院/暂停）
CREATE TABLE IF NOT EXISTS `elder_status` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `elder_id` VARCHAR(64) NOT NULL,
  `status` ENUM('home','away','hospital','paused') NOT NULL,
  `start_at` DATETIME NOT NULL,
  `end_at` DATETIME,
  `note` TEXT,
  `created_by` VARCHAR(64),
  `ended_early` TINYINT DEFAULT 0 COMMENT '是否手动提前结束',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`elder_id`) REFERENCES `elder`(`id`) ON DELETE CASCADE,
  INDEX `idx_elder_active` (`elder_id`, `end_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. 设备绑定
CREATE TABLE IF NOT EXISTS `device` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `elder_id` VARCHAR(64) NOT NULL,
  `tuya_device_id` VARCHAR(64) NOT NULL UNIQUE COMMENT '涂鸦设备ID',
  `device_type` ENUM('button','bed','pir','door') NOT NULL,
  `location` VARCHAR(50) NOT NULL COMMENT '床头/卫生间/床垫下/入户门',
  `battery_pct` INT DEFAULT 100,
  `last_event_at` DATETIME,
  `online` TINYINT DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`elder_id`) REFERENCES `elder`(`id`) ON DELETE CASCADE,
  INDEX `idx_tuya_device` (`tuya_device_id`),
  INDEX `idx_elder` (`elder_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. 传感器事件（按月分区）
CREATE TABLE IF NOT EXISTS `sensor_event` (
  `id` BIGINT AUTO_INCREMENT,
  `elder_id` VARCHAR(64) NOT NULL,
  `device_id` BIGINT NOT NULL,
  `event_type` VARCHAR(32) NOT NULL COMMENT 'button_hold/on_bed/off_bed/pir_active/pir_clear/door_open/door_close',
  `payload` JSON,
  `event_time` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`, `event_time`),
  INDEX `idx_elder_time` (`elder_id`, `event_time`),
  INDEX `idx_device_time` (`device_id`, `event_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
PARTITION BY RANGE (TO_DAYS(`event_time`)) (
  PARTITION `p202606` VALUES LESS THAN (TO_DAYS('2026-07-01')),
  PARTITION `p202607` VALUES LESS THAN (TO_DAYS('2026-08-01')),
  PARTITION `p202608` VALUES LESS THAN (TO_DAYS('2026-09-01')),
  PARTITION `p202609` VALUES LESS THAN (TO_DAYS('2026-10-01')),
  PARTITION `p_future` VALUES LESS THAN MAXVALUE
);

-- 6. 告警
CREATE TABLE IF NOT EXISTS `alert` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `elder_id` VARCHAR(64) NOT NULL,
  `rule_id` VARCHAR(32) NOT NULL COMMENT 'R-BTN/R-MIX-01/R-BED-01...',
  `level` ENUM('P0','P1','P2') NOT NULL,
  `status` ENUM('pending','processing','dispatched','closed','closed_false_positive') NOT NULL DEFAULT 'pending',
  `trigger_desc` TEXT NOT NULL COMMENT '人类可读描述',
  `context_json` JSON COMMENT '48h事件快照',
  `handler_id` VARCHAR(64) COMMENT '接单社工ID',
  `handler_note` TEXT,
  `false_positive_reason` VARCHAR(32) COMMENT 'bathing/visitor/pet/device_fault/other',
  `triggered_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `handled_at` DATETIME,
  `closed_at` DATETIME,
  FOREIGN KEY (`elder_id`) REFERENCES `elder`(`id`) ON DELETE CASCADE,
  INDEX `idx_status_level` (`status`, `level`),
  INDEX `idx_elder` (`elder_id`),
  INDEX `idx_triggered` (`triggered_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. 告警流水（全状态机留痕）
CREATE TABLE IF NOT EXISTS `alert_timeline` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `alert_id` VARCHAR(64) NOT NULL,
  `event_type` ENUM('triggered','pushed','acknowledged','suppressed','escalated','closed','dispatched') NOT NULL,
  `channel` VARCHAR(32) COMMENT 'dingtalk_voice/dingtalk_card/h5/sms/fallback_ding',
  `meta` JSON COMMENT '{"latency_sec":4.2,"round":1,"operator":"张三"}',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`alert_id`) REFERENCES `alert`(`id`) ON DELETE CASCADE,
  INDEX `idx_alert` (`alert_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. 误报反馈
CREATE TABLE IF NOT EXISTS `false_positive_log` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `alert_id` VARCHAR(64) NOT NULL,
  `elder_id` VARCHAR(64) NOT NULL,
  `rule_id` VARCHAR(32) NOT NULL,
  `reason` ENUM('bathing','visitor','pet','device_fault','other') NOT NULL,
  `social_worker_id` VARCHAR(64),
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`alert_id`) REFERENCES `alert`(`id`) ON DELETE CASCADE,
  INDEX `idx_elder_rule` (`elder_id`, `rule_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. 食堂签到/消费记录
CREATE TABLE IF NOT EXISTS `meal_record` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `elder_id` VARCHAR(64) NOT NULL,
  `meal_date` DATE NOT NULL,
  `meal_type` ENUM('breakfast','lunch','dinner') NOT NULL,
  `check_method` ENUM('manual','scan','import') NOT NULL DEFAULT 'manual' COMMENT '签到方式：手动/扫码/批量导入',
  `amount` DECIMAL(6,2) DEFAULT 0.00 COMMENT '消费金额（元）',
  `operator_id` VARCHAR(64) COMMENT '录入人',
  `note` VARCHAR(200),
  `checked_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`elder_id`) REFERENCES `elder`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_elder_meal` (`elder_id`, `meal_date`, `meal_type`),
  INDEX `idx_meal_date` (`meal_date`),
  INDEX `idx_elder` (`elder_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. 工作人员
CREATE TABLE IF NOT EXISTS `social_worker` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `name` VARCHAR(50) NOT NULL,
  `dingtalk_user_id` VARCHAR(64) UNIQUE,
  `role` ENUM('social_worker','backup','building_manager','director','property') NOT NULL,
  `building` VARCHAR(20) COMMENT '楼长专用',
  `phone` VARCHAR(20),
  `on_duty` TINYINT DEFAULT 0 COMMENT '当班标记',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 初始测试数据
-- ============================================================

INSERT INTO `social_worker` (`id`, `name`, `dingtalk_user_id`, `role`, `phone`, `on_duty`, `building`) VALUES
('W001', '张社工', 'mock_sw_001', 'social_worker', '13800000001', 1, NULL),
('W002', '李备班', 'mock_sw_002', 'backup', '13800000002', 0, NULL),
('W003', '王楼长', 'mock_bm_001', 'building_manager', '13800000003', 0, '3'),
('W004', '赵物业', 'mock_prop_001', 'property', '13800000004', 1, NULL),
('W005', '陈主任', 'mock_dir_001', 'director', '13800000005', 0, NULL);

INSERT INTO `elder` (`id`, `name`, `gender`, `age`, `phone`, `building`, `room`, `risk_class`, `plan_level`, `is_homebound`, `property_phone`) VALUES
('E001', '张阿婆', '女', 82, '138****1001', '3', '301', 'A', 'full', 0, '13800138000'),
('E002', '李大爷', '男', 78, '138****1002', '5', '502', 'B', 'standard', 0, '13800138000'),
('E003', '王奶奶', '女', 85, '138****1003', '3', '303', 'A', 'full', 1, '13800138000'),
('E004', '赵伯伯', '男', 75, '138****1004', '7', '701', 'C', 'basic', 0, '13800138000'),
('E005', '陈阿姨', '女', 80, '138****1005', '5', '503', 'B', 'standard', 0, '13800138000');

INSERT INTO `emergency_contact` (`elder_id`, `name`, `phone`, `relation`, `priority`) VALUES
('E001', '张小明', '139****2001', '子女', 1),
('E002', '李小红', '139****2002', '子女', 1),
('E003', '王小强', '139****2003', '子女', 1),
('E004', '赵小花', '139****2004', '子女', 1),
('E005', '陈小林', '139****2005', '子女', 1);
