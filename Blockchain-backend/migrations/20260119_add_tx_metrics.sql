-- Migration: add tx_metrics and daily_gas_aggregates tables
-- Created: 2026-01-19

CREATE TABLE IF NOT EXISTS tx_metrics (
  tx_hash TEXT PRIMARY KEY,
  block_number BIGINT,
  timestamp TIMESTAMP WITH TIME ZONE,
  from_address TEXT,
  to_address TEXT,
  contract_address TEXT,
  method TEXT,
  campaign_id TEXT,
  value NUMERIC,
  gas_used BIGINT,
  effective_gas_price NUMERIC,
  tx_fee_eth NUMERIC,
  status SMALLINT,
  logs JSONB
);

CREATE INDEX IF NOT EXISTS idx_tx_metrics_block_number ON tx_metrics(block_number);
CREATE INDEX IF NOT EXISTS idx_tx_metrics_contract_address ON tx_metrics(contract_address);
CREATE INDEX IF NOT EXISTS idx_tx_metrics_campaign_id ON tx_metrics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_tx_metrics_timestamp ON tx_metrics(timestamp);

CREATE TABLE IF NOT EXISTS daily_gas_aggregates (
  day DATE,
  metric_type TEXT,
  key TEXT,
  total_gas NUMERIC,
  tx_count BIGINT,
  PRIMARY KEY(day, metric_type, key)
);

-- Optional helper: aggregate function to upsert daily totals
CREATE OR REPLACE FUNCTION upsert_daily_gas(p_day DATE, p_metric_type TEXT, p_key TEXT, p_total_gas NUMERIC, p_tx_count BIGINT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO daily_gas_aggregates(day, metric_type, key, total_gas, tx_count)
  VALUES (p_day, p_metric_type, p_key, p_total_gas, p_tx_count)
  ON CONFLICT (day, metric_type, key)
  DO UPDATE SET total_gas = daily_gas_aggregates.total_gas + EXCLUDED.total_gas,
                tx_count = daily_gas_aggregates.tx_count + EXCLUDED.tx_count;
END;
$$ LANGUAGE plpgsql;


