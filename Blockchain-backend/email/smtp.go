package email

import (
	"fmt"
	"net/smtp"
	"strings"
)

// SendSMTP sends a simple plaintext email using AUTH PLAIN if user/pass provided.
func SendSMTP(host string, port int, user, pass, from string, to []string, subject, body string) error {
	addr := fmt.Sprintf("%s:%d", host, port)
	headers := make(map[string]string)
	headers["From"] = from
	headers["To"] = strings.Join(to, ", ")
	headers["Subject"] = subject
	headers["MIME-Version"] = "1.0"
	headers["Content-Type"] = "text/plain; charset=utf-8"
	var msg strings.Builder
	for k, v := range headers {
		msg.WriteString(fmt.Sprintf("%s: %s\r\n", k, v))
	}
	msg.WriteString("\r\n")
	msg.WriteString(body)
	var auth smtp.Auth
	if user != "" || pass != "" {
		auth = smtp.PlainAuth("", user, pass, host)
	}
	return smtp.SendMail(addr, auth, from, to, []byte(msg.String()))
}
