package main

import "net/http"

func (s *Server) RegisterAll(mux *http.ServeMux) {
	s.RegisterRoutes(mux)
	s.registerTemplateRoutes(mux)
}
