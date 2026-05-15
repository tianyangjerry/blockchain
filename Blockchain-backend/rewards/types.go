package rewards

import "time"

type Config struct {
    ID                 string    `json:"id"`
    PointPerETH        string    `json:"pointPerETH"`        // 每 1 ETH 获得的积分数（字符串避免精度问题）
    NFTThresholdsJSON  string    `json:"nftThresholdsJson"`  // JSON 文本，例如 {"bronze":"0.1","silver":"1","gold":"5"}
    DailyCapPerAddress string    `json:"dailyCapPerAddress"` // 每地址每日积分上限
    CooldownSeconds    int       `json:"cooldownSeconds"`    // 领取/发放冷却时间（秒）
    UpdatedAt          time.Time `json:"updatedAt"`
}


