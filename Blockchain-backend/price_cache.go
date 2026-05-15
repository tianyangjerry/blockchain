package main

import (
    "database/sql"
    "encoding/json"
    "fmt"
    "net/http"
    "time"
)

// GetUSDPriceForDay returns ETH price in USD for the given day (UTC date).
// It first checks local DB cache (price_cache), otherwise queries CoinGecko and stores the result.
func GetUSDPriceForDay(day time.Time) (float64, error) {
    dsn := envOr("PG_DSN", "")
    db, err := sql.Open("postgres", dsn)
    if err != nil { return 0, err }
    defer db.Close()

    var p sql.NullFloat64
    dateOnly := day.UTC().Format("2006-01-02")
    if err := db.QueryRow(`SELECT price_usd FROM price_cache WHERE day = $1`, dateOnly).Scan(&p); err == nil && p.Valid {
        return p.Float64, nil
    }

    // fetch from CoinGecko (historical endpoint expects dd-mm-yyyy)
    dd := day.UTC().Format("02-01-2006")
    url := fmt.Sprintf("https://api.coingecko.com/api/v3/coins/ethereum/history?date=%s", dd)
    client := &http.Client{ Timeout: 10 * time.Second }
    resp, err := client.Get(url)
    if err != nil { return 0, err }
    defer resp.Body.Close()
    if resp.StatusCode != 200 { return 0, fmt.Errorf("coingecko status %d", resp.StatusCode) }
    var body struct {
        MarketData struct {
            CurrentPrice map[string]float64 `json:"current_price"`
        } `json:"market_data"`
    }
    if err := json.NewDecoder(resp.Body).Decode(&body); err != nil { return 0, err }
    usd, ok := body.MarketData.CurrentPrice["usd"]
    if !ok { return 0, fmt.Errorf("no usd price in response") }

    // store in DB
    if _, err := db.Exec(`INSERT INTO price_cache(day, price_usd) VALUES($1,$2) ON CONFLICT (day) DO UPDATE SET price_usd = EXCLUDED.price_usd`, dateOnly, usd); err != nil {
        // log but not fatal
    }
    return usd, nil
}


