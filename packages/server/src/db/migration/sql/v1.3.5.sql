WITH RECURSIVE rewritten(id, remaining, result) AS (
  SELECT id, body, ''
  FROM understandings
  WHERE body LIKE '%[[%#%]]%'

  UNION ALL

  SELECT
    id,
    CASE
      WHEN instr(remaining, '[[') > 0
        AND instr(substr(remaining, instr(remaining, '[[') + 2), ']]') > 0
      THEN substr(
        substr(remaining, instr(remaining, '[[') + 2),
        instr(substr(remaining, instr(remaining, '[[') + 2), ']]') + 2
      )
      ELSE ''
    END,
    result ||
    CASE
      WHEN instr(remaining, '[[') > 0
        AND instr(substr(remaining, instr(remaining, '[[') + 2), ']]') > 0
      THEN
        substr(remaining, 1, instr(remaining, '[[') - 1) ||
        CASE
          WHEN instr(
            substr(
              substr(remaining, instr(remaining, '[[') + 2),
              1,
              instr(substr(remaining, instr(remaining, '[[') + 2), ']]') - 1
            ),
            '#'
          ) > 0
          THEN
            '[[u:' ||
            substr(
              substr(
                substr(remaining, instr(remaining, '[[') + 2),
                1,
                instr(substr(remaining, instr(remaining, '[[') + 2), ']]') - 1
              ),
              instr(
                substr(
                  substr(remaining, instr(remaining, '[[') + 2),
                  1,
                  instr(substr(remaining, instr(remaining, '[[') + 2), ']]') - 1
                ),
                '#'
              ) + 1
            ) ||
            ']]'
          ELSE
            '[[' ||
            substr(
              substr(remaining, instr(remaining, '[[') + 2),
              1,
              instr(substr(remaining, instr(remaining, '[[') + 2), ']]') - 1
            ) ||
            ']]'
        END
      ELSE remaining
    END
  FROM rewritten
  WHERE remaining <> ''
)
UPDATE understandings
SET body = (
  SELECT result
  FROM rewritten
  WHERE rewritten.id = understandings.id AND remaining = ''
  LIMIT 1
)
WHERE body LIKE '%[[%#%]]%';
