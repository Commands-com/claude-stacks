; Tree-sitter queries for environment variable access in Python
; These patterns detect access to environment variables that could expose
; credentials, secrets, or sensitive configuration

; Environment access with variables (credential access)
((
  subscript
    value: (attribute
      object: (identifier) @obj
      attribute: (identifier) @attr)
    subscript: (identifier) @key_var)
  (#eq? @obj "os")
  (#eq? @attr "environ")) @warn.env

; Sensitive environment variables by name
((
  subscript
    value: (attribute
      object: (identifier) @obj
      attribute: (identifier) @attr)
    subscript: (string (string_content) @key))
  (#eq? @obj "os")
  (#eq? @attr "environ")
  (#match? @key "(password|secret|key|token|credential|auth|PASSWORD|SECRET|KEY|TOKEN|CREDENTIAL|AUTH)")) @taint.env