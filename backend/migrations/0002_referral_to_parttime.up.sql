-- 板块调整：内推专区 → 兼职信息（校招实习并入内推/求内推标签）
-- 说明：生产环境为一次性数据迁移，由部署时手动执行；本地全新安装由 seed.go 直接生成最终形态。
-- 幂等：按 slug/name 定位，重复执行安全。

BEGIN;

-- 1) 内推/求内推 标签并入「校招实习」（去掉“必选”属性，排在原标签之后）
UPDATE tags
SET board_id    = rec.id,
    is_required = false,
    sort        = CASE tags.name WHEN '内推' THEN 4 WHEN '求内推' THEN 5 END,
    updated_at  = now()
FROM boards ref, boards rec
WHERE tags.board_id = ref.id
  AND ref.slug = 'referral'
  AND rec.slug = 'recruit'
  AND tags.name IN ('内推', '求内推');

-- 2) 帖子（若有）从内推专区迁到校招实习
UPDATE posts
SET board_id   = rec.id,
    updated_at = now()
FROM boards ref, boards rec
WHERE posts.board_id = ref.id
  AND ref.slug = 'referral'
  AND rec.slug = 'recruit';

-- 3) 内推专区 → 兼职信息（改名 / 改 slug / 改描述）
UPDATE boards
SET name        = '兼职信息',
    slug        = 'part-time',
    description = '兼职、家教、零工信息',
    updated_at  = now()
WHERE slug = 'referral';

-- 4) 为「兼职信息」板块新增标签（同名已存在则跳过）
INSERT INTO tags (id, board_id, name, is_required, sort, status, created_at, updated_at)
SELECT gen_random_uuid(), b.id, v.name, false, v.sort, 0, now(), now()
FROM boards b
JOIN (VALUES ('家教', 0), ('校园', 1), ('线上', 2), ('门店', 3), ('其他', 4)) AS v(name, sort)
  ON true
WHERE b.slug = 'part-time'
  AND NOT EXISTS (
      SELECT 1 FROM tags t WHERE t.board_id = b.id AND t.name = v.name
  );

COMMIT;
