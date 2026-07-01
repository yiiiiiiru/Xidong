-- ============================================================
-- 溪东社区智慧养老 — 增量迁移：性能索引优化
-- Version: 1.1.0 | Date: 2026-07-01
-- ============================================================

-- 告警表：按状态+触发时间排序（工作台列表查询）
CREATE INDEX IF NOT EXISTS `idx_alert_status_triggered` ON `alert` (`status`, `triggered_at` DESC);

-- 告警表：按老人+状态（老人详情页查告警）
CREATE INDEX IF NOT EXISTS `idx_alert_elder_status` ON `alert` (`elder_id`, `status`);

-- 告警表：关闭时间（统计今日已关闭数）
CREATE INDEX IF NOT EXISTS `idx_alert_closed_at` ON `alert` (`closed_at`);

-- 食堂记录：日期+老人（统计覆盖率查询）
CREATE INDEX IF NOT EXISTS `idx_meal_date_elder` ON `meal_record` (`meal_date`, `elder_id`);

-- 老人表：名称模糊搜索辅助（前缀索引）
CREATE INDEX IF NOT EXISTS `idx_elder_name` ON `elder` (`name`(10));

-- 老人负责人关联表（如果存在）
CREATE INDEX IF NOT EXISTS `idx_assignment_worker` ON `elder_assignment` (`worker_id`);
CREATE INDEX IF NOT EXISTS `idx_assignment_elder` ON `elder_assignment` (`elder_id`);
