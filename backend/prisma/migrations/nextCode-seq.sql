-- nextCode TOCTOU 修复：5 个业务的 code 生成改用 SEQUENCE 原子计数器
-- 创建日期：2026-09-23
-- 方案 A1+B1+C1：跨日重置（setval(1, false)）+ 已有数据 setval(max+1) + SEQUENCE 不存在时回退到 findFirst
-- 幂等可重跑（IF NOT EXISTS / OR REPLACE 模式）

-- 1. 客户 code 序列
CREATE SEQUENCE IF NOT EXISTS public.customer_code_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 9999 START WITH 1;
-- 初始化：取今天已有的最大 code 序号 + 1，避免新号与旧号重叠
DO $$
DECLARE
  today_code TEXT := 'KH' || to_char(CURRENT_DATE, 'YYYYMMDD');
  max_seq INT;
BEGIN
  SELECT COALESCE(MAX(CAST(substring(code FROM length(today_code)+1) AS INTEGER)), 0)
    INTO max_seq
    FROM "CrmCustomer"
    WHERE code LIKE today_code || '%';
  IF max_seq > 0 THEN
    PERFORM setval('public.customer_code_seq', max_seq, true);
  END IF;
END$$;

-- 2. 项目 code 序列（XM202609220001）
CREATE SEQUENCE IF NOT EXISTS public.project_code_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 9999 START WITH 1;
DO $$
DECLARE
  today_code TEXT := 'XM' || to_char(CURRENT_DATE, 'YYYYMMDD');
  max_seq INT;
BEGIN
  SELECT COALESCE(MAX(CAST(substring(code FROM length(today_code)+1) AS INTEGER)), 0)
    INTO max_seq
    FROM "CrmOpportunity"
    WHERE code LIKE today_code || '%';
  IF max_seq > 0 THEN
    PERFORM setval('public.project_code_seq', max_seq, true);
  END IF;
END$$;

-- 3. 合同 code 序列（HT202609220001）
CREATE SEQUENCE IF NOT EXISTS public.contract_code_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 9999 START WITH 1;
DO $$
DECLARE
  today_code TEXT := 'HT' || to_char(CURRENT_DATE, 'YYYYMMDD');
  max_seq INT;
BEGIN
  SELECT COALESCE(MAX(CAST(substring(code FROM length(today_code)+1) AS INTEGER)), 0)
    INTO max_seq
    FROM "SalesContract"
    WHERE code LIKE today_code || '%';
  IF max_seq > 0 THEN
    PERFORM setval('public.contract_code_seq', max_seq, true);
  END IF;
END$$;

-- 4. 报价 code 序列（BJ202609220001）
CREATE SEQUENCE IF NOT EXISTS public.quotation_code_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 9999 START WITH 1;
DO $$
DECLARE
  today_code TEXT := 'BJ' || to_char(CURRENT_DATE, 'YYYYMMDD');
  max_seq INT;
BEGIN
  SELECT COALESCE(MAX(CAST(substring(code FROM length(today_code)+1) AS INTEGER)), 0)
    INTO max_seq
    FROM "SalesQuotation"
    WHERE code LIKE today_code || '%';
  IF max_seq > 0 THEN
    PERFORM setval('public.quotation_code_seq', max_seq, true);
  END IF;
END$$;

-- 5. 工作日志 code 序列（RJ202609220001）
CREATE SEQUENCE IF NOT EXISTS public.worklog_code_seq INCREMENT BY 1 MINVALUE 1 MAXVALUE 9999 START WITH 1;
DO $$
DECLARE
  today_code TEXT := 'RJ' || to_char(CURRENT_DATE, 'YYYYMMDD');
  max_seq INT;
BEGIN
  SELECT COALESCE(MAX(CAST(substring(code FROM length(today_code)+1) AS INTEGER)), 0)
    INTO max_seq
    FROM "CrmWorkLog"
    WHERE code LIKE today_code || '%';
  IF max_seq > 0 THEN
    PERFORM setval('public.worklog_code_seq', max_seq, true);
  END IF;
END$$;