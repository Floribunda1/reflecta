/**
 * 数据迁移 v1.3.5
 *
 * 全系统数据版本 v1.3.5 的迁移逻辑。
 * SQLite 部分通过 ctx.sql 执行；如需重建向量库/迁移 session，在此声明或由 Electron 按版本执行。
 * name 保留 ".sql" 后缀以兼容历史 _migrations 记录。
 */
import type { CodeMigration, MigrationContext } from "../../migration";

const migration: CodeMigration = {
  name: "v1.3.5.sql",
  version: [1, 3, 5],
  up: (ctx: MigrationContext) => {
    ctx.sql(
      "WITH RECURSIVE rewritten(id, remaining, result) AS (\n  SELECT id, body, ''\n  FROM understandings\n  WHERE body LIKE '%[[%#%]]%'\n\n  UNION ALL\n\n  SELECT\n    id,\n    CASE\n      WHEN instr(remaining, '[[') > 0\n        AND instr(substr(remaining, instr(remaining, '[[') + 2), ']]') > 0\n      THEN substr(\n        substr(remaining, instr(remaining, '[[') + 2),\n        instr(substr(remaining, instr(remaining, '[[') + 2), ']]') + 2\n      )\n      ELSE ''\n    END,\n    result ||\n    CASE\n      WHEN instr(remaining, '[[') > 0\n        AND instr(substr(remaining, instr(remaining, '[[') + 2), ']]') > 0\n      THEN\n        substr(remaining, 1, instr(remaining, '[[') - 1) ||\n        CASE\n          WHEN instr(\n            substr(\n              substr(remaining, instr(remaining, '[[') + 2),\n              1,\n              instr(substr(remaining, instr(remaining, '[[') + 2), ']]') - 1\n            ),\n            '#'\n          ) > 0\n          THEN\n            '[[u:' ||\n            substr(\n              substr(\n                substr(remaining, instr(remaining, '[[') + 2),\n                1,\n                instr(substr(remaining, instr(remaining, '[[') + 2), ']]') - 1\n              ),\n              instr(\n                substr(\n                  substr(remaining, instr(remaining, '[[') + 2),\n                  1,\n                  instr(substr(remaining, instr(remaining, '[[') + 2), ']]') - 1\n                ),\n                '#'\n              ) + 1\n            ) ||\n            ']]'\n          ELSE\n            '[[' ||\n            substr(\n              substr(remaining, instr(remaining, '[[') + 2),\n              1,\n              instr(substr(remaining, instr(remaining, '[[') + 2), ']]') - 1\n            ) ||\n            ']]'\n        END\n      ELSE remaining\n    END\n  FROM rewritten\n  WHERE remaining <> ''\n)\nUPDATE understandings\nSET body = (\n  SELECT result\n  FROM rewritten\n  WHERE rewritten.id = understandings.id AND remaining = ''\n  LIMIT 1\n)\nWHERE body LIKE '%[[%#%]]%';\n",
    );
  },
};

export default migration;
