-- Migration: add price_cache table for daily ETH USD prices
-- Created: 2026-01-19

CREATE TABLE IF NOT EXISTS price_cache (
  day DATE PRIMARY KEY,
  price_usd NUMERIC
);


