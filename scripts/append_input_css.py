css_to_append = """

/* Improved Input Styles for Dashboard */
input[type="text"], input[type="datetime-local"], select {
  background: rgba(20, 20, 30, 0.6) !important;
  border: 1px solid rgba(138, 43, 226, 0.4) !important;
  color: #fff !important;
  border-radius: 4px !important;
  font-family: 'Space Mono', monospace !important;
  padding: 10px !important;
  transition: all 0.2s ease !important;
  color-scheme: dark;
}

input[type="text"]:focus, input[type="datetime-local"]:focus, select:focus {
  outline: none !important;
  border-color: rgba(138, 43, 226, 0.9) !important;
  background: rgba(30, 30, 45, 0.8) !important;
  box-shadow: 0 0 8px rgba(138, 43, 226, 0.4) !important;
}

input::placeholder {
  color: #888 !important;
}
"""

with open('global.css', 'a') as f:
    f.write(css_to_append)

print("CSS appended to global.css")
