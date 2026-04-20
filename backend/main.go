package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
)

type Task struct {
	ID   int    `json:"id"`
	Text string `json:"text"`
}

var (
	tasks       []Task
	nextID      = 1
	dailyTasks  []Task
	dailyNextID = 1
	mu          sync.Mutex
)

var allowedOrigins = map[string]bool{
	"https://pomodoro-app-1-m5t6.onrender.com": true,
	"http://localhost:5173":                     true,
}

func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if allowedOrigins[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func handleTasks(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		mu.Lock()
		out := tasks
		if out == nil {
			out = []Task{}
		}
		mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(out)

	case http.MethodPost:
		var body struct {
			Text string `json:"text"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Text == "" {
			http.Error(w, `{"error":"text is required"}`, http.StatusBadRequest)
			return
		}
		mu.Lock()
		t := Task{ID: nextID, Text: body.Text}
		nextID++
		tasks = append(tasks, t)
		mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(t)

	case http.MethodDelete:
		mu.Lock()
		tasks = nil
		mu.Unlock()
		w.WriteHeader(http.StatusNoContent)

	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func handleTaskByID(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/tasks/")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	switch r.Method {
	case http.MethodDelete:
		mu.Lock()
		found := false
		for i, t := range tasks {
			if t.ID == id {
				tasks = append(tasks[:i], tasks[i+1:]...)
				found = true
				break
			}
		}
		mu.Unlock()
		if !found {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		w.WriteHeader(http.StatusNoContent)

	case http.MethodPatch:
		var body struct {
			Text string `json:"text"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Text == "" {
			http.Error(w, `{"error":"text is required"}`, http.StatusBadRequest)
			return
		}
		mu.Lock()
		found := false
		for i, t := range tasks {
			if t.ID == id {
				tasks[i].Text = body.Text
				found = true
				break
			}
		}
		mu.Unlock()
		if !found {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		w.WriteHeader(http.StatusNoContent)

	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func handleDailyTasks(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		mu.Lock()
		out := dailyTasks
		if out == nil {
			out = []Task{}
		}
		mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(out)

	case http.MethodPost:
		var body struct {
			Text string `json:"text"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Text == "" {
			http.Error(w, `{"error":"text is required"}`, http.StatusBadRequest)
			return
		}
		mu.Lock()
		t := Task{ID: dailyNextID, Text: body.Text}
		dailyNextID++
		dailyTasks = append(dailyTasks, t)
		mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(t)

	case http.MethodDelete:
		mu.Lock()
		dailyTasks = nil
		mu.Unlock()
		w.WriteHeader(http.StatusNoContent)

	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func handleDailyTaskByID(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/daily-tasks/")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	switch r.Method {
	case http.MethodDelete:
		mu.Lock()
		found := false
		for i, t := range dailyTasks {
			if t.ID == id {
				dailyTasks = append(dailyTasks[:i], dailyTasks[i+1:]...)
				found = true
				break
			}
		}
		mu.Unlock()
		if !found {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		w.WriteHeader(http.StatusNoContent)

	case http.MethodPatch:
		var body struct {
			Text string `json:"text"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Text == "" {
			http.Error(w, `{"error":"text is required"}`, http.StatusBadRequest)
			return
		}
		mu.Lock()
		found := false
		for i, t := range dailyTasks {
			if t.ID == id {
				dailyTasks[i].Text = body.Text
				found = true
				break
			}
		}
		mu.Unlock()
		if !found {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		w.WriteHeader(http.StatusNoContent)

	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func main() {
	http.HandleFunc("/tasks", corsMiddleware(handleTasks))
	http.HandleFunc("/tasks/", corsMiddleware(handleTaskByID))
	http.HandleFunc("/daily-tasks", corsMiddleware(handleDailyTasks))
	http.HandleFunc("/daily-tasks/", corsMiddleware(handleDailyTaskByID))
	log.Println("Server running on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
