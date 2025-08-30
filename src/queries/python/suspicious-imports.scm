; Tree-sitter queries for suspicious import operations in Python
; These patterns detect dynamic imports that could lead to code injection
; or unauthorized module loading

; Dynamic imports (code injection risk)
((
  call
    function: (identifier) @func
    arguments: (argument_list 
      (identifier) @module_var))
  (#eq? @func "__import__")) @danger.import

; __import__("modname")
((
  call
    function: (identifier) @func
    arguments: (argument_list 
      (string (string_content) @module_str)))
  (#eq? @func "__import__")) @danger.import

; importlib.import_module("mod") or variable
((
  call
    function: (attribute
      object: (identifier) @mod
      attribute: (identifier) @func)
    arguments: (argument_list (string (string_content) @module_str)))
  (#eq? @mod "importlib")
  (#eq? @func "import_module")) @danger.import

((
  call
    function: (attribute
      object: (identifier) @mod
      attribute: (identifier) @func)
    arguments: (argument_list (identifier) @module_var))
  (#eq? @mod "importlib")
  (#eq? @func "import_module")) @danger.import