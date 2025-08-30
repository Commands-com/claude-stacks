; Tree-sitter queries for dangerous network operations in JavaScript
; These patterns detect fetch, XMLHttpRequest, and other network requests

; fetch() calls with dynamic URLs
((
  call_expression
    function: (identifier) @func
    arguments: (arguments (identifier) @url_var))
  (#eq? @func "fetch")) @warn.net

; fetch() with template literals
((
  call_expression
    function: (identifier) @func
    arguments: (arguments (template_string) @url_template))
  (#eq? @func "fetch")) @warn.net

; XMLHttpRequest usage
((
  new_expression
    constructor: (identifier) @constructor)
  (#eq? @constructor "XMLHttpRequest")) @warn.net

; require('http') or require('https')
((
  call_expression
    function: (identifier) @require_func
    arguments: (arguments (string) @module_name))
  (#eq? @require_func "require")
  (#match? @module_name "^\"(http|https|request|axios)\"$")) @warn.net